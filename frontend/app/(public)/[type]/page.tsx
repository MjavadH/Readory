import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { apiClient } from '@/lib/api-client';
import { absoluteUrl, buildBooksCanonical, SITE_NAME, shouldNoIndexBooks } from '@/lib/seo';
import { buildBooksListJsonLd, jsonLdScript } from '@/lib/structured-data';
import type { BookBrowserApi, BookGenre, PublicBookType } from '@/lib/types';
import TypeClient from './TypeClient';

type SearchParams = Record<string, string | string[] | undefined>;

function formatTypeTitle(slug: string): string {
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function resolveTypeName(typeSlug: string, types: PublicBookType[]): string {
  return types.find((type) => type.slug === typeSlug)?.name ?? formatTypeTitle(typeSlug);
}

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
 * Cached per-request so generateMetadata and the page component share one
 * set of network calls instead of fetching the same data twice. If the type
 * slug doesn't exist, this triggers a 404 before anything renders
 */
const getInitialTypeData = cache(async (typeSlug: string, searchParams: SearchParams) => {
  const query = toQueryString(searchParams);
  try {
    const [books, genres, types] = await Promise.all([
      apiClient.get<BookBrowserApi>(`/books/type/${typeSlug}/browse?${query}`),
      apiClient.get<BookGenre[]>('/genres/listAll'),
      apiClient.get<PublicBookType[]>('/public/book-types'),
    ]);
    return { books, genres, types };
  } catch (err) {
    if (getErrorStatus(err) === 404) notFound();
    throw err;
  }
});

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>;
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const { type: typeSlug } = await params;
  const resolvedSearchParams = await searchParams;
  const { types } = await getInitialTypeData(typeSlug, resolvedSearchParams);

  const typeName = resolveTypeName(typeSlug, types);
  const canonical = buildBooksCanonical(`/${typeSlug}`, resolvedSearchParams);
  const noIndex = shouldNoIndexBooks(resolvedSearchParams);

  const title = `Browse ${typeName} | ${SITE_NAME}`;
  const description = `Browse our full catalog of ${typeName.toLowerCase()}. Filter by genre and rating to find your next read on ${SITE_NAME}.`;
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

export default async function TypePage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { type: typeSlug } = await params;
  const resolvedSearchParams = await searchParams;
  const { books, genres, types } = await getInitialTypeData(typeSlug, resolvedSearchParams);

  const typeName = resolveTypeName(typeSlug, types);
  const canonical = buildBooksCanonical(`/${typeSlug}`, resolvedSearchParams);

  const jsonLd = buildBooksListJsonLd(books.items ?? [], {
    collectionName: `Browse ${typeName}`,
    canonicalUrl: canonical,
    breadcrumb: [{ name: typeName, path: `/${typeSlug}` }],
  });

  return (
    <>
      {/** biome-ignore lint: JSON-LD requires dangerouslySetInnerHTML */}
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(jsonLd)} />
      <TypeClient typeSlug={typeSlug} typeName={typeName} initialData={{ books, genres }} />
    </>
  );
}
