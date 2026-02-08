export type BookType = "MANGA" | "MANHWA" | "COMIC" | "NOVEL" | "LIGHT_NOVEL";

export interface BookGenre {
    id: number;
    name: string;
    slug: string;
}

export interface BookCardData {
    /** Required: Unique identifier for the book */
    id: number;
    /** Future-proof: slug will replace id for URLs */
    slug?: string;
    /** Required: Book title */
    title: string;
    /** Required: Cover image URL (vertical/portrait) */
    coverImage: string;
    /** Optional: Book type determines the URL prefix and badge */
    type?: BookType;
    /** Optional: Author name */
    author?: string;
    /** Optional: Short description */
    description?: string;
    /** Optional: Average rating (0-5, decimal) */
    ratingAvg?: number;
    /** Optional: Total number of ratings */
    ratingCount?: number;
    /** Optional: List of genres */
    genres?: BookGenre[];
    /** Optional: Whether the book is featured */
    isFeatured?: boolean;
    /** Optional: Total chapter count */
    chapterCount?: number;
    /** Optional: Last Update */
    updatedAt?: string;
}

/**
 * Converts a BookType enum value to a URL-friendly path segment.
 * e.g. MANGA -> "manga", LIGHT_NOVEL -> "light-novel"
 */
export function bookTypeToSlug(type: BookType): string {
    return type.toLowerCase().replace(/_/g, "-");
}

/**
 * Returns a human-readable label for a BookType.
 * e.g. LIGHT_NOVEL -> "Light Novel"
 */
export function bookTypeLabel(type: BookType): string {
    return type
        .split("_")
        .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
        .join(" ");
}

/**
 * Generates the URL for a book based on its type and id/slug.
 */
export function getBookUrl(book: Pick<BookCardData, "id" | "slug" | "type">): string {
    const typeSlug = book.type ? bookTypeToSlug(book.type) : "book";
    const identifier = book.slug ?? book.id;
    return `/${typeSlug}/${identifier}`;
}

export const BOOK_TYPES: { value: BookType; label: string }[] = [
    { value: "MANGA", label: "Manga" },
    { value: "MANHWA", label: "Manhwa" },
    { value: "COMIC", label: "Comic" },
    { value: "NOVEL", label: "Novel" },
    { value: "LIGHT_NOVEL", label: "Light Novel" },
];

export type SortOption = "newest" | "oldest" | "most_popular" | "recently_updated";

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
    { value: "recently_updated", label: "Recently Updated" },
    { value: "newest", label: "Newest" },
    { value: "oldest", label: "Oldest" },
    { value: "most_popular", label: "Most Popular" },
];