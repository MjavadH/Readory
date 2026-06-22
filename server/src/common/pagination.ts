import { clampInt } from './numbers.js';

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

/**
 * Normalizes pagination parameters with safe clamping.
 */
export function normalizePagination(
  page: number,
  limit: number,
  maxLimit: number,
  defaultLimit = 20,
): PaginationParams {
  const pageSafe = clampInt(page, 1, 1_000_000, 1);
  const limitSafe = clampInt(limit, 1, maxLimit, defaultLimit);
  const skip = (pageSafe - 1) * limitSafe;
  return { page: pageSafe, limit: limitSafe, skip };
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  lastPage: number;
}

/**
 * Computes pagination metadata for a result set.
 */
export function paginationMeta(total: number, page: number, limit: number) {
  return {
    total,
    page,
    lastPage: Math.max(1, Math.ceil(total / limit)),
  };
}
