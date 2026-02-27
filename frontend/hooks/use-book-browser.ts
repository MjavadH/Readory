"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { SortOption } from "@/lib/types";

// Helper to compare arrays
const arraysEqual = (a: string[], b: string[]) =>
    a.length === b.length && a.every((v, i) => v === b[i]);

const normalizeListParam = (v: string | null) =>
    (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : []);

interface UseBookBrowserOptions<T> {
    fetcher: (params: string, abortSignal: AbortSignal) => Promise<T>;
    baseUrl: string; // The base URL for router.push (e.g. "/books" or "/manga")
    defaultSort?: SortOption;
    initialData?: T;
}

export function useBookBrowser<T extends { items: any[]; nextCursor?: string; hasMore?: boolean }>(
    {
        fetcher,
        baseUrl,
        defaultSort = "recently_updated",
        initialData,
    }: UseBookBrowserOptions<T>) {

    const router = useRouter();
    const searchParams = useSearchParams();

    // Data State
    const [data, setData] = useState<T | null>(initialData ?? null); // Store full response to access extra metadata if needed
    const [items, setItems] = useState<T["items"]>(initialData?.items ?? []);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [nextCursor, setNextCursor] = useState<string | undefined>(
        initialData?.nextCursor
    );
    const [hasMore, setHasMore] = useState(
        initialData?.hasMore ?? !!initialData?.nextCursor
    );
    const [error, setError] = useState(false)
    const [isNotFound, setIsNotFound] = useState(false);

    // Refs
    const observerRef = useRef<IntersectionObserver | null>(null);
    const loadMoreRef = useRef<HTMLDivElement>(null);
    const abortRef = useRef<AbortController | null>(null);
    const lastPushedRef = useRef<string>("");

    // Filter State
    const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
    const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
    const [sortBy, setSortBy] = useState<SortOption>(defaultSort);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchInput, setSearchInput] = useState("");

    const fetcherRef = useRef(fetcher);
    const didInitRef = useRef(false);

    useEffect(() => {
        fetcherRef.current = fetcher;
    }, [fetcher]);

    // Initialize state from URL
    useEffect(() => {
        const typesFromUrl = normalizeListParam(searchParams.get("types"));
        const genresFromUrl = normalizeListParam(searchParams.get("genres"));
        const sortFromUrl = (searchParams.get("sort") as SortOption) || defaultSort;
        const qFromUrl = searchParams.get("q") || "";

        setSelectedTypes((prev) => (arraysEqual(prev, typesFromUrl) ? prev : typesFromUrl));
        setSelectedGenres((prev) => (arraysEqual(prev, genresFromUrl) ? prev : genresFromUrl));
        setSortBy((prev) => (prev === sortFromUrl ? prev : sortFromUrl));
        setSearchQuery((prev) => (prev === qFromUrl ? prev : qFromUrl));
        setSearchInput((prev) => (prev === qFromUrl ? prev : qFromUrl));
    }, [searchParams, defaultSort]);

    // Build Query String
    const buildQueryParams = useCallback(
        (cursor?: string) => {
            const params = new URLSearchParams();
            if (selectedTypes.length > 0) params.set("types", selectedTypes.join(","));
            if (selectedGenres.length > 0) params.set("genres", selectedGenres.join(","));
            if (sortBy) params.set("sort", sortBy);
            if (searchQuery) params.set("q", searchQuery);
            if (cursor) params.set("cursor", cursor);
            params.set("limit", "24");
            return params.toString();
        },
        [selectedTypes, selectedGenres, sortBy, searchQuery]
    );

    // Sync URL
    useEffect(() => {
        const params = new URLSearchParams();
        if (selectedTypes.length > 0) params.set("types", selectedTypes.join(","));
        if (selectedGenres.length > 0) params.set("genres", selectedGenres.join(","));
        if (sortBy !== defaultSort) params.set("sort", sortBy);
        if (searchQuery) params.set("q", searchQuery);

        const queryString = params.toString();
        const nextUrl = `${baseUrl}${queryString ? `?${queryString}` : ""}`;

        if (lastPushedRef.current === nextUrl) return;
        lastPushedRef.current = nextUrl;
        router.push(nextUrl, { scroll: false });
    }, [selectedTypes, selectedGenres, sortBy, searchQuery, baseUrl, router, defaultSort]);

    // Fetch Data
    const fetchItems = useCallback(
        async (cursor?: string) => {
            const isInitialLoad = !cursor;
            if (isInitialLoad) {
                setIsLoading(true);
                setError(false);
                setIsNotFound(false);
            } else {
                setIsLoadingMore(true);
            }

            try {
                const queryParams = buildQueryParams(cursor);
                abortRef.current?.abort();
                abortRef.current = new AbortController();

                const responseData = await fetcherRef.current(queryParams, abortRef.current.signal);

                if (!responseData) {
                    if (isInitialLoad) setIsNotFound(true);
                    return;
                }

                setData(responseData);
                const newItems = responseData.items || [];
                setItems((prev) => (isInitialLoad ? newItems : [...prev, ...newItems]));
                setNextCursor(responseData.nextCursor);
                setHasMore(responseData.hasMore ?? !!responseData.nextCursor);
            } catch (err: any) {
                if (err?.name === "AbortError") return;
                if (err?.status === 404 || err?.response?.status === 404) {
                    if (isInitialLoad) setIsNotFound(true);
                }
                console.error("Failed to fetch items:", err);
                if (isInitialLoad) {
                    setItems([]);
                    setError(true);
                }
                setHasMore(false);
            } finally {
                isInitialLoad ? setIsLoading(false) : setIsLoadingMore(false);
            }
        },
        [buildQueryParams]
    );

    // Trigger fetch on filter change
    useEffect(() => {
        if (!didInitRef.current) {
            didInitRef.current = true;
            if (initialData) return;
        }

        setNextCursor(undefined);
        setHasMore(false);
        void fetchItems(undefined);
    }, [selectedTypes, selectedGenres, sortBy, searchQuery, fetchItems, initialData]);

    // Infinite Scroll Observer
    useEffect(() => {
        if (observerRef.current) observerRef.current.disconnect();

        observerRef.current = new IntersectionObserver(
            (entries) => {
                const [entry] = entries;
                if (entry.isIntersecting && hasMore && !!nextCursor && !isLoadingMore) {
                    void fetchItems(nextCursor);
                }
            },
            { threshold: 0.1, rootMargin: "100px" }
        );

        if (loadMoreRef.current) observerRef.current.observe(loadMoreRef.current);
        return () => observerRef.current?.disconnect();
    }, [hasMore, isLoadingMore, nextCursor, fetchItems]);

    // Handlers
    const handleTypeToggle = (type: string) =>
        setSelectedTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));

    const handleGenreToggle = (slug: string) =>
        setSelectedGenres((prev) => (prev.includes(slug) ? prev.filter((g) => g !== slug) : [...prev, slug]));

    const clearFilters = () => {
        setSelectedTypes([]);
        setSelectedGenres([]);
        setSortBy(defaultSort);
        setSearchQuery("");
        setSearchInput("");
    };

    return {
        items,
        data, // Exposes full response (useful for slug page)
        isLoading,
        isLoadingMore,
        hasMore,
        loadMoreRef,
        isNotFound,
        filters: {
            selectedTypes,
            selectedGenres,
            sortBy,
            searchQuery,
            searchInput,
            setSearchInput,
            setSortBy,
            setSearchQuery,
            handleTypeToggle,
            handleGenreToggle,
            clearFilters,
        },
    };
}