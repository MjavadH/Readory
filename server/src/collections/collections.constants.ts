import { CollectionType } from '@prisma/client';

const intFromEnv = (name: string, fallback: number): number => {
  const value = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

export const loadCollectionLimits = () => ({
  /** Max USER collections a single user can own (FAVORITES is not counted). */
  userCollections: intFromEnv('USER_COLLECTION_LIMIT', 25),
  /** Max books inside one collection, per collection type. */
  booksPerCollection: {
    [CollectionType.USER]: intFromEnv('USER_COLLECTION_BOOK_LIMIT', 100),
    [CollectionType.FAVORITES]: intFromEnv('FAVORITES_BOOK_LIMIT', 500),
    [CollectionType.SYSTEM]: intFromEnv('SYSTEM_COLLECTION_BOOK_LIMIT', 500),
  } satisfies Record<CollectionType, number>,
});

export const PAGINATION = {
  /** Collection cards (public system list / admin list). */
  list: { default: 24, max: 48 },
  /** Books inside a collection detail page. */
  items: { default: 48, max: 100 },
} as const;

/** Safety net for the "my collections" list (it is not paginated). */
export const MY_COLLECTIONS_HARD_CAP = 200;

export const MAX_REORDER_ITEMS = 100;

export const FAVORITES_SLUG = 'favorites';

/** Slugs that collide with static routes or with the favorites collection. */
export const RESERVED_SLUGS = [FAVORITES_SLUG, 'mine', 'admin', 'system'] as const;

export const CACHE_TTL_SECONDS = 120;

export const CACHE_KEYS = {
  systemVersion: 'collections:system:version',
  systemList: 'collections:system:list',
  systemDetail: 'collections:system:detail',
  publicProfileVersion: (ownerId: number) => `public_profile:version:${ownerId}`,
} as const;

/** Namespace for pg_advisory_xact_lock(int, int) used to serialize per-user collection creation. */
export const USER_COLLECTIONS_LOCK_NAMESPACE = 7101;
