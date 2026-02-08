"use client";

import useSWR from "swr";
import { GenreBookRow } from "@/components/genre-book-row";
import { AllGenresSection } from "@/components/all-genres-section";
import { GenresPageSkeleton } from "@/components/genres-page-skeleton";

interface ApiFeaturedGenre {
    id: number;
    name: string;
    slug: string;
    books: Array<{
        id: number;
        title: string;
        coverImage: string;
        author: string | null;
        type: {
            id: number;
            name: string;
            slug: string;
        };
        ratingAvg: number | null;
        ratingCount: number;
    }>;
}

interface GenresPageResponse {
    featured: ApiFeaturedGenre[];
    allGenres: Array<{ id: number; name: string; slug: string }>;
}

const fetcher = (url: string) =>
    fetch(url).then((res) => {
        if (!res.ok) throw new Error("Failed to load genres");
        return res.json() as Promise<GenresPageResponse>;
    });

export default function GenresPage() {
    const { data, error, isLoading } = useSWR<GenresPageResponse>(
        `${process.env.NEXT_PUBLIC_API_BASE}/public/genres`,
        fetcher,
    );

    const featured = data?.featured ?? [];
    const allGenres = data?.allGenres ?? [];

    return (
        <main className="min-h-screen bg-background">
            {/* Page header */}
            <div className="mx-auto max-w-7xl px-4 pt-8 pb-2 sm:px-6 sm:pt-10 lg:px-8">
                <h1 className="text-2xl font-bold text-foreground sm:text-3xl lg:text-4xl text-balance">
                    Genres
                </h1>
                <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed sm:text-base">
                    Discover books by category across manga, manhwa, comics, and novels
                </p>
            </div>

            {/* Featured genre sections */}
            <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                {isLoading && <GenresPageSkeleton />}

                {error && !isLoading && (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-center">
                        <p className="text-sm text-destructive">
                            {error instanceof Error ? error.message : "Failed to load genres"}
                        </p>
                        <button
                            type="button"
                            onClick={() => window.location.reload()}
                            className="mt-3 text-xs font-medium text-primary underline-offset-4 hover:underline"
                        >
                            Try again
                        </button>
                    </div>
                )}

                {!isLoading && !error && (
                    <div className="flex flex-col gap-10 sm:gap-12">
                        {featured.map((genre) => (
                            <GenreBookRow key={genre.id} genre={genre} />
                        ))}
                    </div>
                )}
            </div>

            {/* All Genres */}
            {!isLoading && !error && allGenres.length > 0 && (
                <AllGenresSection genres={allGenres} />
            )}
        </main>
    );
}
