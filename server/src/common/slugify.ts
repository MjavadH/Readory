/**
 * Converts a string to a URL-friendly slug.
 *
 * Preserves Unicode letters and numbers while normalizing separators.
 */
export function slugify(input: string): string {
  return input
    .normalize('NFKC')
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
