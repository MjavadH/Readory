'use client';

import { BookMarked } from 'lucide-react';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import { ContinueReadingCard } from '@/components/dashboard/ContinueReadingCard';
import {
  FeaturedCollectionsSection,
  FeaturedCollectionsSkeleton,
} from '@/components/Home/featured-collections-section';
import { GenresSection, GenresSectionSkeleton } from '@/components/Home/genres-section';
import { HeroCarousel, HeroSkeleton } from '@/components/Home/hero-carousel';
import { LatestSection, LatestSectionSkeleton } from '@/components/Home/latest-section';
import { PopularSection, PopularSkeleton } from '@/components/Home/popular-section';
import { TrendingSection, TrendingSkeleton } from '@/components/Home/trending-section';
import { useCurrentUser } from '@/hooks/use-current-user';
import { apiClient } from '@/lib/api-client';
import type {
  BookCardData,
  BookGenre,
  BookType,
  CollectionSummary,
  ReadingProgress,
} from '@/lib/types';

interface Chapter {
  id: number;
  num: number;
  title: string;
  free: boolean;
}

interface LatestBook {
  id: number;
  title: string;
  cover: string;
  time: string;
  type: BookType;
  chapters: Chapter[];
}

interface HomeContent {
  hero: BookCardData[];
  latest: LatestBook[];
  trending: BookCardData[];
  popular: BookCardData[];
  genres: BookGenre[];
}

interface PersonalizedContent {
  continueReading: ReadingProgress;
}

const fetcher = (url: string) => apiClient.get<HomeContent>(url);
const PersonalizedFetcher = (url: string) =>
  apiClient.get<PersonalizedContent>(url, { authRequired: true });
const collectionsFetcher = (url: string) =>
  apiClient.get<{ items: CollectionSummary[]; nextCursor?: string; hasMore?: boolean }>(url);

export default function Home() {
  const { status } = useCurrentUser();

  const { data: homeData, isLoading: homeLoading } = useSWR<HomeContent>(
    `${process.env.NEXT_PUBLIC_API_BASE}/public/content`,
    fetcher,
  );

  const { data: personalizedData } = useSWR<PersonalizedContent>(
    status === 'authenticated' || status === 'loading'
      ? `${process.env.NEXT_PUBLIC_API_BASE}/public/personalized`
      : null,
    PersonalizedFetcher,
    {
      onErrorRetry: (error, key, config, revalidate, { retryCount }) => {
        if (error?.status === 401) return;

        if (retryCount >= 3) return;
        setTimeout(() => revalidate({ retryCount }), 5000);
      },
    },
  );

  const { data: collectionsData, isLoading: collectionsLoading } = useSWR(
    `${process.env.NEXT_PUBLIC_API_BASE}/collections?limit=12`,
    collectionsFetcher,
  );

  const featuredCollections = (collectionsData?.items ?? [])
    .filter((collection) => collection.featured)
    .slice(0, 4);
  const t = useTranslations('UserDashboard');

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12 space-y-16">
        {/* Hero Section */}
        <section>
          {homeLoading || !homeData ? <HeroSkeleton /> : <HeroCarousel books={homeData.hero} />}
        </section>

        {/* Trending Section */}
        {homeLoading || !homeData ? (
          <TrendingSkeleton />
        ) : (
          homeData?.trending && <TrendingSection books={homeData.trending} />
        )}

        {/* Latest Updates Section */}
        {homeLoading || !homeData ? (
          <LatestSectionSkeleton />
        ) : (
          homeData?.latest && <LatestSection books={homeData.latest} />
        )}

        {/* Featured Collections Section */}
        {collectionsLoading ? (
          <FeaturedCollectionsSkeleton />
        ) : (
          <FeaturedCollectionsSection collections={featuredCollections} />
        )}

        {/* popular Section */}
        {homeLoading || !homeData ? (
          <PopularSkeleton />
        ) : (
          homeData?.popular && <PopularSection books={homeData.popular} />
        )}

        {/* ContinueReading Section */}
        {personalizedData && personalizedData?.continueReading && (
          <section className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-2xl font-bold tracking-tight flex items-center gap-3">
                <BookMarked className="w-6 h-6 text-primary" />
                {t('ContinueReading')}
              </h2>
            </div>
            <ContinueReadingCard progress={personalizedData.continueReading} />
          </section>
        )}

        {/* Genres Section */}
        {homeLoading || !homeData ? (
          <GenresSectionSkeleton />
        ) : (
          homeData?.genres && <GenresSection genres={homeData.genres} />
        )}
      </div>
    </main>
  );
}
