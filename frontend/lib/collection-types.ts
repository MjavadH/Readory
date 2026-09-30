import type { BookCardData } from '@/lib/types';

export type CollectionVisibility = 'PUBLIC' | 'UNLISTED' | 'PRIVATE';
export const COLLECTION_SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type CollectionType = 'SYSTEM' | 'USER' | 'FAVORITES';

export type CollectionItem = {
  id: number;
  note: string | null;
  addedAt: string;
  book: BookCardData;
};

/** Card in public lists. `covers` feeds the cover mosaic (max 4). */
export type CollectionCard = {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  featured: boolean;
  bookCount: number;
  updatedAt: string;
  /** Up to 4 cover URLs, for the collage. */
  covers: string[];
  singleBook?: { id: number; slug: string; title: string; type: { slug: string } };
};

/** Owner/admin card: adds fields the public card doesn't need. */
export type OwnedCollectionCard = CollectionCard & {
  type: CollectionType;
  visibility: CollectionVisibility;
  locked: boolean;
};

/** "My collections" card, only present when the list was requested with `bookId`. */
export type MyCollectionCard = OwnedCollectionCard & {
  containsBook?: boolean;
  itemId?: number | null;
};

/** Full collection detail: metadata + a page of items. */
export type Collection = {
  id: number;
  type: CollectionType;
  slug: string;
  title: string;
  description: string | null;
  visibility: CollectionVisibility;
  featured: boolean;
  locked: boolean;
  bookCount: number;
  updatedAt: string;
  indexable: boolean;
  items: CollectionItem[];
  nextCursor: number | null;
  isOwner?: boolean;
};

export type CollectionFormState = {
  title: string;
  slug: string;
  description: string;
  visibility: CollectionVisibility;
  featured: boolean;
};

export const emptyCollectionForm: CollectionFormState = {
  title: '',
  slug: '',
  description: '',
  visibility: 'PUBLIC',
  featured: false,
};

export const collectionToForm = (collection: Collection): CollectionFormState => ({
  title: collection.title,
  slug: collection.slug,
  description: collection.description ?? '',
  visibility: collection.visibility,
  featured: collection.featured,
});
