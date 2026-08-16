/**
 * Normalizes a search query: trims and caps at 80 characters.
 * Returns undefined if the result is empty.
 */
export function normalizeQ(q?: string): string | undefined {
  const s = (q ?? '').trim();
  if (!s) return undefined;
  return s.length > 80 ? s.slice(0, 80) : s;
}

/**
 * Normalizes a slug string (trim + lowercase).
 */
export function normalizeSlug(input: string): string {
  return input.trim().toLowerCase();
}

const SAFE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Validates a slug-safe string.
 */
export function isValidSlug(value: string): boolean {
  return SAFE_SLUG_PATTERN.test(value);
}

/**
 * Normalizes and validates a slug.
 * Throws when input is invalid.
 */
export function normalizeAndValidateSlug(value: string): string {
  const slug = normalizeSlug(value);

  if (!isValidSlug(slug)) {
    throw new Error('Invalid slug format');
  }

  return slug;
}
