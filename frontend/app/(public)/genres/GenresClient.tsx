'use client';

import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import { AllGenresSection } from '@/components/genres/all-genres-section';
import { GenreBookRow } from '@/components/genres/genre-book-row';
import { GenresPageSkeleton } from '@/components/genres/genres-page-skeleton';
import { apiClient } from '@/lib/api-client';
import type { GenresPageResponse } from './genres-types';

const fetcher = (url: string) => apiClient.get<GenresPageResponse>(url);

interface GenresPageClientProps {
  initialData: GenresPageResponse;
}

export default function GenresPageClient({ initialData }: GenresPageClientProps) {
  const { data, error, isLoading } = useSWR<GenresPageResponse>('/public/genres', fetcher, {
    fallbackData: initialData,
    revalidateOnMount: false,
  });
  const t = useTranslations('Genres');

  const featured = data?.featured ?? [];
  const allGenres = data?.allGenres ?? [];

  return (
    <main className="min-h-screen bg-background">
      {/* Page header */}
      <div className="mx-auto max-w-7xl px-4 pt-8 pb-2 sm:px-6 sm:pt-10 lg:px-8">
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl lg:text-4xl text-balance">
          {t('Title')}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed sm:text-base">
          {t('Description')}
        </p>
      </div>

      {/* Featured genre sections */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {isLoading && <GenresPageSkeleton />}

        {error && !isLoading && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-center">
            <p className="text-sm text-destructive">
              {error instanceof Error ? error.message : t('Error')}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-3 text-xs font-medium text-primary underline-offset-4 hover:underline"
            >
              {t('TryAgain')}
            </button>
          </div>
        )}

        {!isLoading && !error && (
          <div className="flex flex-col gap-10 sm:gap-12">
            {featured.map((genre) => (
              <GenreBookRow key={genre.slug} genre={genre} />
            ))}
          </div>
        )}
      </div>

      {/* All Genres */}
      {!isLoading && !error && allGenres.length > 0 && <AllGenresSection genres={allGenres} />}
    </main>
  );
}
