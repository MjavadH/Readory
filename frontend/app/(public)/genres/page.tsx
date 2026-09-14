import type { Metadata } from 'next';
import { apiClient } from '@/lib/api-client';
import { absoluteUrl, SITE_NAME } from '@/lib/seo';
import { buildGenresIndexJsonLd, jsonLdScript } from '@/lib/structured-data';
import type { BookCardData } from '@/lib/types';
import GenresPageClient from './GenresClient';
import type { GenresPageResponse } from './genres-types';

const title = `Browse Genres | ${SITE_NAME}`;
const description = `Explore books by genre on ${SITE_NAME} — from fantasy and romance to sci-fi and mystery. Find your next favorite read.`;
const canonical = absoluteUrl('/genres');
const ogImage = absoluteUrl('/og/genres.png');

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical },
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

function toBookCardData(
  book: GenresPageResponse['featured'][number]['books'][number],
): BookCardData {
  return {
    id: book.id,
    title: book.title,
    coverImage: book.coverImage,
    type: book.type,
    contributors: book.contributors ?? undefined,
    ratingAvg: book.ratingAvg ?? undefined,
    ratingCount: book.ratingCount,
  };
}

export default async function GenresPage() {
  const data = await apiClient.get<GenresPageResponse>('/public/genres');

  const jsonLd = buildGenresIndexJsonLd(
    data.allGenres,
    data.featured.map((genre) => ({
      name: genre.name,
      slug: genre.slug,
      books: genre.books.map(toBookCardData),
    })),
  );

  return (
    <>
      {/** biome-ignore lint: JSON-LD requires dangerouslySetInnerHTML */}
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(jsonLd)} />
      <GenresPageClient initialData={data} />
    </>
  );
}
