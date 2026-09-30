import { CollectionType, CollectionVisibility, Prisma } from '@prisma/client';
import {
  BOOK_CARD_SELECT,
  CARD_SELECT,
  DETAIL_META_SELECT,
  detailSelect,
  OWNED_CARD_SELECT,
} from './collections.selects';
import type {
  BookCard,
  CollectionCard,
  CollectionDetail,
  CollectionMeta,
  OwnedCollectionCard,
} from './collections.types';

type BookRow = Prisma.BookGetPayload<{ select: typeof BOOK_CARD_SELECT }>;
type CardRow = Prisma.CollectionGetPayload<{ select: typeof CARD_SELECT }>;
type OwnedCardRow = Prisma.CollectionGetPayload<{ select: typeof OWNED_CARD_SELECT }>;
type MetaRow = Prisma.CollectionGetPayload<{ select: typeof DETAIL_META_SELECT }>;
type DetailRow = Prisma.CollectionGetPayload<{ select: ReturnType<typeof detailSelect> }>;

/** Only PUBLIC system collections are indexed. User & favorites collections never are. */
export const isIndexable = (type: CollectionType, visibility: CollectionVisibility): boolean =>
  type === CollectionType.SYSTEM && visibility === CollectionVisibility.PUBLIC;

export const toBookCard = (book: BookRow): BookCard => ({
  id: book.id,
  slug: book.slug,
  title: book.title,
  coverImage: book.coverImage,
  contributors: book.contributors[0]?.contributor.name ?? null,
  ratingAvg: book.ratingAvg.toNumber(),
  ratingCount: book.ratingCount,
  type: book.type,
  genres: book.genres.map(({ genre }) => genre),
});

export const toCard = (row: CardRow): CollectionCard => ({
  id: row.id,
  slug: row.slug,
  title: row.title,
  description: row.description,
  featured: row.featured,
  bookCount: row.bookCount,
  updatedAt: row.updatedAt.toISOString(),
  covers: row.items.flatMap(({ book }) => (book.coverImage ? [book.coverImage] : [])),
  singleBook:
    row.bookCount === 1 && row.items[0]
      ? {
          id: row.items[0].book.id,
          slug: row.items[0].book.slug,
          title: row.items[0].book.title,
          type: row.items[0].book.type,
        }
      : undefined,
});

export const toOwnedCard = (row: OwnedCardRow): OwnedCollectionCard => ({
  ...toCard(row),
  type: row.type,
  visibility: row.visibility,
  locked: row.locked,
});

export const toMeta = (row: MetaRow): CollectionMeta => ({
  id: row.id,
  type: row.type,
  slug: row.slug,
  title: row.title,
  description: row.description,
  visibility: row.visibility,
  featured: row.featured,
  locked: row.locked,
  bookCount: row.bookCount,
  updatedAt: row.updatedAt.toISOString(),
  indexable: isIndexable(row.type, row.visibility),
});

/** `row.items` was fetched with `take: limit + 1`; the extra row only signals "has more". */
export const toDetail = (row: DetailRow, limit: number): CollectionDetail => {
  const hasMore = row.items.length > limit;
  const page = hasMore ? row.items.slice(0, limit) : row.items;
  return {
    ...toMeta(row),
    items: page.map((item) => ({
      id: item.id,
      note: item.note,
      addedAt: item.addedAt.toISOString(),
      book: toBookCard(item.book),
    })),
    nextCursor: hasMore ? (page[page.length - 1]?.position ?? null) : null,
  };
};
