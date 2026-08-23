'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';

export interface LiveSearchHit {
  id: number;
  title: string;
  coverImage: string | null;
  bookTypeSlug: string;
}

export function useLiveSearch(query: string, { minLength = 2, delay = 300 } = {}) {
  const [results, setResults] = useState<LiveSearchHit[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);

  const normalizedQuery = query.trim();
  const isSearchable = normalizedQuery.length >= minLength;

  useEffect(() => {
    if (!isSearchable) return;

    const ac = new AbortController();

    const timer = setTimeout(async () => {
      setIsLoading(true);
      setError(false);

      try {
        const data = await apiClient.get<LiveSearchHit[]>(
          `/search/live?q=${encodeURIComponent(normalizedQuery)}`,
          { signal: ac.signal },
        );

        if (ac.signal.aborted) return;
        setResults(Array.isArray(data) ? data : []);
      } catch {
        if (!ac.signal.aborted) {
          setResults([]);
          setError(true);
        }
      } finally {
        if (!ac.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, delay);

    return () => {
      clearTimeout(timer);
      ac.abort();
    };
  }, [delay, isSearchable, normalizedQuery]);

  return {
    results: isSearchable ? results : [],
    isLoading: isSearchable && isLoading,
    error: isSearchable && error,
  };
}
