import type { AgeRating, BookStatus, IconKey, PublicationStatus } from '@readory/shared';

export interface BookType {
  id: number;
  name: string;
  slug: string;
  iconKey: IconKey | null;
  isActive: boolean;
  sortOrder: number;
}

export interface PublicBookType {
  id: number;
  name: string;
  slug: string;
  iconKey?: IconKey | null;
}

export interface BookGenre {
  id?: number;
  name: string;
  slug: string;
  iconKey?: IconKey;
}

export interface BookCardData {
  id: number;
  slug?: string;
  title: string;
  originalTitle?: string | null;
  alternativeTitles?: string[];
  coverImage: string;
  type: BookType;
  contributors?: string;
  description?: string;
  ratingAvg?: number;
  ratingCount?: number;
  genres?: BookGenre[];
  isFeatured?: boolean;
  publishStatus?: PublicationStatus;
  status?: BookStatus;
  ageRating?: AgeRating | null;
  publicationYear?: number | null;
  chapterCount?: number;
  lastContentUpdate?: string | null;
  updatedAt?: string;
}

export interface BooksPageData {
  books: BookBrowserApi;
  types: PublicBookType[];
  genres: BookGenre[];
}

export interface BookBrowserApi {
  allGenres?: BookGenre[];
  genre?: BookGenre;
  items: BookCardData[];
  nextCursor?: string;
  hasMore?: boolean;
}

export interface UserProfile {
  id: number;
  username: string;
  email: string;
  avatarKey?: string | null;
}

export interface LibraryItem {
  book: BookCardData;
  purchasedChapters: number;
  totalChapters: number;
  purchasedPercent: number;
  lastPurchasedAt: string;
}

export interface Transaction {
  id: number;
  amount: number;
  type: 'CREDIT' | 'DEBIT';
  reference?: string;
  createdAt: string;
}

export interface ReadingProgress {
  book: {
    id: number;
    title: string;
    contributors: string;
    coverImage: string;
    type: { slug: string; iconKey?: IconKey };
  };
  chapter: {
    id: number;
    title: string;
    index: number;
    pageCount: number;
  };
  progress: {
    lastPage: number;
    percent: number;
  };
  lastReadAt: string;
}

export interface DashboardOverview {
  profile: UserProfile;
  wallet: {
    balance: number;
  };
  recentTransactions: {
    data: Transaction[];
    total: number;
    hasMore: boolean;
  };
  continueReading: ReadingProgress | null;
  recentLibrary: {
    data: LibraryItem[];
  };
}

export interface LibraryResponse {
  data: LibraryItem[];
  total: number;
  page: number;
  lastPage: number;
}

export interface FavoriteBooksResponse {
  data: BookCardData[];
  total: number;
  page: number;
  lastPage: number;
}

export interface ReadingProgressResponse {
  data: ReadingProgress[];
  total: number;
  page: number;
  lastPage: number;
}

export interface HistoryResponse {
  balance: number;
  data: Transaction[];
  total: number;
  totals: { deposits: number; withdrawals: number };
  page: number;
  lastPage: number;
  hasMore: boolean;
}

/**
 * Returns a human-readable label for a BookType.
 * e.g. LIGHT_NOVEL -> "Light Novel"
 */
export function bookTypeLabel(type: BookType | string): string {
  if (typeof type !== 'string') {
    return type.name;
  }
  return type
    .replace(/-/g, '_')
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Generates the URL for a book based on its type and id/slug.
 */
export function getBookUrl(book: Pick<BookCardData, 'id' | 'slug' | 'type'>): string {
  const typeSlug = book.type.slug;
  const identifier = book.slug ?? book.id;
  return `/${typeSlug}/${identifier}`;
}

export type SortOption = 'newest' | 'oldest' | 'most_popular' | 'recently_updated' | 'trend';

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'recently_updated', label: 'Recently Updated' },
  { value: 'most_popular', label: 'Most Popular' },
  { value: 'trend', label: 'Trend' },
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
];

export type CollectionType = 'SYSTEM' | 'USER' | 'FAVORITES';
export type CollectionVisibility = 'PUBLIC' | 'PRIVATE' | 'UNLISTED';

export interface CollectionItemData {
  id: number;
  position: number;
  note?: string | null;
  addedAt: string;
  book: BookCardData;
}

export interface CollectionSummary {
  id: number;
  ownerId?: number | null;
  type: CollectionType;
  title: string;
  slug: string;
  description?: string | null;
  visibility: CollectionVisibility;
  allowIndexing: boolean;
  featured: boolean;
  locked: boolean;
  bookCount: number;
  indexable: boolean;
  createdAt: string;
  updatedAt: string;
  items: CollectionItemData[];
}
