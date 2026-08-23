'use client';

import { Library } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

import { CollectionsGrid } from '@/components/collections/collections-grid';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api-client';
import type { CollectionSummary } from '@/lib/types';

type CollectionsResponse = {
  items: CollectionSummary[];
  nextCursor?: string;
  hasMore?: boolean;
};

export function CollectionsClient({ initialData }: { initialData: CollectionsResponse }) {
  const t = useTranslations('Collections');
  const [items, setItems] = React.useState(initialData.items ?? []);
  const [nextCursor, setNextCursor] = React.useState(initialData.nextCursor);
  const [hasMore, setHasMore] = React.useState(Boolean(initialData.hasMore));
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const loadMoreRef = React.useRef<HTMLDivElement>(null);

  const loadMore = React.useCallback(async () => {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const res = await apiClient.get<CollectionsResponse>(
        `/collections?limit=24&cursor=${encodeURIComponent(nextCursor)}`,
      );
      setItems((prev) => [...prev, ...(res.items ?? [])]);
      setNextCursor(res.nextCursor);
      setHasMore(Boolean(res.hasMore));
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, nextCursor]);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore) void loadMore();
      },
      { threshold: 0.1, rootMargin: '100px' },
    );
    if (loadMoreRef.current) observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  return items.length > 0 ? (
    <>
      <CollectionsGrid collections={items} />
      {hasMore && (
        <div
          ref={loadMoreRef}
          className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {isLoadingMore &&
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-72 rounded-3xl" />
            ))}
        </div>
      )}
    </>
  ) : (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border bg-card/40 px-6 py-16 text-center">
      <Library aria-hidden className="size-8 text-muted-foreground/70" />
      <p className="text-sm text-muted-foreground sm:text-base">{t('emptyState')}</p>
    </div>
  );
}
