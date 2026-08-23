import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { CacheManager } from '../cache/cache.manager';
import type { PrismaService } from '../prisma/prisma.service';
import { AUDIT_LOG_CACHE, AUDIT_LOG_CACHE_VERSION_KEY } from './constants/audit-log.constants';
import type { AuditLogQueryDto } from './dto/audit-log-query.dto';
import type { AuditLogInput } from './interfaces/audit-log.interface';
import { generateAuditDiff } from './utils/audit-diff.util';
import { sanitizeAuditValue } from './utils/audit-sanitizer.util';
import { inferAuditSeverity } from './utils/audit-severity.util';

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheManager,
  ) {}

  log(input: AuditLogInput): void {
    const safeBefore = sanitizeAuditValue(input.before);
    const safeAfter = sanitizeAuditValue(input.after);

    const payload: Prisma.AuditLogCreateInput = {
      ...input,
      severity: inferAuditSeverity(input.action, input.severity),
      actorId: input.actorId == null ? null : String(input.actorId),
      targetId: input.targetId == null ? null : String(input.targetId),

      metadata: this.toPrismaJson(sanitizeAuditValue(input.metadata)),
      before: this.toPrismaJson(safeBefore),
      after: this.toPrismaJson(safeAfter),
      diff: this.toPrismaJson(generateAuditDiff(safeBefore, safeAfter)),
    };

    this.enqueueLogWrite(payload);
  }

  private toPrismaJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
    if (value === null || value === undefined) {
      return Prisma.JsonNull;
    }

    return this.normalizeJson(value) as Prisma.InputJsonValue;
  }

  private normalizeJson(value: unknown, seen = new WeakSet<object>()): Prisma.JsonValue {
    if (value === null) return null;

    switch (typeof value) {
      case 'string':
      case 'boolean':
        return value;

      case 'number':
        return Number.isFinite(value) ? value : String(value);

      case 'bigint':
        return value.toString();

      case 'undefined':
      case 'function':
      case 'symbol':
        return null;
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (value instanceof Prisma.Decimal) {
      return value.toString();
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.normalizeJson(item, seen));
    }

    if (typeof value === 'object') {
      if (seen.has(value)) {
        return '[Circular]';
      }

      seen.add(value);

      try {
        const toJSON = Reflect.get(value, 'toJSON');

        if (typeof toJSON === 'function') {
          const serialized = toJSON.call(value);

          if (serialized !== value) {
            return this.normalizeJson(serialized, seen);
          }
        }

        const result: Prisma.JsonObject = {};

        for (const [key, item] of Object.entries(value)) {
          if (
            key === 'constructor' ||
            typeof item === 'function' ||
            typeof item === 'undefined' ||
            typeof item === 'symbol'
          ) {
            continue;
          }

          result[key] = this.normalizeJson(item, seen);
        }

        return result;
      } finally {
        seen.delete(value);
      }
    }

    return String(value);
  }

  private enqueueLogWrite(data: Prisma.AuditLogCreateInput): void {
    setImmediate(() => {
      void this.prisma.auditLog
        .create({ data })
        .then(() => this.cache.bumpVersion(AUDIT_LOG_CACHE_VERSION_KEY))
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);

          const stack = error instanceof Error ? error.stack : undefined;

          this.logger.error(`Audit log write failed: ${message}`, stack);
        });
    });
  }

  async findMany(query: AuditLogQueryDto) {
    const version = await this.cache.getVersion(AUDIT_LOG_CACHE_VERSION_KEY);
    const key = this.cache.buildHashedKey(AUDIT_LOG_CACHE.LIST_NAMESPACE, {
      version,
      query,
    });
    return this.cache.getOrSet(
      key,
      {
        ttlSeconds: AUDIT_LOG_CACHE.LIST_TTL_SECONDS,
        earlyRefreshWindowSeconds: AUDIT_LOG_CACHE.EARLY_REFRESH_SECONDS,
      },
      async () => {
        const page = Math.max(Number(query.page) || 1, 1);
        const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
        const where: any = {};
        if (query.from || query.to)
          where.createdAt = {
            ...(query.from ? { gte: new Date(query.from) } : {}),
            ...(query.to ? { lte: new Date(query.to) } : {}),
          };
        if (query.actorId) where.actorId = String(query.actorId);
        if (query.requestId) where.requestId = String(query.requestId);
        if (query.action) where.action = query.action;
        if (query.category) where.category = query.category;
        if (query.targetType) where.targetType = query.targetType;
        if (query.targetId) where.targetId = String(query.targetId);
        if (query.severity) where.severity = query.severity;
        if (query.search)
          where.OR = ['actorName', 'targetName', 'targetId', 'requestId'].map((field) => ({
            [field]: { contains: query.search, mode: 'insensitive' },
          }));
        const sortable = new Set([
          'createdAt',
          'action',
          'category',
          'severity',
          'actorName',
          'targetType',
        ]);
        const sortBy = sortable.has(String(query.sortBy)) ? query.sortBy : 'createdAt';
        const orderBy = {
          [sortBy || 'createdAt']: query.sortOrder === 'asc' ? 'asc' : 'desc',
        };
        const [data, total] = await Promise.all([
          await this.prisma.auditLog.findMany({
            where,
            orderBy,
            skip: (page - 1) * limit,
            take: limit,
          }),
          await this.prisma.auditLog.count({ where }),
        ]);
        return { data, total, page, limit, lastPage: Math.ceil(total / limit) };
      },
    );
  }

  async findById(id: string) {
    const version = await this.cache.getVersion(AUDIT_LOG_CACHE_VERSION_KEY);
    const key = this.cache.buildKey(AUDIT_LOG_CACHE.ITEM_NAMESPACE, version, id);
    return this.cache.getOrSet(
      key,
      {
        ttlSeconds: AUDIT_LOG_CACHE.ITEM_TTL_SECONDS,
        earlyRefreshWindowSeconds: AUDIT_LOG_CACHE.EARLY_REFRESH_SECONDS,
      },
      async () => {
        return this.prisma.auditLog.findUnique({ where: { id } });
      },
    );
  }

  async findEntityHistory(targetType: string, targetId: string, query: AuditLogQueryDto) {
    const version = await this.cache.getVersion(AUDIT_LOG_CACHE_VERSION_KEY);
    const key = this.cache.buildHashedKey(AUDIT_LOG_CACHE.HISTORY_NAMESPACE, {
      version,
      targetType,
      targetId,
      query,
    });
    return this.cache.getOrSet(
      key,
      {
        ttlSeconds: AUDIT_LOG_CACHE.HISTORY_TTL_SECONDS,
        earlyRefreshWindowSeconds: AUDIT_LOG_CACHE.EARLY_REFRESH_SECONDS,
      },
      async () => this.findMany({ ...query, targetType, targetId }),
    );
  }
}
