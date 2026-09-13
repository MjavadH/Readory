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
  const trail: BreadcrumbItem[] = [{ name: 'Home', path: '/' }, ...breadcrumb];

  const breadcrumbList = {
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };

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
    itemListElement: books.map((book, index) => {
      const url = absoluteUrl(getBookUrl(book));
      return {
        '@type': 'ListItem',
        position: index + 1,
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
    }),
  };

  return {
    '@context': 'https://schema.org',
    '@graph': [breadcrumbList, collectionPage, itemList],
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
