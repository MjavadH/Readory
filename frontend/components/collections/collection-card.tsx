'use client';

import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, BookOpen } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useCurrentUser } from '@/hooks/use-current-user';
import type { CollectionSummary } from '@/lib/types';
import { getBookUrl } from '@/lib/types';
import { cn } from '@/lib/utils';
import { CollectionCover } from './collection-cover';

export type CollectionCardVariant = 'default' | 'hero' | 'wide' | 'tall';

type CollectionCardProps = {
  collection: CollectionSummary;
  variant?: CollectionCardVariant;
  index?: number;
  className?: string;
  hrefPrefix?: string;
};

export function CollectionCard({
  collection,
  variant = 'default',
  index = 0,
  className,
  hrefPrefix = '/collections',
}: CollectionCardProps) {
  const t = useTranslations('Collections');
  const split = variant === 'hero' || variant === 'wide';
  const tall = variant === 'tall';
  const books = collection.items?.map((item) => item.book) ?? [];
  const { user } = useCurrentUser();
  const singleBook = collection.bookCount === 1 ? collection.items?.[0]?.book : null;
  const isOwner = Boolean(user && collection.ownerId && user.id === collection.ownerId);
  const href = singleBook && !isOwner ? getBookUrl(singleBook) : `${hrefPrefix}/${collection.slug}`;

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.28, ease: 'easeOut', delay: Math.min(index, 6) * 0.04 }}
      whileHover={{ y: -4 }}
      className={cn('group h-full', className)}
    >
      <Link
        href={href}
        className={cn(
          'relative flex h-full flex-col overflow-hidden rounded-3xl border border-border/60 text-start',
          'bg-card/70 backdrop-blur-sm transition-colors duration-300 hover:border-border hover:bg-card',
          'shadow-sm hover:shadow-lg hover:shadow-foreground/5 dark:hover:shadow-background/60',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          split && 'sm:flex-row sm:items-stretch',
        )}
      >
        <div
          className={cn(
            'flex items-center justify-center px-4 pb-3 pt-5 sm:px-5 sm:pt-6',
            split && 'sm:w-1/2 sm:shrink-0 sm:py-8',
            tall && 'flex-1',
          )}
        >
          <CollectionCover
            books={books}
            size={variant === 'hero' ? 'hero' : 'default'}
            className="w-full"
          />
        </div>

        <div
          className={cn(
            'flex flex-1 flex-col gap-2 px-4 pb-5 pt-1 sm:px-5',
            split && 'sm:justify-center sm:py-8',
            tall && 'flex-none',
          )}
        >
          <div className="flex min-w-0 items-start gap-2">
            <h2
              className={cn(
                'min-w-0 flex-1 font-bold leading-tight tracking-tight text-foreground',
                variant === 'hero'
                  ? 'line-clamp-2 text-xl sm:text-2xl'
                  : 'line-clamp-1 text-base sm:text-lg',
              )}
            >
              {collection.title}
            </h2>
          </div>

          {collection.description ? (
            <p
              className={cn(
                'text-xs leading-relaxed text-muted-foreground sm:text-sm',
                variant === 'hero' ? 'line-clamp-3' : 'line-clamp-2',
              )}
            >
              {collection.description}
            </p>
          ) : null}

          <div className="mt-auto flex items-center justify-between gap-3 pt-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <BookOpen aria-hidden className="size-3.5" />
              {t('NBook', { count: collection.bookCount })}
            </span>

            <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
              {t('view')}
              <ArrowRight aria-hidden className="size-3.5 rtl:hidden" />
              <ArrowLeft aria-hidden className="hidden size-3.5 rtl:inline" />
            </span>
          </div>
        </div>
      </Link>
    </motion.article>
  );
}
