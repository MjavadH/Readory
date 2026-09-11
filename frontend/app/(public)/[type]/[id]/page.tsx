import { PublicationStatus } from '@readory/shared';
import { ChevronRight, Home } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppIcon } from '@/components/AppIcon';
import type { BookDetailsData } from '@/components/book-details';
import type { ChaptersSectionChapter } from '@/components/chapters-section';
import { apiClient } from '@/lib/api-client';
import { getBookCoverThumbnailUrl } from '@/lib/media';
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

function buildBreadcrumbJsonLd(book: BookDetailsData, canonicalUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') },
      {
        '@type': 'ListItem',
        position: 2,
        name: book.type.name,
        item: absoluteUrl(`/${book.type.slug}`),
      },
      { '@type': 'ListItem', position: 3, name: book.title, item: canonicalUrl },
    ],
  };
}

/** Escapes `<` so JSON-LD can't be broken out of by a `</script>` in user content. */
function safeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
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

  return (
    <>
      {/* Structured data: enables rich results (star ratings, breadcrumbs) in search */}
      <script
        type="application/ld+json"
        // biome-ignore lint: JSON-LD requires dangerouslySetInnerHTML
        dangerouslySetInnerHTML={{
          __html: safeJsonLd(buildBookJsonLd(book, canonicalUrl, coverUrl)),
        }}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint: JSON-LD requires dangerouslySetInnerHTML
        dangerouslySetInnerHTML={{ __html: safeJsonLd(buildBreadcrumbJsonLd(book, canonicalUrl)) }}
      />

      <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
        <nav aria-label="Breadcrumb" className="min-w-0">
          <ol className="flex min-w-0 flex-nowrap items-center gap-1 overflow-x-auto rounded-full border border-border bg-background/70 px-2 py-1.5 text-sm shadow-sm backdrop-blur-md scrollbar-none sm:gap-1.5 sm:px-3">
            <li className="shrink-0">
              <Link
                href="/"
                className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Home className="h-3.5 w-3.5" aria-hidden />
                <span className="hidden sm:inline">Home</span>
                <span className="sr-only sm:hidden">Home</span>
              </Link>
            </li>

            <li aria-hidden className="shrink-0 text-muted-foreground/40">
              <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
            </li>

            <li className="shrink-0">
              <Link
                href={`/${book.type.slug}`}
                className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 font-medium text-primary transition-colors hover:bg-primary/15"
              >
                <AppIcon name={book.type.iconKey} className="h-3.5 w-3.5" />
                {book.type.name}
              </Link>
            </li>

            <li aria-hidden className="shrink-0 text-muted-foreground/40">
              <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
            </li>

            <li aria-current="page" className="min-w-0">
              <span className="block truncate px-2.5 py-1 font-semibold text-foreground">
                {book.title}
              </span>
            </li>
          </ol>
        </nav>
      </div>

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
