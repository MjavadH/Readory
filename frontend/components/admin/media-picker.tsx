'use client';

import { Check, Loader2, Search, X } from 'lucide-react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { AppPagination } from '@/components/app-pagination';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { apiClient, getApiErrorMessage } from '@/lib/api-client';
import { getBookCoverThumbnailUrl } from '@/lib/media';
import { useToast } from '@/providers/toast-provider';

export type MediaItem = {
  code: string;
  filename: string;
  createdAt?: string;
  size?: number;
  url?: string | null;
};

type PagedMediaResponse = {
  items: MediaItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type MediaPickerProps = {
  open: boolean;
  onOpenChangeAction: (open: boolean) => void;
  value?: string | null; // selected media code
  onSelectAction: (item: MediaItem | null) => void;
  title?: string;
  description?: string;
  itemsPerPage?: number;
  allowClear?: boolean;
};

const MEDIA_PICKER_SKELETON_COUNT = 10;
const MEDIA_PICKER_SKELETON_KEYS = Array.from(
  { length: MEDIA_PICKER_SKELETON_COUNT },
  (_, i) => `media-picker-skeleton-${i}`,
);

export function MediaPicker({
  open,
  onOpenChangeAction,
  value,
  onSelectAction,
  itemsPerPage = 30,
  allowClear = true,
}: MediaPickerProps) {
  const t = useTranslations('AdminPage.MediaLibrary');
  const toast = useToast();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<MediaItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const paginationScrollRef = useRef<HTMLDivElement>(null);

  // tiny in-memory cache to reduce pressure when navigating pages back/forth
  const cacheRef = useRef(new Map<string, PagedMediaResponse>());

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setPage(1);
    }
    onOpenChangeAction(nextOpen);
  };

  const handleSearchChange = (nextQuery: string) => {
    setQ(nextQuery);
    setPage(1);
  };

  useEffect(() => {
    if (!open) return;

    const controller = new AbortController();

    const run = async () => {
      setIsLoading(true);
      try {
        const qs = new URLSearchParams();
        const query = q.trim();
        if (query) qs.set('q', query);
        qs.set('page', String(page));
        qs.set('limit', String(itemsPerPage));

        const cacheKey = qs.toString();
        const cached = cacheRef.current.get(cacheKey);
        if (cached) {
          setItems(cached.items);
          setTotal(cached.total);
          setTotalPages(Math.max(1, cached.totalPages));
          setHasLoadedOnce(true);
          return;
        }

        const data = await apiClient.get<MediaItem[] | PagedMediaResponse>(
          `/media?${qs.toString()}`,
          {
            signal: controller.signal,
          },
        );

        const normalized: PagedMediaResponse = Array.isArray(data)
          ? { items: data, page: 1, limit: itemsPerPage, total: data.length, totalPages: 1 }
          : {
              items: Array.isArray(data.items) ? data.items : [],
              page: Number(data.page) || page,
              limit: Number(data.limit) || itemsPerPage,
              total: Number(data.total) || 0,
              totalPages: Number(data.totalPages) || 1,
            };

        cacheRef.current.set(cacheKey, normalized);
        setItems(normalized.items);
        setTotal(normalized.total);
        setTotalPages(Math.max(1, normalized.totalPages));
        setHasLoadedOnce(true);
      } catch (err: unknown) {
        if (err instanceof Error) {
          if (err?.name !== 'AbortError') {
            toast.error(getApiErrorMessage(err));
          }
        }
      } finally {
        setIsLoading(false);
      }
    };

    void run();
    return () => controller.abort();
  }, [open, q, page, itemsPerPage, toast]);

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:w-full sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-center">{t('SelectCover')}</DialogTitle>
          <DialogDescription className="text-center">
            {t('SelectCoverDescription')}
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative mt-2">
          <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={t('SearchByFilename')}
            className="ps-9 h-11"
          />
        </div>

        {/* Grid */}
        <div ref={paginationScrollRef} className="relative mt-4">
          {isLoading && hasLoadedOnce && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/60 backdrop-blur-sm">
              <Loader2 className="size-6 animate-spin" />
            </div>
          )}

          {/* First load skeleton */}
          {isLoading && !hasLoadedOnce ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
              {MEDIA_PICKER_SKELETON_KEYS.map((key) => (
                <div key={key} className="overflow-hidden rounded-xl border bg-card">
                  <div className="aspect-square bg-muted animate-pulse" />
                  <div className="p-2.5 space-y-2">
                    <div className="h-3 bg-muted animate-pulse rounded" />
                    <div className="h-3 bg-muted animate-pulse rounded w-2/3 mx-auto" />
                  </div>
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              {q.trim() ? t('NoMediaFound') : t('NoMediaUploaded')}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
              {items.map((m) => {
                const selected = (value ?? '') === m.code;
                return (
                  <button
                    key={m.code}
                    type="button"
                    onClick={() => {
                      onSelectAction(m);
                      onOpenChangeAction(false);
                    }}
                    className={[
                      'group text-left overflow-hidden rounded-xl border bg-card hover:shadow-lg transition',
                      selected ? 'ring-2 ring-primary border-primary/40' : 'border-border',
                    ].join(' ')}
                  >
                    <div className="aspect-2/3 bg-muted relative">
                      <Image
                        src={`${getBookCoverThumbnailUrl(m.code)}`}
                        alt={m.filename || 'image'}
                        fill
                        sizes="(max-width: 480px) 45vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 200px"
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      {selected && (
                        <div className="absolute top-2 right-2 rounded-full bg-primary text-primary-foreground p-1 shadow">
                          <Check className="size-4" />
                        </div>
                      )}
                    </div>
                    <div className="p-2.5 border-t bg-muted/20 space-y-1">
                      <div className="text-xs font-medium truncate text-center">{m.filename}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer: clear + pagination */}
        <div className="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            {allowClear && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onSelectAction(null);
                  onOpenChangeAction(false);
                }}
              >
                <X className="size-4 me-2" />
                {t('NoCover')}
              </Button>
            )}
          </div>

          {totalPages > 1 && (
            <AppPagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={total}
              pageSize={itemsPerPage}
              itemLabel={t('Media')}
              onPageChange={setPage}
              canGoPrevious={page > 1}
              canGoNext={page < totalPages}
              scrollTarget={paginationScrollRef}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
