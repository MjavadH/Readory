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
