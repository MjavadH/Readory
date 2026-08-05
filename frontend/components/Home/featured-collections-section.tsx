'use client';

import { useTranslations } from 'next-intl';
import { Sparkles } from 'lucide-react';

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

export function FeaturedCollectionsSkeleton() {
  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3 px-2">
        <Skeleton className="h-6 w-6 rounded-full" />
        <Skeleton className="h-8 w-48" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-64 rounded-3xl" />
        ))}
      </div>
    </section>
  );
}
