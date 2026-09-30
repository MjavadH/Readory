import { absoluteUrl, getSiteUrl, SITE_NAME } from './seo';
import type { BookCardData } from './types';
import { getBookUrl } from './types';

export interface BreadcrumbItem {
  /** Display name for this crumb. */
  name: string;
  /** Site-relative path, e.g. '/books' or '/genres/fantasy'. */
  path: string;
}

export interface BooksListJsonLdOptions {
  /** Human name for this collection, e.g. "Fantasy Books". */
  collectionName: string;
  /** Absolute canonical URL this listing lives at (or canonicalizes to). */
  canonicalUrl: string;
  /**
   * Crumb trail for this page, NOT including Home — Home is always
   * prepended. E.g. [{ name: 'Genres', path: '/genres' }, { name: 'Fantasy', path: '/genres/fantasy' }].
   */
  breadcrumb: BreadcrumbItem[];
}

function breadcrumbList(trail: BreadcrumbItem[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: [{ name: 'Home', path: '/' }, ...trail].map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

/** Shared Book -> ListItem mapping used by every listing page's JSON-LD. */
function bookListItem(book: BookCardData, position: number) {
  const url = absoluteUrl(getBookUrl(book));
  return {
    '@type': 'ListItem',
    position,
    url,
    item: {
      '@type': 'Book',
      name: book.title,
      url,
      ...(book.contributors && {
        author: { '@type': 'Person', name: book.contributors },
      }),
      ...(book.coverImage && { image: book.coverImage }),
      ...(book.genres?.length && { genre: book.genres.map((g) => g.name) }),
      ...(book.ratingAvg &&
        book.ratingCount && {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: book.ratingAvg,
            ratingCount: book.ratingCount,
            bestRating: 5,
          },
        }),
    },
  };
}

/**
 * Builds JSON-LD (BreadcrumbList + CollectionPage + ItemList of Book) for any
 * books-listing page: the main /books browse page, a /genres/[slug] page, or
 * a /[type] page. Pass the books actually present in the server-rendered
 * HTML — this describes what's really there, not items appended later via
 * infinite scroll.
 */
export function buildBooksListJsonLd(
  books: BookCardData[],
  { collectionName, canonicalUrl, breadcrumb }: BooksListJsonLdOptions,
) {
  const collectionPage = {
    '@type': 'CollectionPage',
    name: collectionName,
    url: canonicalUrl,
    isPartOf: {
      '@type': 'WebSite',
      name: SITE_NAME,
      url: getSiteUrl(),
    },
  };

  const itemList = {
    '@type': 'ItemList',
    itemListElement: books.map((book, index) => bookListItem(book, index + 1)),
  };

  return {
    '@context': 'https://schema.org',
    '@graph': [breadcrumbList(breadcrumb), collectionPage, itemList],
  };
}

export interface FeaturedGenreForJsonLd {
  name: string;
  slug: string;
  books: BookCardData[];
}

export interface GenreSummary {
  name: string;
  slug: string;
}

/**
 * Builds JSON-LD for the /genres index page: BreadcrumbList, the
 * CollectionPage itself, an ItemList linking to every genre (a clean
 * discovery signal separate from the sitemap), and one ItemList of books per
 * featured genre row, since those books are genuinely visible on the page.
 */
export function buildGenresIndexJsonLd(
  allGenres: GenreSummary[],
  featuredGenres: FeaturedGenreForJsonLd[],
) {
  const collectionPage = {
    '@type': 'CollectionPage',
    name: 'Browse Genres',
    url: absoluteUrl('/genres'),
    isPartOf: {
      '@type': 'WebSite',
      name: SITE_NAME,
      url: getSiteUrl(),
    },
  };

  const genreIndex = {
    '@type': 'ItemList',
    name: 'All Genres',
    itemListElement: allGenres.map((genre, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: genre.name,
      url: absoluteUrl(`/genres/${genre.slug}`),
    })),
  };

  const featuredBookLists = featuredGenres
    .filter((genre) => genre.books.length > 0)
    .map((genre) => ({
      '@type': 'ItemList',
      name: `${genre.name} Books`,
      url: absoluteUrl(`/genres/${genre.slug}`),
      itemListElement: genre.books.map((book, index) => bookListItem(book, index + 1)),
    }));

  return {
    '@context': 'https://schema.org',
    '@graph': [
      breadcrumbList([{ name: 'Genres', path: '/genres' }]),
      collectionPage,
      genreIndex,
      ...featuredBookLists,
    ],
  };
}

/**
 * Builds JSON-LD for a single user-curated/system collection page
 * (`/collections/[slug]`): BreadcrumbList + CollectionPage + ItemList of the
 * books actually loaded on the page.
 */
export function buildCollectionJsonLd(collection: {
  title: string;
  description?: string | null;
  slug: string;
  updatedAt: string;
  bookCount: number;
  items: Array<{ book: BookCardData }>;
}) {
  const canonicalUrl = absoluteUrl(`/collections/${collection.slug}`);

  const collectionPage = {
    '@type': 'CollectionPage',
    name: collection.title,
    description: collection.description || undefined,
    url: canonicalUrl,
    dateModified: collection.updatedAt,
    isPartOf: {
      '@type': 'WebSite',
      name: SITE_NAME,
      url: getSiteUrl(),
    },
  };

  const itemList = {
    '@type': 'ItemList',
    numberOfItems: collection.bookCount,
    itemListElement: collection.items.map((entry, index) => bookListItem(entry.book, index + 1)),
  };

  return {
    '@context': 'https://schema.org',
    '@graph': [
      breadcrumbList([
        { name: 'Collections', path: '/collections' },
        { name: collection.title, path: `/collections/${collection.slug}` },
      ]),
      collectionPage,
      itemList,
    ],
  };
}

/**
 * Safely serializes a JSON-LD object for a <script> tag. Escapes `<` so a
 * value containing "</script>" (e.g. a book title) can't break out of the
 * script tag.
 */
export function jsonLdScript(data: unknown): { __html: string } {
  return { __html: JSON.stringify(data).replace(/</g, '\\u003c') };
}
