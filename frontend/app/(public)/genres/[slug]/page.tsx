import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { apiClient } from '@/lib/api-client';
import { absoluteUrl, buildBooksCanonical, SITE_NAME, shouldNoIndexBooks } from '@/lib/seo';
import { buildBooksListJsonLd, jsonLdScript } from '@/lib/structured-data';
import type { PublicBookType } from '@/lib/types';
import GenreClient from './GenreClient';
import type { GenreBrowserApi } from './genre-types';

type SearchParams = Record<string, string | string[] | undefined>;

function toQueryString(searchParams: SearchParams): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === 'string') query.set(key, value);
  }
  return query.toString();
}

function getErrorStatus(err: unknown): number | undefined {
  const e = err as { status?: number; response?: { status?: number } };
  return e?.status ?? e?.response?.status;
}

/**
 * Cached per-request so generateMetadata and the page component share one set of network calls
 * If the slug doesn't exist, this triggers a 404 before anything renders.
 */
const getInitialGenreData = cache(async (slug: string, searchParams: SearchParams) => {
  const query = toQueryString(searchParams);
  try {
    const [books, types] = await Promise.all([
      apiClient.get<GenreBrowserApi>(`/public/genres/${slug}/browse?${query}`),
      apiClient.get<PublicBookType[]>('/public/book-types'),
    ]);
    return { books, types };
  } catch (err) {
    if (getErrorStatus(err) === 404) notFound();
    throw err;
  }
});

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;
  const { books } = await getInitialGenreData(slug, resolvedSearchParams);

  const genreName = books.genre?.name || slug;
  const canonical = buildBooksCanonical(`/genres/${slug}`, resolvedSearchParams);
  const noIndex = shouldNoIndexBooks(resolvedSearchParams);

  const title = `${genreName} Books — Browse & Read Online | ${SITE_NAME}`;
  const description = `Browse ${genreName.toLowerCase()} books. Filter by format and rating to find your next read on ${SITE_NAME}.`;
  const ogImage = absoluteUrl('/og/books.png');

  return {
    title,
    description,
    alternates: { canonical },
    robots: noIndex ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: SITE_NAME,
      type: 'website',
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function GenrePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;
  const { books, types } = await getInitialGenreData(slug, resolvedSearchParams);

  const genreName = books.genre?.name || slug;
  const canonical = buildBooksCanonical(`/genres/${slug}`, resolvedSearchParams);

  const jsonLd = buildBooksListJsonLd(books.items ?? [], {
    collectionName: `${genreName} Books`,
    canonicalUrl: canonical,
    breadcrumb: [
      { name: 'Genres', path: '/genres' },
      { name: genreName, path: `/genres/${slug}` },
    ],
  });

  return (
    <>
      {/** biome-ignore lint: JSON-LD requires dangerouslySetInnerHTML */}
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(jsonLd)} />
      <GenreClient slug={slug} genreName={genreName} initialData={{ books, types }} />
    </>
  );
}
