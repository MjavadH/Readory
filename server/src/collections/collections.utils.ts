import { Prisma } from '@prisma/client';
import { normalizeSlug } from '../common';
import type { CursorPage } from './collections.types';

export const clampLimit = (
  limit: number | undefined,
  range: { readonly default: number; readonly max: number },
): number => Math.min(Math.max(limit ?? range.default, 1), range.max);

export const toSlug = (value: string): string => normalizeSlug(value) || value;

/** undefined = "not provided" (leave unchanged); '' / null = clear the value. */
export const blankToNull = (value: string | null | undefined): string | null | undefined =>
  value === undefined ? undefined : value?.trim() || null;

export const isPrismaError = (
  error: unknown,
  code: string,
): error is Prisma.PrismaClientKnownRequestError =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;

export const toPage = <Row extends { id: number }, T>(
  rows: Row[],
  limit: number,
  map: (row: Row) => T,
): CursorPage<T> => {
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  return {
    items: page.map(map),
    nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
  };
};
