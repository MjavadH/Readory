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

  useEffect(() => {
    const q = query.trim();

    if (q.length < minLength) {
      setResults([]);
      setIsLoading(false);
      setError(false);
      return;
    }

    const ac = new AbortController();
    setIsLoading(true);
    setError(false);

    const timer = setTimeout(async () => {
      try {
        const data = await apiClient.get<LiveSearchHit[]>(
          `/search/live?q=${encodeURIComponent(q)}`,
          { signal: ac.signal },
        );
        setResults(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!ac.signal.aborted) {
          setResults([]);
          setError(true);
        }
      } finally {
        if (!ac.signal.aborted) setIsLoading(false);
      }
    }, delay);

    return () => {
      clearTimeout(timer);
      ac.abort();
    };
  }, [query, minLength, delay]);

  return { results, isLoading, error };
}
