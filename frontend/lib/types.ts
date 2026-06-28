import type { IconKey } from "@readory/shared";

export interface BookType {
  id: number;
  name: string;
  slug: string;
  iconKey: IconKey | null;
  isActive: boolean;
  sortOrder: number;
}

export interface BookGenre {
  name: string;
  slug: string;
  iconKey?: IconKey;
}

export type BookStatus =
  | "UPCOMING"
  | "ONGOING"
  | "COMPLETED"
  | "HIATUS"
  | "CANCELLED";
export type AgeRating = "GENERAL" | "TEEN" | "MATURE" | "ADULT";

export interface BookCardData {
  id: number;
  slug?: string;
  title: string;
  originalTitle?: string | null;
  alternativeTitles?: string[];
  status?: BookStatus;
  publicationYear?: number | null;
  translators?: string[];
  lastContentUpdate?: string | null;
  ageRating?: AgeRating | null;
  coverImage: string;
  type: BookType;
  author?: string;
  description?: string;
  ratingAvg?: number;
  ratingCount?: number;
  genres?: BookGenre[];
  isFeatured?: boolean;
  isPublished?: boolean;
  chapterCount?: number;
  updatedAt?: string;
}

export interface UserProfile {
  id: number;
  username: string;
  email: string;
  avatar?: string;
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
  type: "CREDIT" | "DEBIT";
  reference?: string;
  createdAt: string;
}

export interface ReadingProgress {
  book: {
    id: number;
    title: string;
    author: string;
    coverImage: string;
    type: { slug: string; iconKey?: IconKey };
  };
  chapter: {
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
  if (typeof type !== "string") {
    return type.name;
  }
  return type
    .replace(/-/g, "_")
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Generates the URL for a book based on its type and id/slug.
 */
export function getBookUrl(
  book: Pick<BookCardData, "id" | "slug" | "type">,
): string {
  const typeSlug = book.type.slug;
  const identifier = book.slug ?? book.id;
  return `/${typeSlug}/${identifier}`;
}

export type SortOption =
  | "newest"
  | "oldest"
  | "most_popular"
  | "recently_updated";

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "recently_updated", label: "Recently Updated" },
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "most_popular", label: "Most Popular" },
];
