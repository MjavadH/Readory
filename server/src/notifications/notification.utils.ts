import { BadRequestException } from '@nestjs/common';
import { createHash } from 'crypto';

export const MAX_TITLE_LENGTH = 120;
export const MAX_BODY_LENGTH = 1000;
const SAFE_ACTION_URL = /^\/(?!\/)[\w\-/?.=&%#]*$/;

export function sanitizeText(value: string, field: string, max: number) {
  const trimmed = (value ?? '').trim().replace(/[<>]/g, '');
  if (!trimmed) throw new BadRequestException(`${field} is required`);
  if (trimmed.length > max)
    throw new BadRequestException(`${field} is too long`);
  return trimmed;
}
export function validateActionUrl(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length > 512 || !SAFE_ACTION_URL.test(trimmed))
    throw new BadRequestException('actionUrl must be a safe internal path');
  return trimmed;
}
export function compactMetadata(input?: Record<string, unknown> | null) {
  if (!input) return undefined;
  const allowed: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(input).slice(0, 20)) {
    if (!/^[a-zA-Z0-9_.-]{1,40}$/.test(key)) continue;
    if (
      value === null ||
      ['string', 'number', 'boolean'].includes(typeof value)
    )
      allowed[key] = value as any;
  }
  if (JSON.stringify(allowed).length > 2048)
    throw new BadRequestException('metadata is too large');
  return allowed;
}
export function dedupeKey(parts: Array<string | number>) {
  return createHash('sha256').update(parts.join(':')).digest('hex');
}
export function encodeCursor(createdAt: Date, id: string) {
  return Buffer.from(
    JSON.stringify({ createdAt: createdAt.toISOString(), id }),
  ).toString('base64url');
}
export function decodeCursor(cursor?: string) {
  if (!cursor) return null;
  try {
    const v = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    return typeof v.id === 'string' && typeof v.createdAt === 'string'
      ? v
      : null;
  } catch {
    return null;
  }
}
