'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Search, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';
import { getBookCoverThumbnailUrl } from '@/lib/media';
import type { LiveSearchHit } from '@/hooks/use-live-search';

interface LiveSearchResultsProps {
  query: string;
  results: LiveSearchHit[];
  isLoading: boolean;
  error?: boolean;
  onSubmit: () => void;
  onSelect: () => void;
  className?: string;
  /** true inside the mobile search bar (static block instead of floating panel) */
  inline?: boolean;
}

export function LiveSearchResults({
  query,
  results,
  isLoading,
  error,
  onSubmit,
  onSelect,
  className,
  inline = false,
}: LiveSearchResultsProps) {
  const t = useTranslations('UserHeader');
  const q = query.trim();

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className={cn(
        'z-50 rounded-xl border border-border bg-popover p-2 text-popover-foreground shadow-xl shadow-black/5',
        inline ? 'mt-2 w-full' : 'absolute inset-x-0 top-full mt-2',
        className,
      )}
      role="listbox"
      aria-label={t('SearchBooks')}
    >
      {/* Search-for-term action */}
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-lg p-2.5 text-start text-sm transition-colors hover:bg-accent"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onSubmit}
      >
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="truncate">
          {t('SearchFor')} <span className="font-medium text-foreground">{q}</span>
        </span>
        {isLoading && (
          <Loader2 className="ms-auto h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
        )}
      </button>

      {(results.length > 0 || (!isLoading && q.length >= 2)) && (
        <div className="my-1 h-px bg-border" />
      )}

      {/* Results */}
      {results.length > 0 ? (
        <ul className="max-h-[60vh] overflow-y-auto overscroll-contain sm:max-h-80">
          {results.map((book, i) => (
            <motion.li
              key={book.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.12, ease: 'easeOut', delay: i * 0.03 }}
            >
              <Link
                href={`/${book.bookTypeSlug}/${book.id}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={onSelect}
                className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
              >
                <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded-md bg-muted">
                  {book.coverImage && (
                    <Image
                      src={getBookCoverThumbnailUrl(book.coverImage)}
                      alt={book.title}
                      fill
                      sizes="40px"
                      className="object-cover"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{book.title}</p>
                  <p className="truncate text-xs capitalize text-muted-foreground">
                    {book.bookTypeSlug}
                  </p>
                </div>
              </Link>
            </motion.li>
          ))}
        </ul>
      ) : (
        !isLoading &&
        q.length >= 2 && (
          <p className="px-2.5 py-3 text-sm text-muted-foreground">
            {error ? t('SearchError') : t('NoResults')}
          </p>
        )
      )}
    </motion.div>
  );
}
