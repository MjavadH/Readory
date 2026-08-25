'use client';

import { Clock, Star, StickyNote } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { getBookCoverThumbnailUrl } from '@/lib/media';
import { formatUpdateTime } from '@/lib/time';
import type { BookCardData } from '@/lib/types';
import { getBookUrl } from '@/lib/types';
import { cn } from '@/lib/utils';

interface BookCardProps {
  book: BookCardData;
  priority?: boolean;
  className?: string;
  link?: string;
  note?: string | null;
  noteLabel?: string;
}

interface BookCardSkeletonProps {
  className?: string;
}

export function BookCardSkeleton({ className }: BookCardSkeletonProps) {
  return (
    <div className={cn('flex flex-col', className)} aria-hidden="true">
      {/* Cover placeholder */}
      <div className="aspect-2/3 w-full animate-pulse rounded-lg bg-muted" />
      {/* Text placeholders */}
      <div className="flex flex-col gap-1.5 px-0.5 pt-2.5">
        <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
        <div className="h-3 w-3/5 animate-pulse rounded bg-muted" />
        <div className="flex gap-1.5 pt-0.5">
          <div className="h-3 w-8 animate-pulse rounded-full bg-muted" />
          <div className="h-3 w-12 animate-pulse rounded-full bg-muted" />
        </div>
      </div>
    </div>
  );
}

export function BookCard({
  book,
  priority = false,
  className,
  link,
  note,
  noteLabel,
}: BookCardProps) {
  const t = useTranslations('Books');
  const ti = useTranslations('Time');
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const url = getBookUrl(book);

  return (
    <Link
      href={link ?? url}
      className={cn(
        'group relative flex flex-col rounded-lg outline-none',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        className,
      )}
      aria-label={`View ${book.title}${book.contributors ? ` by ${book.contributors}` : ''}`}
    >
      {/* Cover Image Container */}
      <div className="relative aspect-2/3 w-full overflow-hidden rounded-lg bg-muted">
        {/* Skeleton / loading state */}
        <div className={cn('absolute inset-0 animate-pulse bg-muted', isImageLoaded && 'hidden')}>
          <div className="flex h-full items-center justify-center">
            <svg
              className="h-8 w-8 text-muted-foreground/30"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
          </div>
        </div>

        {/* Image with smooth scale on hover */}
        <Image
          src={book.coverImage ? getBookCoverThumbnailUrl(book.coverImage) : '/placeholder.svg'}
          alt={`Cover of ${book.title}`}
          fill
          sizes="(max-width: 480px) 45vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 200px"
          className={cn(
            'object-cover transition-all duration-500 ease-out',
            'group-hover:scale-105',
            isImageLoaded ? 'opacity-100' : 'opacity-0',
          )}
          priority={priority}
          onLoad={() => setIsImageLoaded(true)}
          loading={priority ? 'eager' : 'lazy'}
        />

        {/* Hover overlay with subtle gradient */}
        <div
          className={cn(
            'pointer-events-none absolute inset-0 rounded-lg transition-opacity duration-300',
            'bg-linear-to-t from-foreground/40 via-transparent to-transparent',
            'opacity-0 group-hover:opacity-100',
          )}
        />

        {/* Type badge - top left */}
        {book.type && (
          <div className="absolute left-2 top-2 z-10">
            <Badge
              variant="secondary"
              className="bg-background/80 text-foreground backdrop-blur-sm text-[10px] px-1.5 py-0.5 font-medium shadow-sm"
            >
              {book.type.name}
            </Badge>
          </div>
        )}

        {/* Featured indicator - top right */}
        {book.isFeatured && (
          <div className="absolute right-2 top-2 z-10">
            <div
              role="img"
              aria-label="Featured book"
              className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 shadow-sm"
            >
              <Star className="h-3 w-3 fill-background text-background" />
            </div>
          </div>
        )}

        {/* Note popup - visible on hover */}
        {note && noteLabel && (
          <div className="absolute inset-x-2 bottom-2 z-20 translate-y-2 rounded-lg bg-background/95 p-2 text-start text-[11px] leading-relaxed text-foreground opacity-0 shadow-lg backdrop-blur transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
            <div className="mb-1 flex items-center gap-1 font-semibold text-primary">
              <StickyNote className="h-3 w-3" />
              <span>{noteLabel}</span>
            </div>
            <p dir="auto" className="line-clamp-4">
              {note}
            </p>
          </div>
        )}

        {/* Chapter count - bottom right, visible on hover */}
        {book.chapterCount !== undefined && book.chapterCount > 0 && (
          <div
            className={cn(
              'absolute bottom-2 right-2 z-10',
              'translate-y-2 opacity-0 transition-all duration-300',
              'group-hover:translate-y-0 group-hover:opacity-100',
            )}
          >
            <Badge
              variant="secondary"
              className="bg-background/80 text-foreground backdrop-blur-sm text-[10px] px-1.5 py-0.5 font-medium shadow-sm"
            >
              {t('ChapterCount', { ChapterCount: book.chapterCount })}
            </Badge>
          </div>
        )}
      </div>

      {/* Info section below the cover */}
      <div className="flex flex-col gap-1 px-0.5 pt-2.5 pb-1">
        {/* Title */}
        <h3
          className={cn(
            'line-clamp-2 text-sm font-semibold leading-snug text-foreground',
            'transition-colors duration-200 group-hover:text-primary',
          )}
        >
          {book.title}
        </h3>

        {/* Contributor */}
        {book.contributors && (
          <p className="line-clamp-1 text-xs text-muted-foreground">{book.contributors}</p>
        )}

        {/* Updated date */}
        {book.updatedAt && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{formatUpdateTime(new Date(book.updatedAt), ti)}</span>
          </div>
        )}

        {/* Rating + Genres row */}
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {/* Rating */}
          {book.ratingAvg !== undefined && book.ratingAvg > 0 && (
            <div
              role="img"
              aria-label={`Rating: ${book.ratingAvg} out of 5`}
              className="flex items-center gap-1"
            >
              <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
              <span className="text-xs font-medium text-foreground">{book.ratingAvg}</span>
              {book.ratingCount !== undefined && book.ratingCount > 0 && (
                <span className="text-[10px] text-muted-foreground">
                  ({book.ratingCount.toLocaleString()})
                </span>
              )}
            </div>
          )}

          {/* Genre pills - show max 2 on mobile, 3 on desktop */}
          {book.genres && book.genres.length > 0 && (
            <div className="flex items-center gap-1 overflow-hidden">
              {book.genres.slice(0, 2).map((genre) => (
                <span
                  key={genre.slug}
                  className="shrink-0 rounded-full bg-secondary px-1.5 py-px text-[10px] text-secondary-foreground"
                >
                  {genre.name}
                </span>
              ))}
              {book.genres.length > 2 && (
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  +{book.genres.length - 2}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
