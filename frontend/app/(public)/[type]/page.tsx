"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter, useParams } from "next/navigation";
import { BookGrid, BookGridSkeleton } from "@/components/book-grid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Search, X, Filter, SlidersHorizontal } from "lucide-react";
import type { BookCardData, SortOption, BookGenre } from "@/lib/types";
import { SORT_OPTIONS } from "@/lib/types";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { apiClient } from "@/lib/api-client";

interface BrowseResponse {
    items: BookCardData[];
    nextCursor?: string;
    hasMore: boolean;
}

const arraysEqual = (a: string[], b: string[]) =>
    a.length === b.length && a.every((v, i) => v === b[i]);

const normalizeListParam = (v: string | null) =>
    (v ? v.split(",").map(s => s.trim()).filter(Boolean) : []);

// Convert slug to Title Case (e.g., "light-novel" -> "Light Novel")
const formatTypeTitle = (slug: string) => {
    return slug
        .split("-")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
};

export default function TypePage() {
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();

    const typeSlug = (Array.isArray(params.type) ? params.type[0] : params.type) || "";

    const [books, setBooks] = useState<BookCardData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [nextCursor, setNextCursor] = useState<string | undefined>();
    const [genres, setGenres] = useState<BookGenre[]>([]);
    const [isLoadingGenres, setIsLoadingGenres] = useState(true);

    const observerRef = useRef<IntersectionObserver | null>(null);
    const loadMoreRef = useRef<HTMLDivElement>(null);
    const abortRef = useRef<AbortController | null>(null);
    const lastPushedRef = useRef<string>("");

    const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
    const [sortBy, setSortBy] = useState<SortOption>("recently_updated");
    const [searchQuery, setSearchQuery] = useState("");
    const [searchInput, setSearchInput] = useState("");
    const [filtersOpen, setFiltersOpen] = useState(false);

    // Load genres
    useEffect(() => {
        const fetchGenres = async () => {
            try {
                const data = await apiClient.get<BookGenre[]>("/genres/listAll");
                setGenres(data);
            } catch (error) {
                console.error("Failed to fetch genres:", error);
            } finally {
                setIsLoadingGenres(false);
            }
        };

        void fetchGenres();
    }, []);

    // Initialize filters from URL params
    useEffect(() => {
        const genresFromUrl = normalizeListParam(searchParams.get("genres"));
        const sortFromUrl = (searchParams.get("sort") as SortOption) || "recently_updated";
        const qFromUrl = searchParams.get("q") || "";

        setSelectedGenres(prev => (arraysEqual(prev, genresFromUrl) ? prev : genresFromUrl));
        setSortBy(prev => (prev === sortFromUrl ? prev : sortFromUrl));
        setSearchQuery(prev => (prev === qFromUrl ? prev : qFromUrl));
        setSearchInput(prev => (prev === qFromUrl ? prev : qFromUrl));
    }, [searchParams]);

    // Build query params
    const buildQueryParams = useCallback(
        (cursor?: string) => {
            const params = new URLSearchParams();

            if (selectedGenres.length > 0) {
                params.set("genres", selectedGenres.join(","));
            }
            if (sortBy) {
                params.set("sort", sortBy);
            }
            if (searchQuery) {
                params.set("q", searchQuery);
            }
            if (cursor) {
                params.set("cursor", cursor);
            }
            params.set("limit", "24");

            return params.toString();
        },
        [selectedGenres, sortBy, searchQuery]
    );

    // Update URL when filters change
    const updateURL = useCallback(() => {
        const params = new URLSearchParams();

        if (selectedGenres.length > 0) params.set("genres", selectedGenres.join(","));
        if (sortBy !== "recently_updated") params.set("sort", sortBy);
        if (searchQuery) params.set("q", searchQuery);

        const queryString = params.toString();
        // Construct URL preserving the dynamic type segment
        const nextUrl = `/${typeSlug}${queryString ? `?${queryString}` : ""}`;

        if (lastPushedRef.current === nextUrl) return;
        lastPushedRef.current = nextUrl;

        router.push(nextUrl, { scroll: false });
    }, [selectedGenres, sortBy, searchQuery, router, typeSlug]);

    // Fetch books targeting the specific type endpoint
    const fetchBooks = useCallback(
        async (cursor?: string) => {
            if (!typeSlug) return;

            const isInitialLoad = !cursor;
            if (isInitialLoad) {
                setIsLoading(true);
            } else {
                setIsLoadingMore(true);
            }

            try {
                const queryParams = buildQueryParams(cursor);
                abortRef.current?.abort();
                abortRef.current = new AbortController();

                const data = await apiClient.get<BrowseResponse>(
                    `/books/type/${typeSlug}/browse?${queryParams}`,
                    { signal: abortRef.current.signal }
                );

                if (isInitialLoad) {
                    setBooks(data.items);
                } else {
                    setBooks((prev) => [...prev, ...data.items]);
                }

                setNextCursor(data.nextCursor);
                setHasMore(data.hasMore);
            } catch (error: any) {
                if (error?.name === "AbortError") return;
                console.error("Failed to fetch books:", error);
                if (isInitialLoad) {
                    setBooks([]);
                }
                setHasMore(false);
            } finally {
                if (isInitialLoad) {
                    setIsLoading(false);
                } else {
                    setIsLoadingMore(false);
                }
            }
        },
        [buildQueryParams, typeSlug]
    );

    useEffect(() => {
        setNextCursor(undefined);
        setHasMore(false);
        void fetchBooks(undefined);
    }, [selectedGenres, sortBy, searchQuery, fetchBooks]);

    useEffect(() => {
        updateURL();
    }, [selectedGenres, sortBy, searchQuery, updateURL]);

    // Infinite scroll setup
    useEffect(() => {
        if (observerRef.current) {
            observerRef.current.disconnect();
        }

        observerRef.current = new IntersectionObserver(
            (entries) => {
                const [entry] = entries;
                if (entry.isIntersecting && hasMore && !!nextCursor && !isLoadingMore) {
                    void fetchBooks(nextCursor);
                }
            },
            { threshold: 0.1, rootMargin: "100px" }
        );

        if (loadMoreRef.current) {
            observerRef.current.observe(loadMoreRef.current);
        }

        return () => {
            if (observerRef.current) {
                observerRef.current.disconnect();
            }
        };
    }, [hasMore, isLoadingMore, nextCursor, fetchBooks]);

    const handleGenreToggle = (slug: string) => {
        setSelectedGenres((prev) =>
            prev.includes(slug) ? prev.filter((g) => g !== slug) : [...prev, slug]
        );
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setSearchQuery(searchInput);
    };

    const clearFilters = () => {
        setSelectedGenres([]);
        setSortBy("recently_updated");
        setSearchQuery("");
        setSearchInput("");
    };

    const hasActiveFilters =
        selectedGenres.length > 0 ||
        searchQuery.trim().length > 0 ||
        sortBy !== "recently_updated";

    return (
        <div className="min-h-screen bg-background">
            <div className="container mx-auto px-4 py-6 md:py-8">
                {/* Header */}
                <div className="mb-6 md:mb-8">
                    <h1 className="text-balance text-3xl font-bold tracking-tight md:text-4xl">
                        Browse {formatTypeTitle(typeSlug)}
                    </h1>
                    <p className="mt-2 text-pretty text-muted-foreground">
                        Discover your next favorite {formatTypeTitle(typeSlug)}
                    </p>
                </div>

                {/* Filters Bar */}
                <div className="mb-6 space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row">
                        {/* Search */}
                        <form onSubmit={handleSearch} className="flex flex-1 gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    type="search"
                                    placeholder="Search by title or author..."
                                    value={searchInput}
                                    onChange={(e) => setSearchInput(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                            <Button type="submit" variant="secondary">
                                Search
                            </Button>
                        </form>

                        {/* Sort */}
                        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                            <SelectTrigger className="w-full sm:w-[200px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {SORT_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {/* Mobile Filters Button */}
                        <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
                            <SheetTrigger asChild>
                                <Button variant="outline" className="sm:hidden bg-transparent">
                                    <SlidersHorizontal className="mr-2 h-4 w-4" />
                                    Filters
                                    {hasActiveFilters && (
                                        <Badge variant="secondary" className="ml-2 h-5 min-w-5 px-1">
                                            {selectedGenres.length}
                                        </Badge>
                                    )}
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="left" className="w-80 overflow-y-auto">
                                <SheetHeader>
                                    <SheetTitle>Filters</SheetTitle>
                                </SheetHeader>
                                <div className="mt-6 space-y-6">
                                    <FiltersContent
                                        selectedGenres={selectedGenres}
                                        genres={genres}
                                        isLoadingGenres={isLoadingGenres}
                                        onGenreToggle={handleGenreToggle}
                                    />
                                </div>
                            </SheetContent>
                        </Sheet>
                    </div>

                    {/* Active Filters Pills */}
                    {hasActiveFilters && (
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm text-muted-foreground">Active filters:</span>
                            {selectedGenres.map((slug) => {
                                const genre = genres.find((g) => g.slug === slug);
                                return genre ? (
                                    <Badge
                                        key={slug}
                                        variant="secondary"
                                        className="gap-1 pl-2 pr-1"
                                    >
                                        {genre.name}
                                        <button
                                            type="button"
                                            onClick={() => handleGenreToggle(slug)}
                                            className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </Badge>
                                ) : null;
                            })}
                            {searchQuery && (
                                <Badge variant="secondary" className="gap-1 pl-2 pr-1">
                                    Search: {searchQuery}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSearchQuery("");
                                            setSearchInput("");
                                        }}
                                        className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </Badge>
                            )}
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={clearFilters}
                                className="h-7"
                            >
                                Clear all
                            </Button>
                        </div>
                    )}
                </div>

                {/* Desktop Filters Sidebar + Content */}
                <div className="flex gap-6">
                    <aside className="hidden w-64 shrink-0 sm:block">
                        <div className="sticky top-6 rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
                            <div className="mb-4 flex items-center justify-between">
                                <h2 className="flex items-center gap-2 text-lg font-semibold">
                                    <Filter className="h-5 w-5" />
                                    Filters
                                </h2>
                                {hasActiveFilters && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={clearFilters}
                                        className="h-8 text-xs"
                                    >
                                        Clear
                                    </Button>
                                )}
                            </div>
                            <FiltersContent
                                selectedGenres={selectedGenres}
                                genres={genres}
                                isLoadingGenres={isLoadingGenres}
                                onGenreToggle={handleGenreToggle}
                            />
                        </div>
                    </aside>

                    <main className="flex-1">
                        {isLoading ? (
                            <BookGridSkeleton count={24} />
                        ) : books.length === 0 ? (
                            <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
                                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                                    <Search className="h-8 w-8 text-muted-foreground" />
                                </div>
                                <h3 className="mt-4 text-lg font-semibold">No books found</h3>
                                <p className="mt-2 text-pretty text-sm text-muted-foreground">
                                    Try adjusting your filters or search query
                                </p>
                                {hasActiveFilters && (
                                    <Button
                                        variant="outline"
                                        onClick={clearFilters}
                                        className="mt-4 bg-transparent"
                                    >
                                        Clear filters
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <>
                                <BookGrid books={books} priorityCount={6} />

                                {hasMore && (
                                    <div ref={loadMoreRef} className="mt-8 flex justify-center">
                                        {isLoadingMore && <BookGridSkeleton count={12} />}
                                    </div>
                                )}

                                {!hasMore && books.length > 0 && (
                                    <p className="mt-8 text-center text-sm text-muted-foreground">
                                        You've reached the end of the list
                                    </p>
                                )}
                            </>
                        )}
                    </main>
                </div>
            </div>
        </div>
    );
}

interface FiltersContentProps {
    selectedGenres: string[];
    genres: BookGenre[];
    isLoadingGenres: boolean;
    onGenreToggle: (slug: string) => void;
}

function FiltersContent({
                            selectedGenres,
                            genres,
                            isLoadingGenres,
                            onGenreToggle,
                        }: FiltersContentProps) {
    return (
        <div className="space-y-6">
            <div>
                <h3 className="mb-3 text-sm font-semibold">Genres</h3>
                {isLoadingGenres ? (
                    <div className="space-y-2">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div
                                key={i}
                                className="h-5 animate-pulse rounded bg-muted"
                            />
                        ))}
                    </div>
                ) : (
                    <div className="max-h-[400px] space-y-2 overflow-y-auto pr-2">
                        {genres.map((genre) => (
                            <div key={genre.slug} className="flex items-center space-x-2">
                                <Checkbox
                                    id={`genre-${genre.slug}`}
                                    checked={selectedGenres.includes(genre.slug)}
                                    onCheckedChange={() => onGenreToggle(genre.slug)}
                                />
                                <Label
                                    htmlFor={`genre-${genre.slug}`}
                                    className="cursor-pointer text-sm font-normal"
                                >
                                    {genre.name}
                                </Label>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
