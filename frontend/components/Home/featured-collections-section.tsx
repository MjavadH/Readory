'use client';

import { Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { CollectionCard } from '@/components/collections/collection-card';
import { Skeleton } from '@/components/ui/skeleton';
import type { CollectionSummary } from '@/lib/types';

type FeaturedCollectionsSectionProps = {
  collections: CollectionSummary[];
};

export function FeaturedCollectionsSection({ collections }: FeaturedCollectionsSectionProps) {
  const t = useTranslations('Collections');

  if (!collections.length) return null;

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between px-2">
        <h2 className="flex items-center gap-3 text-2xl font-bold tracking-tight">
          <Sparkles className="h-6 w-6 text-primary" />
          {t('FeaturedCollections')}
        </h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {collections.map((collection, index) => (
          <CollectionCard key={collection.id} collection={collection} index={index} />
        ))}
      </div>
    </section>
  );
}

const SKELETON_COUNT = 4;
const SKELETON_KEYS = Array.from(
  { length: SKELETON_COUNT },
  (_, i) => `featured-collection-skeleton-${i}`,
);

export function FeaturedCollectionsSkeleton() {
  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3 px-2">
        <Skeleton className="h-6 w-6 rounded-full" />
        <Skeleton className="h-8 w-48" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {SKELETON_KEYS.map((key) => (
          <Skeleton key={key} className="h-64 rounded-3xl" />
        ))}
      </div>
    </section>
  );
}
