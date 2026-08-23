'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BookBrowserApi, SortOption } from '@/lib/types';

const normalizeListParam = (v: string | null) =>
  v
    ? v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

interface UseBookBrowserOptions<T> {
  fetcher: (params: string, abortSignal: AbortSignal) => Promise<T>;
  baseUrl: string;
  defaultSort?: SortOption;
  initialData?: T;
}

export function useBookBrowser<T extends BookBrowserApi>({
  fetcher,
  baseUrl,
  defaultSort = 'recently_updated',
  initialData,
}: UseBookBrowserOptions<T>) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlFilters = useMemo(() => {
    const types = normalizeListParam(searchParams.get('types'));
    const genres = normalizeListParam(searchParams.get('genres'));
    const sort = (searchParams.get('sort') as SortOption) || defaultSort;
    const query = searchParams.get('q') || '';

    return {
      types,
      genres,
      sort,
      query,
    };
  }, [searchParams, defaultSort]);

  const [data, setData] = useState<T | null>(initialData ?? null);
  const [items, setItems] = useState<T['items']>(initialData?.items ?? []);
  const [isLoading, setIsLoading] = useState(!initialData);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>(initialData?.nextCursor);
  const [hasMore, setHasMore] = useState(initialData?.hasMore ?? !!initialData?.nextCursor);
  const [isNotFound, setIsNotFound] = useState(false);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastPushedRef = useRef<string>('');
  const fetcherRef = useRef(fetcher);
  const didInitRef = useRef(false);

  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  const selectedTypes = urlFilters.types;
  const selectedGenres = urlFilters.genres;
  const sortBy = urlFilters.sort;
  const searchQuery = urlFilters.query;
  const [searchInput, setSearchInput] = useState(searchQuery);

  const updateUrl = useCallback(
    (next: { types: string[]; genres: string[]; sort: SortOption; query: string }) => {
      const params = new URLSearchParams();
      if (next.types.length > 0) params.set('types', next.types.join(','));
      if (next.genres.length > 0) params.set('genres', next.genres.join(','));
      if (next.sort !== defaultSort) params.set('sort', next.sort);
      if (next.query) params.set('q', next.query);

      const queryString = params.toString();
      const nextUrl = `${baseUrl}${queryString ? `?${queryString}` : ''}`;

      if (lastPushedRef.current === nextUrl) return;
      lastPushedRef.current = nextUrl;
      router.push(nextUrl, { scroll: false });
    },
    [baseUrl, defaultSort, router],
  );

  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    lastPushedRef.current = `${baseUrl}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
  }, [baseUrl, searchParams]);

  const buildQueryParams = useCallback(
    (cursor?: string) => {
      const params = new URLSearchParams();
      if (selectedTypes.length > 0) params.set('types', selectedTypes.join(','));
      if (selectedGenres.length > 0) params.set('genres', selectedGenres.join(','));
      if (sortBy) params.set('sort', sortBy);
      if (searchQuery) params.set('q', searchQuery);
      if (cursor) params.set('cursor', cursor);
      params.set('limit', '24');
      return params.toString();
    },
    [selectedTypes, selectedGenres, sortBy, searchQuery],
  );

  const fetchItems = useCallback(
    async (cursor?: string) => {
      const isInitialLoad = !cursor;
      if (isInitialLoad) {
        setIsLoading(true);
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
      } catch (err: unknown) {
        const error = err as {
          name?: string;
          status?: number;
          response?: { status?: number };
        };

        if (error?.name === 'AbortError') return;
        if (error?.status === 404 || error?.response?.status === 404) {
          if (isInitialLoad) setIsNotFound(true);
        }

        console.error('Failed to fetch items:', err);
        if (isInitialLoad) setItems([]);
        setHasMore(false);
      } finally {
        if (isInitialLoad) {
          setIsLoading(false);
        } else {
          setIsLoadingMore(false);
        }
      }
    },
    [buildQueryParams],
  );

  useEffect(() => {
    if (!didInitRef.current) return;

    setNextCursor(undefined);
    setHasMore(false);
    void fetchItems(undefined);
  }, [selectedTypes, selectedGenres, sortBy, searchQuery, fetchItems]);

  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasMore && nextCursor && !isLoadingMore) {
          void fetchItems(nextCursor);
        }
      },
      { threshold: 0.1, rootMargin: '100px' },
    );

    if (loadMoreRef.current) observerRef.current.observe(loadMoreRef.current);
    return () => observerRef.current?.disconnect();
  }, [hasMore, isLoadingMore, nextCursor, fetchItems]);

  const handleTypeToggle = (type: string) => {
    const nextTypes = selectedTypes.includes(type)
      ? selectedTypes.filter((current) => current !== type)
      : [...selectedTypes, type];

    updateUrl({
      types: nextTypes,
      genres: selectedGenres,
      sort: sortBy,
      query: searchQuery,
    });
  };

  const handleGenreToggle = (slug: string) => {
    const nextGenres = selectedGenres.includes(slug)
      ? selectedGenres.filter((current) => current !== slug)
      : [...selectedGenres, slug];

    updateUrl({
      types: selectedTypes,
      genres: nextGenres,
      sort: sortBy,
      query: searchQuery,
    });
  };

  const setSortBy = (nextSort: SortOption) => {
    updateUrl({
      types: selectedTypes,
      genres: selectedGenres,
      sort: nextSort,
      query: searchQuery,
    });
  };

  const setSearchQuery = (nextQuery: string) => {
    updateUrl({
      types: selectedTypes,
      genres: selectedGenres,
      sort: sortBy,
      query: nextQuery,
    });
  };

  const clearFilters = () => {
    updateUrl({
      types: [],
      genres: [],
      sort: defaultSort,
      query: '',
    });
    setSearchInput('');
  };

  return {
    items,
    data,
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
