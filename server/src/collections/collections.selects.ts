import { Prisma } from '@prisma/client';

const COVER_PREVIEW_COUNT = 4;

export const BOOK_CARD_SELECT = {
  id: true,
  slug: true,
  title: true,
  coverImage: true,
  ratingAvg: true,
  ratingCount: true,
  type: { select: { name: true, slug: true } },
  genres: { select: { genre: { select: { name: true, slug: true } } } },
  contributors: {
    orderBy: { role: 'asc' },
    take: 1,
    select: { contributor: { select: { name: true } } },
  },
} satisfies Prisma.BookSelect;

/** Public list card. */
export const CARD_SELECT = {
  id: true,
  slug: true,
  title: true,
  description: true,
  featured: true,
  bookCount: true,
  updatedAt: true,
  items: {
    orderBy: { position: 'asc' },
    take: COVER_PREVIEW_COUNT,
    select: {
      book: {
        select: {
          id: true,
          slug: true,
          title: true,
          coverImage: true,
          type: { select: { slug: true } },
        },
      },
    },
  },
} satisfies Prisma.CollectionSelect;

/** Owner / admin list card. */
export const OWNED_CARD_SELECT = {
  ...CARD_SELECT,
  type: true,
  visibility: true,
  locked: true,
} satisfies Prisma.CollectionSelect;

/** Collection metadata without items (create/update responses, detail header). */
export const DETAIL_META_SELECT = {
  id: true,
  type: true,
  slug: true,
  title: true,
  description: true,
  visibility: true,
  featured: true,
  locked: true,
  bookCount: true,
  updatedAt: true,
} satisfies Prisma.CollectionSelect;

/** Metadata + ownerId, used for permission checks and cache invalidation. */
export const MANAGE_SELECT = {
  ...DETAIL_META_SELECT,
  ownerId: true,
} satisfies Prisma.CollectionSelect;

/**
 * Keyset pagination on the unique (collectionId, position) pair:
 * no cursor-row lookup and it survives deletion of the cursor item.
 */
export const detailSelect = (afterPosition: number | undefined, take: number) =>
  ({
    ...DETAIL_META_SELECT,
    items: {
      where: afterPosition === undefined ? undefined : { position: { gt: afterPosition } },
      orderBy: { position: 'asc' },
      take,
      select: {
        id: true,
        position: true,
        note: true,
        addedAt: true,
        book: { select: BOOK_CARD_SELECT },
      },
    },
  }) satisfies Prisma.CollectionSelect;
