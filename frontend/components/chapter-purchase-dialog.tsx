'use client';

import type { IconKey } from '@readory/shared';
import { AlertCircle, BookOpen, Check, ShoppingCart, Unlock, X } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppIcon } from '@/components/AppIcon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiClient, getApiErrorMessage } from '@/lib/api-client';
import { getBookCoverThumbnailUrl } from '@/lib/media';
import { useToast } from '@/providers/toast-provider';

export interface PurchaseDialogBook {
  id: number;
  title: string;
  contributors?: Array<{
    id: number;
    name: string;
    role: string;
    slug: string;
  }>;
  coverImage: string;
  type: { name: string; iconKey: IconKey };
}

export interface PurchaseDialogChapter {
  id: number;
  title: string;
  index: number;
  isFree: boolean;
  price: number | null;
  mode: 'purchase' | 'access';
}

interface ChapterPurchaseDialogProps {
  book: PurchaseDialogBook;
  chapter: PurchaseDialogChapter;
  typeSlug: string;
  onPurchased: (chapterId: number) => void;
  onClose: () => void;
}

export function ChapterPurchaseDialog({
  book,
  chapter,
  typeSlug,
  onPurchased,
  onClose,
}: ChapterPurchaseDialogProps) {
  const t = useTranslations('Books');
  const g = useTranslations('General');
  const toast = useToast();
  const router = useRouter();

  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  const isAccess = chapter.mode === 'access';
  const priceLabel = isAccess
    ? t('Free')
    : `${g('CurrencySymbols')}${Number(chapter.price ?? 0).toFixed(2)}`;

  const coverSrc = book.coverImage ? getBookCoverThumbnailUrl(book.coverImage) : '/placeholder.svg';

  const handleClose = useCallback(() => {
    if (isPending) return;
    onClose();
  }, [isPending, onClose]);

  const handleConfirm = useCallback(async () => {
    setError(null);
    setIsPending(true);

    const chapterUrl = `/${encodeURIComponent(typeSlug)}/${book.id}/c/${chapter.index}`;

    try {
      await apiClient.post(`/books/${book.id}/chapters/${chapter.id}/purchase`);

      onPurchased(chapter.id);
      toast.success(isAccess ? t('ChapterAccessible') : t('ChapterPurchasedSuccessfully'));
      onClose();
      router.push(chapterUrl);
    } catch (purchaseError) {
      const message = getApiErrorMessage(
        purchaseError,
        'Purchase failed. Please check your balance and try again.',
      );
      setError(message);
      toast.error(message);
      setIsPending(false);
    }
  }, [
    book.id,
    chapter.id,
    chapter.index,
    isAccess,
    onClose,
    onPurchased,
    router,
    t,
    toast,
    typeSlug,
  ]);

  // Lock body scroll while the dialog is open.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  // Close on Escape and move focus to the primary action on mount.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', onKeyDown);
    confirmButtonRef.current?.focus();
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [handleClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 sm:items-center sm:p-4"
      onClick={handleClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="chapter-purchase-title"
        aria-describedby="chapter-purchase-description"
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl border border-border bg-card text-card-foreground shadow-2xl animate-in slide-in-from-bottom duration-300 sm:max-w-md sm:rounded-2xl sm:zoom-in-95"
      >
        {/* Mobile drag affordance */}
        <div className="flex justify-center pt-3 sm:hidden" aria-hidden="true">
          <span className="h-1.5 w-12 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-5 pb-4 sm:p-6 sm:pb-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-lg ${
                isAccess ? 'bg-emerald-500 dark:bg-emerald-600' : 'bg-blue-600 dark:bg-blue-500'
              }`}
            >
              {isAccess ? <Unlock className="h-5 w-5" /> : <ShoppingCart className="h-5 w-5" />}
            </div>
            <div className="min-w-0">
              <h2
                id="chapter-purchase-title"
                className="text-lg font-bold leading-tight text-foreground sm:text-xl"
              >
                {isAccess ? t('AccessChapter') : t('PurchaseChapter')}
              </h2>
              <p id="chapter-purchase-description" className="mt-0.5 text-xs text-muted-foreground">
                {isAccess
                  ? t('AccessChapterDescription', {
                      ChapterIndex: chapter.index,
                      ChapterTitle: chapter.title,
                    })
                  : t('PurchaseChapterDescription', {
                      ChapterIndex: chapter.index,
                      ChapterTitle: chapter.title,
                      CurrencySymbols: g('CurrencySymbols'),
                      ChapterPrice: Number(chapter.price ?? 0).toFixed(2),
                    })}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isPending}
            aria-label={g('Cancel')}
            className="-me-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6">
          {/* Book summary */}
          <div className="flex gap-4 rounded-2xl border border-border bg-muted/40 p-4">
            <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-lg shadow-md">
              <Image
                src={coverSrc}
                alt={`Cover of ${book.title}`}
                fill
                className="object-cover"
                sizes="80px"
              />
            </div>
            <div className="flex min-w-0 flex-col justify-center gap-2">
              <h3 className="line-clamp-2 font-semibold leading-snug text-foreground">
                {book.title}
              </h3>
              <p className="truncate text-sm text-muted-foreground">
                {book.contributors && book.contributors.length > 0 && book.contributors[0].name}
              </p>
              <Badge variant="outline" className="w-fit gap-1.5 border-border bg-background">
                <AppIcon name={book.type.iconKey} className="h-3.5 w-3.5" />
                {book.type.name}
              </Badge>
            </div>
          </div>

          {/* Chapter row */}
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-border p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white shadow-sm dark:bg-blue-500">
              {chapter.index}
            </div>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="line-clamp-2 text-sm font-medium text-foreground">
                {chapter.title}
              </span>
            </div>
          </div>

          {/* Price summary */}
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-muted/40 px-4 py-3.5">
            <span className="text-sm font-medium text-muted-foreground">
              {isAccess ? t('Access') : t('Buy')}
            </span>
            <span
              className={`text-xl font-bold ${
                isAccess ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'
              }`}
            >
              {priceLabel}
            </span>
          </div>

          {/* Inline error */}
          {error && (
            <div
              role="alert"
              className="mt-4 flex items-start gap-2.5 rounded-2xl border border-destructive/30 bg-destructive/10 p-3.5 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex flex-col-reverse gap-3 p-5 pt-4 sm:flex-row sm:p-6 sm:pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isPending}
            className="h-11 flex-1"
          >
            {g('Cancel')}
          </Button>
          <Button
            ref={confirmButtonRef}
            type="button"
            onClick={() => void handleConfirm()}
            disabled={isPending}
            className={`h-11 flex-1 text-white ${
              isAccess ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isPending ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                {t('Processing')}
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                {isAccess ? <Unlock className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                {isAccess ? t('ConfirmAccess') : t('ConfirmPurchase')}
              </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
