'use client';

import { TrendingUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { BookCardData } from '@/lib/types';
import { BookCarouselSection, BookCarouselSkeleton } from '@/components/Home/book-carousel-section';

export function TrendingSection({ books }: { books: BookCardData[] }) {
  const t = useTranslations('HomePage');
  return (
    <BookCarouselSection
      books={books}
      icon={TrendingUp}
      eyebrow={t('TrendingDescription')}
      title={t('Trending')}
      ariaLabel={t('Trending')}
    />
  );
}

export function TrendingSkeleton({ count = 8 }: { count?: number }) {
  return (
    <BookCarouselSkeleton icon={TrendingUp} count={count} ariaLabel="Loading trending books" />
  );
}
