/** Converts text into a Unicode-safe URL slug. */
export function slugify(text: string): string {
  return text
    .normalize('NFKC')
    .toLocaleLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
