export const AUDIT_LOG_METADATA_KEY = Symbol('AUDIT_LOG_METADATA');
export const AUDIT_LOG_CACHE = {
  VERSION_KEY: 'audit_log:version',
  LIST_NAMESPACE: 'audit_log:list',
  ITEM_NAMESPACE: 'audit_log:item',
  HISTORY_NAMESPACE: 'audit_log:history',
  LIST_TTL_SECONDS: 30,
  ITEM_TTL_SECONDS: 120,
  HISTORY_TTL_SECONDS: 60,
  EARLY_REFRESH_SECONDS: 5,
} as const;
export const AUDIT_LOG_CACHE_VERSION_KEY = AUDIT_LOG_CACHE.VERSION_KEY;
