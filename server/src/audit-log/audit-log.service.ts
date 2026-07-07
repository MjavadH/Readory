import { Injectable, Logger } from '@nestjs/common';
import { CacheManager } from '../cache/cache.manager';
import { AuditLogRepository } from './audit-log.repository';
import { AUDIT_LOG_CACHE_VERSION_KEY, AuditSeverity } from './constants/audit-log.constants';
import { AuditLogInput } from './interfaces/audit-log.interface';
import { sanitizeAuditValue } from './utils/audit-sanitizer.util';
import { generateAuditDiff } from './utils/audit-diff.util';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);
  constructor(private readonly repo: AuditLogRepository, private readonly cache: CacheManager) {}

  log(input: AuditLogInput): void {
    const safeBefore = sanitizeAuditValue(input.before);
    const safeAfter = sanitizeAuditValue(input.after);
    const payload = { ...input, severity: input.severity ?? AuditSeverity.INFO, actorId: input.actorId == null ? null : String(input.actorId), targetId: input.targetId == null ? null : String(input.targetId), metadata: sanitizeAuditValue(input.metadata) as any, before: safeBefore as any, after: safeAfter as any, diff: generateAuditDiff(safeBefore, safeAfter) as any };
    setImmediate(() => void this.repo.create(payload).then(() => this.cache.bumpVersion(AUDIT_LOG_CACHE_VERSION_KEY)).catch((error: Error) => this.logger.error(`Audit log write failed: ${error.message}`, error.stack)));
  }

  async findMany(query: AuditLogQueryDto) {
    const version = await this.cache.getVersion(AUDIT_LOG_CACHE_VERSION_KEY);
    const key = this.cache.buildHashedKey('audit_log:list', { version, query });
    return this.cache.getOrSet(key, { ttlSeconds: 30, earlyRefreshWindowSeconds: 5 }, () => this.repo.findMany(query));
  }

  async findById(id: string) {
    const version = await this.cache.getVersion(AUDIT_LOG_CACHE_VERSION_KEY);
    const key = this.cache.buildKey('audit_log:item', version, id);
    return this.cache.getOrSet(key, { ttlSeconds: 120, earlyRefreshWindowSeconds: 15 }, () => this.repo.findById(id));
  }
}
