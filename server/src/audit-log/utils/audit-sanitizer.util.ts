const SENSITIVE_KEYS = [/password/i, /passwordHash/i, /token/i, /jwt/i, /secret/i, /apiKey/i, /otp/i, /credential/i, /refresh/i];
const IGNORED_KEYS = new Set(['updatedAt', 'version', 'cacheKey', 'computed']);
const MAX_STRING_LENGTH = 4000;
const MAX_ARRAY_ITEMS = 100;

export function sanitizeAuditValue(value: unknown, depth = 0): unknown {
  if (value == null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'string') return value.length > MAX_STRING_LENGTH ? `${value.slice(0, MAX_STRING_LENGTH)}…[truncated]` : value;
  if (depth > 8) return '[Max depth reached]';
  if (Array.isArray(value)) return value.slice(0, MAX_ARRAY_ITEMS).map((item) => sanitizeAuditValue(item, depth + 1));
  if (typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (IGNORED_KEYS.has(key)) continue;
      output[key] = SENSITIVE_KEYS.some((pattern) => pattern.test(key)) ? '[REDACTED]' : sanitizeAuditValue(child, depth + 1);
    }
    return output;
  }
  return String(value);
}
