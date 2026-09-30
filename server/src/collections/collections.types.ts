import type { CollectionType, CollectionVisibility } from '@prisma/client';

/** The authenticated caller, resolved once in the controller. */
export interface Actor {
  id: number;
  isAdmin: boolean;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: number | null;
}

/** What a book card inside a collection needs */
export interface BookCard {
  id: number;
  slug: string;
  title: string;
  coverImage: string | null;
  contributors: string | null;
  ratingAvg: number;
  ratingCount: number;
  type: { name: string; slug: string };
  genres: Array<{ name: string; slug: string }>;
}

/** Minimal book link — enough to route straight to the book page via `getBookUrl`. */
export interface BookLink {
  id: number;
  slug: string;
  title: string;
  type: { slug: string };
}

/** Card in public lists. `covers` feeds the cover mosaic (max 4). */
export interface CollectionCard {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  featured: boolean;
  bookCount: number;
  updatedAt: string;
  covers: string[];
  singleBook?: BookLink;
}

/** Card for the owner / admin: adds state the public does not need. */
export interface OwnedCollectionCard extends CollectionCard {
  type: CollectionType;
  visibility: CollectionVisibility;
  locked: boolean;
}

/** "My collections" card. `containsBook`/`itemId` are present only when `bookId` was requested. */
export interface MyCollectionCard extends OwnedCollectionCard {
  containsBook?: boolean;
  itemId?: number | null;
}

export interface CollectionMeta {
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
}

export interface CollectionItemView {
  id: number;
  note: string | null;
  addedAt: string;
  book: BookCard;
}

export interface CollectionDetail extends CollectionMeta {
  items: CollectionItemView[];
  nextCursor: number | null;
}

export interface UserCollectionDetail extends CollectionDetail {
  isOwner: boolean;
}

export interface AddedItem {
  id: number;
  bookId: number;
  note: string | null;
  addedAt: string;
  bookCount: number;
}
