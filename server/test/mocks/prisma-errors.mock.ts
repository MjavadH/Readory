import { Prisma } from '@prisma/client';

/**
 * Builds a genuine `PrismaClientKnownRequestError` rather than a plain object
 * with a `code` property. Services frequently branch on `err instanceof
 * Prisma.PrismaClientKnownRequestError` as well as on `err.code`, so a fake
 * shape would let a broken guard pass.
 */
export function knownRequestError(
  code: string,
  options: { message?: string; meta?: Record<string, unknown> } = {},
): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(options.message ?? `Prisma error ${code}`, {
    code,
    clientVersion: Prisma.prismaVersion.client,
    meta: options.meta,
  });
}

/** Unique-constraint violation. */
export function uniqueConstraintError(
  target: string[] = ['slug'],
): Prisma.PrismaClientKnownRequestError {
  return knownRequestError('P2002', {
    message: 'Unique constraint failed',
    meta: { target },
  });
}

/** Record-not-found violation (e.g. update/delete against a missing row). */
export function recordNotFoundError(): Prisma.PrismaClientKnownRequestError {
  return knownRequestError('P2025', { message: 'Record to update not found' });
}

/** Foreign-key constraint violation. */
export function foreignKeyError(field = 'bookId'): Prisma.PrismaClientKnownRequestError {
  return knownRequestError('P2003', {
    message: 'Foreign key constraint failed',
    meta: { field_name: field },
  });
}
