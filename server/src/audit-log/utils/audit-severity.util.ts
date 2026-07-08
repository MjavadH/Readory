import { AuditAction, AuditSeverity } from '@readory/shared';

export function inferAuditSeverity(
  action: AuditAction,
  override?: AuditSeverity,
): AuditSeverity {
  if (override) return override;
  if (
    [
      AuditAction.USER_BANNED,
      AuditAction.USER_PERMISSIONS_UPDATED,
      AuditAction.STAFF_DELETED,
    ].includes(action)
  )
    return AuditSeverity.CRITICAL;
  if (action.endsWith('_DELETED')) return AuditSeverity.HIGH;
  if (action.endsWith('_UPDATED') || action === AuditAction.USER_UNBANNED)
    return AuditSeverity.MEDIUM;
  if (
    action.endsWith('_CREATED') ||
    action.endsWith('_UPLOADED') ||
    action === AuditAction.BROADCAST_SENT
  )
    return AuditSeverity.LOW;
  return AuditSeverity.MEDIUM;
}
