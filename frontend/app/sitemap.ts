import type { MetadataRoute } from 'next';
import { apiClient } from '@/lib/api-client';
import { absoluteUrl } from '@/lib/seo';
import type { BookBrowserApi, BookGenre, PublicBookType } from '@/lib/types';
import { getBookUrl } from '@/lib/types';

// TODO: adjust this to endpoint actually lists full catalog.
// Paging through /books/browse works but is inefficient for a large library —
// most APIs are better served by a dedicated lightweight "list everything"
// endpoint for sitemap generation.
async function getAllBookUrls(): Promise<MetadataRoute.Sitemap> {
  const urls: MetadataRoute.Sitemap = [];
  let cursor: string | undefined;

  do {
    const params = new URLSearchParams({ limit: '30' });
    if (cursor) params.set('cursor', cursor);

    const page = await apiClient.get<BookBrowserApi>(`/books/browse?${params.toString()}`);

    for (const book of page.items ?? []) {
      urls.push({
        url: absoluteUrl(getBookUrl(book)),
        lastModified: book.updatedAt ? new Date(book.updatedAt) : undefined,
        changeFrequency: 'weekly',
        priority: 0.7,
      });
    }

    cursor = page.hasMore ? page.nextCursor : undefined;
  } while (cursor);

  return urls;
}

// Points at the *dedicated* /genres/[slug] and /[type] pages (not
// /books?genres=x query variants) — those are the canonical URLs for a
// single genre/type, per resolveBooksCanonical() in app/books/page.tsx.
async function getFilterLandingUrls(): Promise<MetadataRoute.Sitemap> {
  const [genres, types] = await Promise.all([
    apiClient.get<BookGenre[]>('/genres/listAll'),
    apiClient.get<PublicBookType[]>('/public/book-types'),
  ]);

  const genreUrls: MetadataRoute.Sitemap = genres.map((genre) => ({
    url: absoluteUrl(`/genres/${genre.slug}`),
    changeFrequency: 'daily',
    priority: 0.6,
  }));

  const typeUrls: MetadataRoute.Sitemap = types.map((type) => ({
    url: absoluteUrl(`/${type.slug}`),
    changeFrequency: 'daily',
    priority: 0.6,
  }));

  return [...genreUrls, ...typeUrls];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [bookUrls, filterUrls] = await Promise.all([getAllBookUrls(), getFilterLandingUrls()]);

  return [
    { url: absoluteUrl('/'), changeFrequency: 'daily', priority: 1 },
    { url: absoluteUrl('/books'), changeFrequency: 'daily', priority: 0.9 },
    { url: absoluteUrl('/genres'), changeFrequency: 'weekly', priority: 0.8 },
    ...filterUrls,
    ...bookUrls,
  ];
}
