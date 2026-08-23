'use client';

import { motion } from 'framer-motion';
import { CheckCircle2, ShoppingBag } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { getBookCoverThumbnailUrl } from '@/lib/media';
import { getBookUrl, type LibraryItem } from '@/lib/types';
import { cn } from '@/lib/utils';

interface Props {
  item: LibraryItem;
  className?: string;
}

export function LibraryCardSkeleton({ limit }: { limit?: number }) {
  const skeletonItems = Array.from({ length: limit || 5 }).map((_, idx) => idx);

  return skeletonItems.map((idx) => (
    <div
      key={idx}
      className="bg-card border border-border rounded-3xl p-4 overflow-hidden relative"
    >
      <div className="aspect-3/4 rounded-2xl overflow-hidden bg-muted mb-4 relative z-10 shadow-sm">
        <div className="absolute inset-0 bg-linear-to-tr from-transparent via-muted-foreground/5 to-muted-foreground/10 animate-pulse" />
      </div>

      <div className="space-y-3 relative z-10">
        <div className="space-y-2">
          <div className="h-6 w-3/4 rounded-lg bg-muted-foreground/20 animate-pulse" />
          <div className="h-4 w-1/2 rounded-lg bg-muted-foreground/20 animate-pulse" />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded-full bg-muted-foreground/20 animate-pulse" />
              <div className="h-3.5 w-12 rounded bg-muted-foreground/20 animate-pulse" />
            </div>
            <div className="h-3.5 w-16 rounded bg-muted-foreground/20 animate-pulse" />
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden border border-border/20 ring-1 ring-primary/5">
            <div className="h-full w-1/3 bg-muted-foreground/20 rounded-full animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  ));
}

export function LibraryCard({ item, className }: Props) {
  const t = useTranslations('UserDashboard');
  const isCompleted = item.purchasedPercent >= 100;
  const url = getBookUrl(item.book);

  return (
    <Link href={url}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        className={cn(
          'bg-card border border-border rounded-3xl p-4 hover:shadow-xl hover:border-primary/50 transition-all group overflow-hidden relative',
          className,
        )}
      >
        <div className="absolute inset-0 bg-linear-to-tr from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

        <div className="aspect-3/4 rounded-2xl overflow-hidden bg-muted mb-4 relative z-10 shadow-lg group-hover:-translate-y-1 transition-transform duration-500">
          <Image
            src={
              item.book.coverImage
                ? getBookCoverThumbnailUrl(item.book.coverImage)
                : '/placeholder.svg'
            }
            alt={item.book.title}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
            sizes="(max-width: 480px) 45vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 200px"
            fill
          />
          {isCompleted && (
            <div className="absolute top-3 right-3 p-1.5 bg-primary/90 text-primary-foreground rounded-xl backdrop-blur-md shadow-lg border border-white/20">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          )}
        </div>

        <div className="space-y-3 relative z-10">
          <div className="min-h-12">
            <h4 className="font-bold text-lg line-clamp-1 group-hover:text-primary transition-colors tracking-tight">
              {item.book.title}
            </h4>
            <p className="text-sm text-muted-foreground font-medium">{item.book.contributors}</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <span className="flex items-center gap-1">
                <ShoppingBag className="w-3.5 h-3.5" />
                {t('PTCh', {
                  PurchasedChapters: item.purchasedChapters,
                  TotalChapters: item.totalChapters,
                })}
              </span>
              <span className={cn('text-primary', isCompleted && 'text-primary')}>
                {t('PurchasedPercent', { PurchasedPercent: item.purchasedPercent })}
              </span>
            </div>

            <div className="h-2 bg-muted rounded-full overflow-hidden border border-border/20 ring-1 ring-primary/5">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${item.purchasedPercent}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className={cn(
                  'h-full rounded-full transition-all duration-300',
                  isCompleted
                    ? 'bg-primary'
                    : 'ltr:bg-linear-to-r rtl:bg-linear-to-l from-primary/60 to-primary shadow-[0_0_12px_rgba(var(--primary),0.3)]',
                )}
              />
            </div>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}
