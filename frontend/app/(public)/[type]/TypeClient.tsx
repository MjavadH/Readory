'use client';

import { notFound } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { BookBrowseLayout } from '@/components/book-browse-layout';
import { useBookBrowser } from '@/hooks/use-book-browser';
import { apiClient } from '@/lib/api-client';
import type { BookBrowserApi, BookGenre } from '@/lib/types';

interface TypeClientProps {
  typeSlug: string;
  typeName: string;
  initialData: {
    books: BookBrowserApi;
    genres: BookGenre[];
  };
}

export default function TypeClient({ typeSlug, typeName, initialData }: TypeClientProps) {
  const t = useTranslations('Books');

  const browser = useBookBrowser<BookBrowserApi>({
    baseUrl: `/${typeSlug}`,
    fetcher: (params, signal) =>
      apiClient.get(`/books/type/${typeSlug}/browse?${params}`, { signal }),
    initialData: initialData.books,
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
          t('BrowseBooks', { Books: typeName })
        )
      }
      description={t('BrowseBooksDescription', { type: typeName })}
      books={browser.items}
      isLoading={browser.isLoading}
      isLoadingMore={browser.isLoadingMore}
      hasMore={browser.hasMore}
      loadMoreRef={browser.loadMoreRef}
      filters={browser.filters}
      // Disable Type filter, keep Genre filter
      enableTypeFilter={false}
      availableTypes={[]}
      availableGenres={initialData.genres}
      isLoadingGenres={false}
    />
  );
}
