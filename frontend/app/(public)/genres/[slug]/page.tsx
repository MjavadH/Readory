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
import type { BookCardData, BookType, SortOption, BookGenre } from "@/lib/types";
import { bookTypeLabel, SORT_OPTIONS } from "@/lib/types";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { apiClient } from "@/lib/api-client";
import { AllGenresSection } from "@/components/all-genres-section";

interface GenreBrowseResponse {
    genre: { id: number; name: string; slug: string };
    allGenres: BookGenre[];
    items: BookCardData[];
    nextCursor?: string;
}


const arraysEqual = (a: string[], b: string[]) =>
    a.length === b.length && a.every((v, i) => v === b[i]);

const normalizeListParam = (v: string | null) =>
    (v ? v.split(",").map(s => s.trim()).filter(Boolean) : []);

export default function GenrePage() {
    const router = useRouter();
    const { slug } = useParams() as { slug: string };
    const searchParams = useSearchParams();

    // Data state
    const [books, setBooks] = useState<BookCardData[]>([]);
    const [genreData, setGenreData] = useState<{ name: string } | null>(null);
    const [allGenres, setAllGenres] = useState<BookGenre[]>([]);
    const [bookTypes, setBookTypes] = useState<BookType[]>([]);

    // Loading state
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [isLoadingTypes, setIsLoadingTypes] = useState(true);
    const [hasMore, setHasMore] = useState(false);
    const [nextCursor, setNextCursor] = useState<string | undefined>();
    const [error, setError] = useState(false);

    // Refs
    const observerRef = useRef<IntersectionObserver | null>(null);
    const loadMoreRef = useRef<HTMLDivElement>(null);
    const abortRef = useRef<AbortController | null>(null);
    const lastPushedRef = useRef<string>("");

    // Filter states
    const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
    const [sortBy, setSortBy] = useState<SortOption>("recently_updated");
    const [searchQuery, setSearchQuery] = useState("");
    const [searchInput, setSearchInput] = useState("");
    const [filtersOpen, setFiltersOpen] = useState(false);

    // Load available book types for filtering
    useEffect(() => {
        const fetchTypes = async () => {
            try {
                const data = await apiClient.get<BookType[]>("/public/book-types");
                setBookTypes(data);
            } catch (err) {
                console.error("Failed to fetch book types:", err);
            } finally {
                setIsLoadingTypes(false);
            }
        };
        void fetchTypes();
    }, []);

    // Initialize filters from URL params
    useEffect(() => {
        const typesFromUrl = normalizeListParam(searchParams.get("types"));
        const sortFromUrl = (searchParams.get("sort") as SortOption) || "recently_updated";
        const qFromUrl = searchParams.get("q") || "";

        setSelectedTypes(prev => (arraysEqual(prev, typesFromUrl) ? prev : typesFromUrl));
        setSortBy(prev => (prev === sortFromUrl ? prev : sortFromUrl));
        setSearchQuery(prev => (prev === qFromUrl ? prev : qFromUrl));
        setSearchInput(prev => (prev === qFromUrl ? prev : qFromUrl));
    }, [searchParams]);

    // Build query params
    const buildQueryParams = useCallback(
        (cursor?: string) => {
            const params = new URLSearchParams();

            if (selectedTypes.length > 0) {
                params.set("types", selectedTypes.join(","));
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
        [selectedTypes, sortBy, searchQuery]
    );

    // Update URL when filters change
    const updateURL = useCallback(() => {
        const params = new URLSearchParams();

        if (selectedTypes.length > 0) params.set("types", selectedTypes.join(","));
        if (sortBy !== "recently_updated") params.set("sort", sortBy);
        if (searchQuery) params.set("q", searchQuery);

        const queryString = params.toString();
        // Using current slug in path
        const nextUrl = `/genres/${slug}${queryString ? `?${queryString}` : ""}`;

        if (lastPushedRef.current === nextUrl) return;
        lastPushedRef.current = nextUrl;

        router.push(nextUrl, { scroll: false });
    }, [selectedTypes, sortBy, searchQuery, router, slug]);

    // Fetch books by genre
    const fetchBooks = useCallback(
        async (cursor?: string) => {
            if (!slug) return;

            const isInitialLoad = !cursor;
            if (isInitialLoad) {
                setIsLoading(true);
                setError(false);
            } else {
                setIsLoadingMore(true);
            }

            try {
                const queryParams = buildQueryParams(cursor);
                abortRef.current?.abort();
                abortRef.current = new AbortController();

                // Hitting the genre browse endpoint
                const data = await apiClient.get<GenreBrowseResponse>(
                    `/public/genres/${slug}/browse?${queryParams}`,
                    { signal: abortRef.current.signal }
                );

                if (isInitialLoad) {
                    setBooks(data.items);
                    setGenreData(data.genre);
                    setAllGenres(data.allGenres);
                } else {
                    setBooks((prev) => [...prev, ...data.items]);
                }

                setNextCursor(data.nextCursor);
                // Backend service does not return hasMore explicitly in browseByGenre, derive it from cursor
                setHasMore(!!data.nextCursor);
            } catch (err: any) {
                if (err?.name === "AbortError") return;
                console.error("Failed to fetch genre books:", err);
                if (isInitialLoad) {
                    setBooks([]);
                    setError(true);
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
        [buildQueryParams, slug]
    );

    // Trigger fetch on filter change
    useEffect(() => {
        setNextCursor(undefined);
        setHasMore(false);
        void fetchBooks(undefined);
    }, [selectedTypes, sortBy, searchQuery, fetchBooks]);

    // Trigger URL update
    useEffect(() => {
        updateURL();
    }, [selectedTypes, sortBy, searchQuery, updateURL]);

    // Infinite scroll observer
    useEffect(() => {
        if (observerRef.current) observerRef.current.disconnect();

        observerRef.current = new IntersectionObserver(
            (entries) => {
                const [entry] = entries;
                if (entry.isIntersecting && hasMore && !!nextCursor && !isLoadingMore) {
                    void fetchBooks(nextCursor);
                }
            },
            { threshold: 0.1, rootMargin: "100px" }
        );

        if (loadMoreRef.current) observerRef.current.observe(loadMoreRef.current);

        return () => observerRef.current?.disconnect();
    }, [hasMore, isLoadingMore, nextCursor, fetchBooks]);

    // Handlers
    const handleTypeToggle = (type: string) => {
        setSelectedTypes((prev) =>
            prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
        );
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setSearchQuery(searchInput);
    };

    const clearFilters = () => {
        setSelectedTypes([]);
        setSortBy("recently_updated");
        setSearchQuery("");
        setSearchInput("");
    };

    const hasActiveFilters =
        selectedTypes.length > 0 ||
        searchQuery.trim().length > 0 ||
        sortBy !== "recently_updated";

    return (
        <div className="min-h-screen bg-background">
            <div className="container mx-auto px-4 py-6 md:py-8">
                {/* Header */}
                <div className="mb-6 md:mb-8">
                    {isLoading && !genreData ? (
                        <div className="h-10 w-48 animate-pulse rounded bg-muted" />
                    ) : (
                        <h1 className="text-balance text-3xl font-bold tracking-tight md:text-4xl">
                            {genreData?.name || "Genre"} Books
                        </h1>
                    )}
                    <p className="mt-2 text-pretty text-muted-foreground">
                        Explore our collection of {genreData?.name} books
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
                                    placeholder="Search within this genre..."
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

                        {/* Mobile Filters */}
                        <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
                            <SheetTrigger asChild>
                                <Button variant="outline" className="sm:hidden bg-transparent">
                                    <SlidersHorizontal className="mr-2 h-4 w-4" />
                                    Filters
                                    {selectedTypes.length > 0 && (
                                        <Badge variant="secondary" className="ml-2 h-5 min-w-5 px-1">
                                            {selectedTypes.length}
                                        </Badge>
                                    )}
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="left" className="w-80 overflow-y-auto">
                                <SheetHeader>
                                    <SheetTitle>Filters</SheetTitle>
                                </SheetHeader>
                                <div className="mt-6">
                                    <GenreFiltersContent
                                        selectedTypes={selectedTypes}
                                        isLoadingTypes={isLoadingTypes}
                                        bookTypes={bookTypes}
                                        onTypeToggle={handleTypeToggle}
                                    />
                                </div>
                            </SheetContent>
                        </Sheet>
                    </div>

                    {/* Active Filters Display */}
                    {hasActiveFilters && (
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm text-muted-foreground">Active filters:</span>
                            {selectedTypes.map((type) => (
                                <Badge key={type} variant="secondary" className="gap-1 pl-2 pr-1">
                                    {bookTypes.find((t) => t.slug === type)?.name ?? bookTypeLabel(type)}
                                    <button
                                        type="button"
                                        onClick={() => handleTypeToggle(type)}
                                        className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </Badge>
                            ))}
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
                            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7">
                                Clear all
                            </Button>
                        </div>
                    )}
                </div>

                <div className="flex gap-6">
                    {/* Desktop Sidebar */}
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
                            <GenreFiltersContent
                                selectedTypes={selectedTypes}
                                isLoadingTypes={isLoadingTypes}
                                bookTypes={bookTypes}
                                onTypeToggle={handleTypeToggle}
                            />
                        </div>
                    </aside>

                    {/* Main Grid */}
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

            {/* All Genres Section (Bottom) */}
            {!isLoading && !error && allGenres.length > 0 && (
                <AllGenresSection genres={allGenres} />
            )}
        </div>
    );
}

// Local simplified filters component (No genre selection)
function GenreFiltersContent({
                                 selectedTypes,
                                 isLoadingTypes,
                                 bookTypes,
                                 onTypeToggle,
                             }: {
    selectedTypes: string[];
    isLoadingTypes: boolean;
    bookTypes: BookType[];
    onTypeToggle: (type: string) => void;
}) {
    return (
        <div className="space-y-6">
            <div>
                <h3 className="mb-3 text-sm font-semibold">Category</h3>
                <div className="space-y-2">
                    {isLoadingTypes ? (
                        <div className="space-y-2">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="h-5 animate-pulse rounded bg-muted" />
                            ))}
                        </div>
                    ) : (
                        bookTypes.map((type) => (
                            <div key={type.slug} className="flex items-center space-x-2">
                                <Checkbox
                                    id={`type-${type.slug}`}
                                    checked={selectedTypes.includes(type.slug)}
                                    onCheckedChange={() => onTypeToggle(type.slug)}
                                />
                                <Label
                                    htmlFor={`type-${type.slug}`}
                                    className="cursor-pointer text-sm font-normal"
                                >
                                    {type.name}
                                </Label>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}