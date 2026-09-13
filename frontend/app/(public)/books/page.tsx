import type { Metadata } from 'next';
import { absoluteUrl, buildBooksCanonical, SITE_NAME, shouldNoIndexBooks } from '@/lib/seo';
import { buildBooksListJsonLd, jsonLdScript } from '@/lib/structured-data';
import BooksClient from './BooksClient';
import { getInitialBooksData } from './books-api';

type SearchParams = Record<string, string | string[] | undefined>;

function titleCaseSlug(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function firstGenreSlug(searchParams: SearchParams): string | undefined {
  const value = searchParams.genres;
  return typeof value === 'string' ? value.split(',')[0]?.trim() : undefined;
}

/**
 * /genres/[slug] and /[type] are dedicated pages for a single genre or type.
 * When /books is filtered down to exactly one of those (and nothing else),
 * it shows the same content as that dedicated page — so canonicalize to the
 * dedicated page instead of indexing /books?genres=x as a near-duplicate.
 * Compound filters (multiple genres, or genre+type together) have no
 * dedicated equivalent, so those canonicalize to themselves.
 */
function resolveBooksCanonical(searchParams: SearchParams): string {
  const types = typeof searchParams.types === 'string' ? searchParams.types : '';
  const genres = typeof searchParams.genres === 'string' ? searchParams.genres : '';

  const isSingleType = types.length > 0 && !types.includes(',') && genres.length === 0;
  const isSingleGenre = genres.length > 0 && !genres.includes(',') && types.length === 0;

  if (isSingleType) return absoluteUrl(`/${types}`);
  if (isSingleGenre) return absoluteUrl(`/genres/${genres}`);
  return buildBooksCanonical('/books', searchParams);
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const params = await searchParams;
  const canonical = resolveBooksCanonical(params);
  const noIndex = shouldNoIndexBooks(params);
  const genreSlug = firstGenreSlug(params);
  const genreLabel = genreSlug ? titleCaseSlug(genreSlug) : undefined;

  const title = genreLabel
    ? `${genreLabel} Books — Browse & Read Online | ${SITE_NAME}`
    : `Browse Books | ${SITE_NAME}`;

  const description = genreLabel
    ? `Discover ${genreLabel} books. Filter by format, genre and rating on ${SITE_NAME}.`
    : `Browse the full ${SITE_NAME} catalog of books. Filter by format, genre and rating to find your next read.`;

  const ogImage = absoluteUrl('/og/books.png');

  return {
    title,
    description,
    alternates: {
      canonical,
    },
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

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const resolvedSearchParams = await searchParams;
  const initialData = await getInitialBooksData(resolvedSearchParams);

  const genreSlug = firstGenreSlug(resolvedSearchParams);
  const genreLabel = genreSlug ? titleCaseSlug(genreSlug) : undefined;
  const canonical = resolveBooksCanonical(resolvedSearchParams);

  const jsonLd = buildBooksListJsonLd(initialData.books.items ?? [], {
    collectionName: genreLabel ? `${genreLabel} Books` : 'Browse Books',
    canonicalUrl: canonical,
    breadcrumb: [
      { name: 'Books', path: '/books' },
      ...(genreSlug ? [{ name: genreLabel as string, path: `/books?genres=${genreSlug}` }] : []),
    ],
  });

  return (
    <>
      {/* Reflects exactly the server-rendered first page of results below */}
      {/** biome-ignore lint: JSON-LD requires dangerouslySetInnerHTML */}
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(jsonLd)} />
      <BooksClient initialData={initialData} />
    </>
  );
}
