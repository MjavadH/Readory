'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { BookBrowserApi, BookGenre } from '@/lib/types';
import { useBookBrowser } from '@/hooks/use-book-browser';
import { BookBrowseLayout } from '@/components/book-browse-layout';
import { notFound } from 'next/navigation';
import { useTranslations } from 'next-intl';

// Format slug to Title Case
const formatTypeTitle = (slug: string) =>
  slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

export default function TypePage() {
  const t = useTranslations('Books');
  const params = useParams();
  const typeSlug = (Array.isArray(params.type) ? params.type[0] : params.type) || '';

  const [genres, setGenres] = useState<BookGenre[]>([]);
  const [isLoadingGenres, setIsLoadingGenres] = useState(true);

  useEffect(() => {
    apiClient
      .get<BookGenre[]>('/genres/listAll')
      .then(setGenres)
      .finally(() => setIsLoadingGenres(false));
  }, []);

  const browser = useBookBrowser<BookBrowserApi>({
    baseUrl: `/${typeSlug}`,
    fetcher: (params, signal) =>
      apiClient.get(`/books/type/${typeSlug}/browse?${params}`, { signal }),
  });
  if (browser.isNotFound) {
    notFound();
  }

  return (
    <BookBrowseLayout
      title={
        browser.isLoading && !browser.data ? (
          <div className="h-10 w-48 animate-pulse rounded bg-muted" />
        ) : (
          t('BrowseBooks', { Books: formatTypeTitle(typeSlug) })
        )
      }
      description={t('BrowseBooksDescription', { type: formatTypeTitle(typeSlug) })}
      books={browser.items}
      isLoading={browser.isLoading}
      isLoadingMore={browser.isLoadingMore}
      hasMore={browser.hasMore}
      loadMoreRef={browser.loadMoreRef}
      filters={browser.filters}
      // Disable Type filter, keep Genre filter
      enableTypeFilter={false}
      availableTypes={[]}
      availableGenres={genres}
      isLoadingGenres={isLoadingGenres}
    />
  );
}
