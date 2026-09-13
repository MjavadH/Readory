export const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME ?? 'Readory';

export function getSiteUrl(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL;

  if (!url) {
    if (process.env.NODE_ENV === 'production') {
      console.warn(
        '[seo] NEXT_PUBLIC_SITE_URL is not set. Canonical URLs, Open Graph tags, ' +
          'and the sitemap will fall back to localhost, which is wrong in production.',
      );
    }
    return 'http://localhost:3000';
  }

  return url.replace(/\/+$/, '');
}

export function absoluteUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const base = getSiteUrl();
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

type SearchParams = Record<string, string | string[] | undefined>;

const CANONICAL_PARAM_KEYS = ['types', 'genres'] as const;

/**
 * Normalizes a comma-separated filter value so equivalent filter sets always
 * produce the same string, regardless of the order the user clicked filters
 * in (e.g. "fantasy,scifi" and "scifi,fantasy" both canonicalize to
 * "fantasy,scifi"). Without this, every click order creates a distinct URL
 * that looks like duplicate content to search engines.
 */
function sortedCsv(value: string): string {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .sort()
    .join(',');
}

/**
 * Builds a stable canonical URL for the books browse page: keeps only the
 * filters that change content (types, genres), drops noise (sort, search
 * query, pagination cursor, limit), and normalizes value order.
 */
export function buildBooksCanonical(basePath: string, searchParams: SearchParams): string {
  const params = new URLSearchParams();

  for (const key of CANONICAL_PARAM_KEYS) {
    const value = searchParams[key];
    if (typeof value === 'string' && value.length > 0) {
      params.set(key, sortedCsv(value));
    }
  }

  const qs = params.toString();
  return absoluteUrl(`${basePath}${qs ? `?${qs}` : ''}`);
}

export function shouldNoIndexBooks(searchParams: SearchParams): boolean {
  const q = searchParams.q;
  return typeof q === 'string' && q.trim().length > 0;
}
