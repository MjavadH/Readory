import type { BookCardData, CollectionSummary } from '@/lib/types';

export type PublicCollection = {
  id: number;
  title: string;
  slug: string;
  description?: string | null;
  bookCount: number;
  updatedAt: string;
  featured?: boolean;
  previewBooks: BookCardData[];
};

export type RatingEntry = { rating: number; ratedAt: string; book: BookCardData };
export type ReadingEntry = { percent: number; lastReadAt: string; book: BookCardData };

export type PublicProfile = {
  user: {
    id: number;
    username: string;
    avatarKey?: string | null;
    memberSince?: string | null;
  };
  viewer: { isOwner: boolean };
  sections: {
    collections: PublicCollection[];
    favoriteBooks?: BookCardData[];
    recentRatings?: RatingEntry[];
    recentlyReading?: ReadingEntry[];
  };
};

export function toCollectionSummary(
  collection: PublicCollection,
  ownerId: number,
): CollectionSummary {
  return {
    ...collection,
    ownerId,
    items: collection.previewBooks.map((book) => ({ book })),
  } as unknown as CollectionSummary;
}
