'use client';

import { notFound } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { BookBrowseLayout } from '@/components/book-browse-layout';
import { AllGenresSection } from '@/components/genres/all-genres-section';
import { useBookBrowser } from '@/hooks/use-book-browser';
import { apiClient } from '@/lib/api-client';
import type { PublicBookType } from '@/lib/types';
import type { GenreBrowserApi } from './genre-types';

interface GenreClientProps {
  slug: string;
  genreName: string;
  initialData: {
    books: GenreBrowserApi;
    types: PublicBookType[];
  };
}

export default function GenreClient({ slug, genreName, initialData }: GenreClientProps) {
  const t = useTranslations('Books');

  const browser = useBookBrowser<GenreBrowserApi>({
    baseUrl: `/genres/${slug}`,
    fetcher: (params, signal) =>
      apiClient.get(`/public/genres/${slug}/browse?${params}`, { signal }),
    initialData: initialData.books,
  });

  if (browser.isNotFound) {
    notFound();
  }

  const currentGenreName = browser.data?.genre?.name || genreName;
  const allGenres = browser.data?.allGenres || initialData.books.allGenres || [];

  return (
    <BookBrowseLayout
      title={
        browser.isLoading && !browser.data ? (
          <div className="h-10 w-48 animate-pulse rounded bg-muted" />
        ) : (
          t('GenreBooks', { Genre: currentGenreName })
        )
      }
      description={t('GenreBooksDescription', { Genre: currentGenreName.toLowerCase() })}
      books={browser.items}
      isLoading={browser.isLoading}
      isLoadingMore={browser.isLoadingMore}
      hasMore={browser.hasMore}
      loadMoreRef={browser.loadMoreRef}
      filters={browser.filters}
      // Disable Genre filter, keep Type filter
      enableGenreFilter={false}
      availableTypes={initialData.types}
      availableGenres={[]}
      isLoadingTypes={false}
    >
      {!browser.isLoading && allGenres.length > 0 && <AllGenresSection genres={allGenres} />}
    </BookBrowseLayout>
  );
}
