import { PublicationStatus } from '@readory/shared';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AppIcon } from '@/components/AppIcon';
import type { BookDetailsData } from '@/components/book-details';
import { Breadcrumb, buildBreadcrumbJsonLd } from '@/components/breadcrumb';
import type { ChaptersSectionChapter } from '@/components/chapters-section';
import { apiClient } from '@/lib/api-client';
import { getBookCoverThumbnailUrl } from '@/lib/media';
import { jsonLdScript } from '@/lib/structured-data';
import { type BookCardData, getBookUrl } from '@/lib/types';
import { BookDetailsPageClient } from './book-details-page-client';

// ---------------------------------------------------------------------------
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://example.com').replace(/\/$/, '');
const CHAPTERS_PER_PAGE = 36;
const REVALIDATE_SECONDS = 300;

type PageParams = { type: string; id: string };
type PageProps = { params: Promise<PageParams> };

type ChaptersResponse = {
  items: ChaptersSectionChapter[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

function parseBookId(idParam: string | undefined): number {
  const rawIdPart = idParam?.split('-')[0] ?? '';
  return Number(decodeURIComponent(rawIdPart));
}

async function fetchBook(bookId: number): Promise<BookDetailsData | null> {
  try {
    return await apiClient.get<BookDetailsData>(`/books/${bookId}`, {
      next: { revalidate: REVALIDATE_SECONDS, tags: [`book:${bookId}`] },
    });
  } catch {
    return null;
  }
}

async function fetchChapters(bookId: number): Promise<ChaptersResponse | null> {
  try {
    return await apiClient.get<ChaptersResponse>(`/books/${bookId}/chapters`, {
      query: { page: 1, limit: CHAPTERS_PER_PAGE, q: '', order: 'asc', publishStatus: 'PUBLISHED' },
      next: { revalidate: REVALIDATE_SECONDS, tags: [`book:${bookId}:chapters`] },
    });
  } catch {
    return null;
  }
}

async function fetchRelatedBooks(bookId: number): Promise<{ items: BookCardData[] } | null> {
  try {
    return await apiClient.get<{ items: BookCardData[] }>(`/books/${bookId}/related`, {
      query: { limit: 12 },
      next: { revalidate: REVALIDATE_SECONDS },
    });
  } catch {
    return null;
  }
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const clipped = text.slice(0, maxLength - 1);
  const lastSpace = clipped.lastIndexOf(' ');
  return `${clipped.slice(0, lastSpace > 0 ? lastSpace : maxLength - 1)}…`;
}

function absoluteUrl(path: string): string {
  return path.startsWith('http') ? path : `${SITE_URL}${path}`;
}

function getAuthorNames(book: BookDetailsData): string[] {
  return (book.contributors ?? [])
    .filter((c) => c.role === 'AUTHOR' || c.role === 'WRITER')
    .map((c) => c.name);
}

// Metadata (title, description, canonical, Open Graph, Twitter, robots)
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { type: typeSlug, id: idParam } = await params;
  const bookId = parseBookId(idParam);

  if (!Number.isInteger(bookId) || bookId <= 0) {
    return {};
  }

  const book = await fetchBook(bookId);

  if (!book || book.type.slug !== typeSlug) {
    return {};
  }

  const canonicalPath = getBookUrl(book);
  const canonicalUrl = absoluteUrl(canonicalPath);
  const coverPath = book.coverImage
    ? getBookCoverThumbnailUrl(book.coverImage)
    : '/placeholder.svg';
  const coverUrl = absoluteUrl(coverPath);

  const authorNames = getAuthorNames(book);
  const authorSuffix = authorNames.length > 0 ? ` by ${authorNames.join(', ')}` : '';
  const title = `${book.title}${authorSuffix} — Read Online | ${book.type.name}`;

  const rawDescription = book.description?.trim();
  const fallbackDescription = `Read ${book.title}${authorSuffix} online. ${book.chapterCount} chapters${
    book.genres.length ? ` in ${book.genres.map((g) => g.name).join(', ')}` : ''
  }.`;
  const description = truncate(rawDescription || fallbackDescription, 160);

  const isDraft = book.publishStatus === PublicationStatus.DRAFT;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    robots: isDraft
      ? { index: false, follow: false }
      : {
          index: true,
          follow: true,
          googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
        },
    openGraph: {
      type: 'book',
      title,
      description,
      url: canonicalUrl,
      images: [{ url: coverUrl, width: 600, height: 900, alt: `Cover of ${book.title}` }],
      authors: authorNames,
      releaseDate: book.publicationYear ? `${book.publicationYear}-01-01` : undefined,
      tags: book.genres.map((g) => g.name),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [coverUrl],
    },
  };
}

// Structured data (JSON-LD)
function buildBookJsonLd(book: BookDetailsData, canonicalUrl: string, coverUrl: string) {
  const authorNames = getAuthorNames(book);

  return {
    '@context': 'https://schema.org',
    '@type': 'Book',
    name: book.title,
    alternateName: book.alternativeTitles?.filter(Boolean),
    description: book.description ?? undefined,
    image: coverUrl,
    url: canonicalUrl,
    genre: book.genres.map((g) => g.name),
    datePublished: book.publicationYear ? String(book.publicationYear) : undefined,
    author:
      authorNames.length > 0 ? authorNames.map((name) => ({ '@type': 'Person', name })) : undefined,
    aggregateRating:
      book.ratingCount > 0
        ? {
            '@type': 'AggregateRating',
            ratingValue: book.ratingAvg,
            ratingCount: book.ratingCount,
            bestRating: 5,
            worstRating: 1,
          }
        : undefined,
  };
}

// fetches once, renders JSON-LD + crawlable
// breadcrumb, then hands off to the interactive client component.
export default async function BookDetailsPage({ params }: PageProps) {
  const { type: typeSlug, id: idParam } = await params;
  const bookId = parseBookId(idParam);

  if (!Number.isInteger(bookId) || bookId <= 0 || !typeSlug) {
    notFound();
  }

  const book = await fetchBook(bookId);

  if (!book || book.type.slug !== typeSlug) {
    notFound();
  }

  const [chaptersData, relatedData] = await Promise.all([
    fetchChapters(bookId),
    fetchRelatedBooks(bookId),
  ]);

  const canonicalUrl = absoluteUrl(getBookUrl(book));
  const coverUrl = absoluteUrl(
    book.coverImage ? getBookCoverThumbnailUrl(book.coverImage) : '/placeholder.svg',
  );
  const breadcrumbItems = [
    {
      label: book.type.name,
      href: `/${book.type.slug}`,
      icon: <AppIcon name={book.type.iconKey} className="h-3.5 w-3.5" />,
    },
    { label: book.title, href: getBookUrl(book) },
  ];

  return (
    <>
      {/* Structured data: enables rich results (star ratings, breadcrumbs) in search */}
      <script
        type="application/ld+json"
        // biome-ignore lint: JSON-LD requires dangerouslySetInnerHTML
        dangerouslySetInnerHTML={jsonLdScript(buildBookJsonLd(book, canonicalUrl, coverUrl))}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint: JSON-LD requires dangerouslySetInnerHTML
        dangerouslySetInnerHTML={jsonLdScript(buildBreadcrumbJsonLd(breadcrumbItems, absoluteUrl))}
      />

      <Breadcrumb items={breadcrumbItems} />

      <BookDetailsPageClient
        key={book.id}
        initialBook={book}
        initialChapters={chaptersData?.items ?? []}
        initialChaptersTotal={chaptersData?.pagination.total ?? 0}
        initialChaptersTotalPages={chaptersData?.pagination.totalPages ?? 1}
        initialRelatedBooks={relatedData?.items ?? []}
      />
    </>
  );
}
