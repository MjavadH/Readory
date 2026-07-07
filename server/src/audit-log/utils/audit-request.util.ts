import { randomUUID } from 'crypto';

export function ensureAuditRequestMetadata(req: any) {
  const requestId = String(
    req.headers?.['x-request-id'] ?? req.id ?? randomUUID(),
  );
  req.id = requestId;
  if (req.headers && !req.headers['x-request-id'])
    req.headers['x-request-id'] = requestId;
  const forwarded = req.headers?.['x-forwarded-for'];
  const ipAddress = Array.isArray(forwarded)
    ? forwarded[0]
    : String(forwarded ?? req.ip ?? req.socket?.remoteAddress ?? '')
        .split(',')[0]
        .trim();
  const userAgent = Array.isArray(req.headers?.['user-agent'])
    ? req.headers['user-agent'][0]
    : (req.headers?.['user-agent'] ?? 'unknown');
  return {
    requestId,
    ipAddress: ipAddress || 'unknown',
    userAgent: userAgent || 'unknown',
  };
}
