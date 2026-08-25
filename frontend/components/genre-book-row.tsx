'use client';

import type { IconKey } from '@readory/shared';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppIcon } from '@/components/AppIcon';
import { BookCard } from '@/components/book-card';
import type { BookCardData, BookType } from '@/lib/types';
import { cn } from '@/lib/utils';

interface GenreBook {
  id: number;
  title: string;
  coverImage: string;
  contributors: string | null;
  type: BookType;
  ratingAvg: number | null;
  ratingCount: number;
}

interface GenreBookRowProps {
  genre: {
    id: number;
    name: string;
    slug: string;
    iconKey: IconKey;
    books: GenreBook[];
  };
}

export function GenreBookRow({ genre }: GenreBookRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const t = useTranslations('Genres');

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll);
    return () => {
      el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [checkScroll]);

  function scroll(direction: 'left' | 'right') {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.7;
    el.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth',
    });
  }

  if (genre.books.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      {/* Genre heading */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-5 w-1 rounded-full bg-primary" aria-hidden="true" />
          <Link
            href={`/genres/${genre.slug}`}
            className="text-base font-bold text-foreground transition-colors duration-200 hover:text-primary sm:text-lg"
          >
            <AppIcon name={genre.iconKey as IconKey} className="inline me-1.5 align-sub size-5" />
            {genre.name}
          </Link>
        </div>
        <Link
          href={`/genres/${genre.slug}`}
          className="group/link flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors duration-200 hover:text-primary sm:text-sm"
        >
          {t('SeeAll')}
          <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180 transition-transform duration-200 group-hover/link:translate-x-0.5 rtl:group-hover/link:-translate-x-0.5" />
        </Link>
      </div>

      {/* Scrollable row */}
      <div className="group/row relative">
        {/* Left arrow (desktop) */}
        <button
          type="button"
          aria-label="Scroll left"
          onClick={() => scroll('left')}
          className={cn(
            'absolute -left-1.5 top-[35%] z-20 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full',
            'bg-card/90 text-foreground shadow-lg backdrop-blur-sm border border-border',
            'transition-all duration-200 hover:bg-secondary hover:scale-110',
            'md:flex',
            canScrollLeft
              ? 'opacity-0 group-hover/row:opacity-100'
              : 'pointer-events-none opacity-0',
          )}
        >
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
        </button>

        {/* Right arrow (desktop) */}
        <button
          type="button"
          aria-label="Scroll right"
          onClick={() => scroll('right')}
          className={cn(
            'absolute -right-1.5 top-[35%] z-20 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full',
            'bg-card/90 text-foreground shadow-lg backdrop-blur-sm border border-border',
            'transition-all duration-200 hover:bg-secondary hover:scale-110',
            'md:flex',
            canScrollRight
              ? 'opacity-0 group-hover/row:opacity-100'
              : 'pointer-events-none opacity-0',
          )}
        >
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
        </button>

        {/* Edge fades */}
        <div
          className={cn(
            'pointer-events-none absolute left-0 top-0 z-10 h-full w-8 bg-linear-to-r from-background to-transparent transition-opacity duration-300',
            canScrollLeft ? 'opacity-100' : 'opacity-0',
          )}
        />
        <div
          className={cn(
            'pointer-events-none absolute right-0 top-0 z-10 h-full w-8 bg-linear-to-l from-background to-transparent transition-opacity duration-300',
            canScrollRight ? 'opacity-100' : 'opacity-0',
          )}
        />

        {/* Book cards */}
        <div
          ref={scrollRef}
          className="scrollbar-hide flex gap-3 overflow-x-auto scroll-smooth pb-2 sm:gap-4"
        >
          {genre.books.map((book, i) => {
            const bookData: BookCardData = {
              id: book.id,
              title: book.title,
              coverImage: book.coverImage,
              type: book.type,
              contributors: book.contributors ?? undefined,
              ratingAvg: book.ratingAvg ?? undefined,
              ratingCount: book.ratingCount,
            };

            return (
              <div
                key={book.id}
                className={cn(
                  'shrink-0',
                  'w-[calc((100%-12px)/2.4)] sm:w-[calc((100%-48px)/3.5)] md:w-[calc((100%-60px)/4.5)] lg:w-[calc((100%-80px)/5.5)] xl:w-[calc((100%-100px)/6)]',
                )}
              >
                <BookCard book={bookData} priority={i < 3} />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
