import { Injectable, Logger } from '@nestjs/common';
import { CacheManager } from '../cache/cache.manager';
import {
  AUDIT_LOG_CACHE,
  AUDIT_LOG_CACHE_VERSION_KEY,
} from './constants/audit-log.constants';
import { AuditLogInput } from './interfaces/audit-log.interface';
import { sanitizeAuditValue } from './utils/audit-sanitizer.util';
import { generateAuditDiff } from './utils/audit-diff.util';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';
import { inferAuditSeverity } from './utils/audit-severity.util';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

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
      metadata: sanitizeAuditValue(input.metadata) as any,
      before: safeBefore as any,
      after: safeAfter as any,
      diff: generateAuditDiff(safeBefore, safeAfter) as any,
    };
    this.enqueueLogWrite(payload);
  }

  private enqueueLogWrite(data: Prisma.AuditLogCreateInput): void {
    setImmediate(
      () =>
          this.prisma.auditLog.create({ data })
          .then(() => this.cache.bumpVersion(AUDIT_LOG_CACHE_VERSION_KEY))
          .catch((error: Error) =>
            this.logger.error(
              `Audit log write failed: ${error.message}`,
              error.stack,
            ),
          ),
    );
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
          where.OR = ['actorName', 'targetName', 'targetId', 'requestId'].map(
              (field) => ({
                [field]: { contains: query.search, mode: 'insensitive' },
              }),
          );
        const sortable = new Set([
          'createdAt',
          'action',
          'category',
          'severity',
          'actorName',
          'targetType',
        ]);
        const sortBy = sortable.has(String(query.sortBy))
            ? query.sortBy
            : 'createdAt';
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
      }
    );
  }

  async findById(id: string) {
    const version = await this.cache.getVersion(AUDIT_LOG_CACHE_VERSION_KEY);
    const key = this.cache.buildKey(
      AUDIT_LOG_CACHE.ITEM_NAMESPACE,
      version,
      id,
    );
    return this.cache.getOrSet(
      key,
      {
        ttlSeconds: AUDIT_LOG_CACHE.ITEM_TTL_SECONDS,
        earlyRefreshWindowSeconds: AUDIT_LOG_CACHE.EARLY_REFRESH_SECONDS,
      },
      async () => {
        return this.prisma.auditLog.findUnique({ where: { id } });
      }
    );
  }

  async findEntityHistory(
    targetType: string,
    targetId: string,
    query: AuditLogQueryDto,
  ) {
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
