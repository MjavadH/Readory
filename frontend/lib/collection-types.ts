import type { BookCardData } from '@/lib/types';

export type CollectionVisibility = 'PUBLIC' | 'UNLISTED' | 'PRIVATE';
export const COLLECTION_SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type CollectionType = 'SYSTEM' | 'USER' | 'FAVORITES';

export type CollectionItem = {
  id: number;
  position: number;
  note?: string | null;
  addedAt?: string;
  book: BookCardData;
};

export type Collection = {
  id: number;
  ownerId: number | null;
  type: CollectionType;
  title: string;
  slug: string;
  description?: string | null;
  visibility: CollectionVisibility;
  allowIndexing: boolean;
  featured: boolean;
  locked: boolean;
  indexable?: boolean;
  bookCount: number;
  createdAt: string;
  updatedAt: string;
  items: CollectionItem[];
  containsBook?: boolean;
};

export type CollectionFormState = {
  title: string;
  slug: string;
  description: string;
  visibility: CollectionVisibility;
  featured: boolean;
  allowIndexing: boolean;
};

export const emptyCollectionForm: CollectionFormState = {
  title: '',
  slug: '',
  description: '',
  visibility: 'PUBLIC',
  featured: false,
  allowIndexing: true,
};

export const collectionToForm = (collection: Collection): CollectionFormState => ({
  title: collection.title,
  slug: collection.slug,
  description: collection.description ?? '',
  visibility: collection.visibility,
  featured: collection.featured,
  allowIndexing: collection.allowIndexing,
});
