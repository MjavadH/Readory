import { AuditAction, AuditCategory, AuditSeverity } from '../constants/audit-log.constants';

export class AuditLogQueryDto {
  page?: number = 1; limit?: number = 20; from?: string; to?: string; actorId?: string;
  action?: AuditAction; category?: AuditCategory; targetType?: string; targetId?: string; severity?: AuditSeverity;
  search?: string; sortBy?: 'createdAt' | 'action' | 'category' | 'severity' = 'createdAt'; sortOrder?: 'asc' | 'desc' = 'desc';
}
