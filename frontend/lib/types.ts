import type { IconKey } from "@readory/shared"

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

export interface BookCardData {
    id: number;
    slug?: string;
    title: string;
    coverImage: string;
    type: BookType;
    author?: string;
    description?: string;
    ratingAvg?: number;
    ratingCount?: number;
    genres?: BookGenre[];
    isFeatured?: boolean;
    chapterCount?: number;
    updatedAt?: string;
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
export function getBookUrl(book: Pick<BookCardData, "id" | "slug" | "type">): string {
    const typeSlug = book.type.slug;
    const identifier = book.slug ?? book.id;
    return `/${typeSlug}/${identifier}`;
}

export type SortOption = "newest" | "oldest" | "most_popular" | "recently_updated";

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
    { value: "recently_updated", label: "Recently Updated" },
    { value: "newest", label: "Newest" },
    { value: "oldest", label: "Oldest" },
    { value: "most_popular", label: "Most Popular" },
];
