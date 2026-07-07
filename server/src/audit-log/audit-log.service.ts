import { Injectable, Logger } from '@nestjs/common';
import { CacheManager } from '../cache/cache.manager';
import { AuditLogRepository } from './audit-log.repository';
import {
  AUDIT_LOG_CACHE,
  AUDIT_LOG_CACHE_VERSION_KEY,
} from './constants/audit-log.constants';
import { AuditLogInput } from './interfaces/audit-log.interface';
import { sanitizeAuditValue } from './utils/audit-sanitizer.util';
import { generateAuditDiff } from './utils/audit-diff.util';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';
import { inferAuditSeverity } from './utils/audit-severity.util';

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);
  constructor(
    private readonly repo: AuditLogRepository,
    private readonly cache: CacheManager,
  ) {}

  log(input: AuditLogInput): void {
    const safeBefore = sanitizeAuditValue(input.before);
    const safeAfter = sanitizeAuditValue(input.after);
    const payload = {
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

  private enqueueLogWrite(payload: AuditLogInput & { diff?: unknown }): void {
    setImmediate(
      () =>
        void this.repo
          .create(payload)
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
      () => this.repo.findMany(query),
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
      () => this.repo.findById(id),
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
      () => this.repo.findMany({ ...query, targetType, targetId }),
    );
  }
}
