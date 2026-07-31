import {
  AuditAction,
  AuditCategory,
  AuditSeverity,
} from '@readory/shared';

export interface AuditActorSnapshot {
  id?: number | string | null;
  name?: string | null;
  role?: string | null;
}
export interface AuditRequestContext {
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}
export interface AuditDiffEntry {
  path: string;
  label: string;
  type: 'added' | 'removed' | 'modified' | 'unchanged';
  before?: unknown;
  after?: unknown;
  children?: AuditDiffEntry[];
  collapsed?: boolean;
}
export interface AuditLogInput {
  action: AuditAction;
  category: AuditCategory;
  severity?: AuditSeverity;
  actorId?: string | number | null;
  actorName?: string | null;
  actorRole?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
  targetType?: string | null;
  targetId?: string | number | null;
  targetName?: string | null;
  metadata?: unknown;
  before?: unknown;
  after?: unknown;
}
export interface AuditLogDecoratorOptions {
  action: AuditAction;
  category: AuditCategory;
  severity?: AuditSeverity;
  targetType?: string;
  targetIdParam?: string;
  getTargetId?: (
    result: unknown,
    request: any,
  ) => string | number | null | undefined;
  getTargetName?: (result: unknown, request: any) => string | null | undefined;
  adminOnly?: boolean;
}
