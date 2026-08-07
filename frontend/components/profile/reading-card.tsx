'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { BookOpen } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';
import { getBookCoverThumbnailUrl } from '@/lib/media';
import { getBookUrl } from '@/lib/types';
import type { BookCardData } from '@/lib/types';
import { formatUpdateTime } from '@/lib/time';

type ReadingCardProps = {
  book: BookCardData;
  percent: number;
  lastReadAt: string;
  index?: number;
  className?: string;
};

export function ReadingCard({ book, percent, lastReadAt, index = 0, className }: ReadingCardProps) {
  const t = useTranslations('PublicProfile');
  const ti = useTranslations('Time');
  const value = Math.max(0, Math.min(100, Math.round(percent)));

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.28, ease: 'easeOut', delay: Math.min(index, 6) * 0.04 }}
      whileHover={{ y: -3 }}
      className={cn('group h-full', className)}
    >
      <Link
        href={getBookUrl(book)}
        className={cn(
          'flex h-full items-center gap-3 rounded-2xl border border-border/60 bg-card/70 p-2.5 text-start',
          'backdrop-blur-sm transition-colors duration-300 hover:border-border hover:bg-card',
          'shadow-sm hover:shadow-md hover:shadow-foreground/5 dark:hover:shadow-background/60',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        )}
      >
        <div className="relative aspect-2/3 w-14 shrink-0 overflow-hidden rounded-lg bg-muted ring-1 ring-foreground/10 sm:w-16">
          {book.coverImage ? (
            <Image
              src={getBookCoverThumbnailUrl(book.coverImage)}
              alt={book.title}
              fill
              sizes="72px"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <span className="line-clamp-3 block p-1 text-center text-[9px] font-medium leading-tight text-muted-foreground">
              {book.title}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          <h3 className="line-clamp-2 text-sm font-semibold leading-tight text-foreground">
            {book.title}
          </h3>
          {book.contributors ? (
            <p className="line-clamp-1 text-xs text-muted-foreground">{book.contributors}</p>
          ) : null}

          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={value}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t('Progress', { percent: value })}
          >
            <motion.span
              initial={{ width: 0 }}
              whileInView={{ width: `${value}%` }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
              className="block h-full rounded-full bg-primary"
            />
          </div>

          <div className="flex min-w-0 items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1 font-semibold tabular-nums text-foreground">
              <BookOpen aria-hidden className="size-3" />
              {t('Progress', { percent: value })}
            </span>
            <span className="truncate">{formatUpdateTime(new Date(lastReadAt), ti)}</span>
          </div>
        </div>
      </Link>
    </motion.article>
  );
}
