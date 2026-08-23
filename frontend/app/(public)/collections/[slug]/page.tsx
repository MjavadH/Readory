'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { AlertCircle } from 'lucide-react';

import { apiClient, getApiErrorMessage } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CollectionDetail } from '@/components/collections/collection-detail';
import type { Collection } from '@/lib/collection-types';
import { useCurrentUser } from '@/hooks/use-current-user';

export default function PublicCollectionPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? '';
  const t = useTranslations('Collections');

  const { user } = useCurrentUser();
  const isAdmin = user?.roleName === 'ADMIN';

  const [collection, setCollection] = React.useState<Collection | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!slug) return;

    try {
      const res = await apiClient.get<Collection>(`/collections/${slug}`);
      setCollection(res);
    } catch (e) {
      setError(getApiErrorMessage(e, t('Toast.LoadFailed')));
    } finally {
      setIsLoading(false);
    }
  }, [slug, t]);

  React.useEffect(() => {
    if (!slug) return;

    let cancelled = false;

    void apiClient
      .get<Collection>(`/collections/${slug}`)
      .then((res) => {
        if (cancelled) return;
        setCollection(res);
      })
      .catch((error) => {
        if (cancelled) return;

        setError(getApiErrorMessage(error, t('Toast.LoadFailed')));
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [slug, t]);

  const handleRetry = async () => {
    setError(null);
    setIsLoading(true);
    await load();
  };

  if (isLoading) return <CollectionDetailSkeleton />;

  if (error || !collection) {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-destructive/10">
          <AlertCircle className="h-5 w-5 text-destructive" />
        </div>
        <p className="text-sm font-medium">{error ?? t('NotFound')}</p>
        <Button variant="outline" size="sm" onClick={() => void handleRetry()}>
          {t('Actions.Retry')}
        </Button>
      </div>
    );
  }

  // The owner may edit the collection and its items, but only admins can add books.
  const isOwner = Boolean(user && collection.ownerId && user.id === collection.ownerId);
  const canEdit = isOwner || (isAdmin && collection.type === 'SYSTEM');

  return (
    <motion.main initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
      <CollectionDetail
        collection={collection}
        canEdit={canEdit}
        canAddItems={isAdmin && collection.type === 'SYSTEM'}
        onChanged={load}
        onDeleted={() => {
          window.location.href = '/collections';
        }}
      />
    </motion.main>
  );
}

function CollectionDetailSkeleton() {
  return (
    <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-12 lg:gap-8 lg:px-8">
      <div className="lg:col-span-4">
        <Skeleton className="h-96 w-full rounded-3xl" />
      </div>
      <div className="lg:col-span-8">
        <Skeleton className="mb-4 h-16 w-full rounded-2xl" />
        <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="aspect-2/3 w-full rounded-xl" />
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-3 w-2/5" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
