'use client';

import Link from 'next/link';
import { useRef, useState, useEffect } from 'react';
import { AppIcon } from '@/components/AppIcon';
import { cn } from '@/lib/utils';
import type { IconKey } from '@readory/shared';
import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface BookGenre {
  name: string;
  slug: string;
  iconKey?: IconKey;
}

interface GenreCarouselProps {
  genres: BookGenre[];
  isLoading?: boolean;
  activePath?: string;
  onItemClick?: (slug: string) => void;
  onViewAll?: () => void;
}

export function GenreCarousel({
  genres,
  isLoading,
  activePath,
  onItemClick,
  onViewAll,
}: GenreCarouselProps) {
  const t = useTranslations('UserHeader');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    checkScroll();
    const container = scrollContainerRef.current;
    container?.addEventListener('scroll', checkScroll);
    window.addEventListener('resize', checkScroll);

    return () => {
      container?.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex gap-2 overflow-hidden px-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-9 w-20 shrink-0 rounded-full bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (genres.length === 0) {
    return <p className="px-1 py-4 text-center text-sm text-muted-foreground">{t('NoGenres')}</p>;
  }

  return (
    <div className="relative">
      <div
        ref={scrollContainerRef}
        className="flex gap-2 overflow-x-auto scroll-smooth px-1 pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {/* Genre Chips */}
        {genres.map((genre) => {
          const isActive = activePath === `/genres/${genre.slug}`;
          return (
            <Link
              key={genre.slug}
              href={`/genres/${genre.slug}`}
              onClick={() => onItemClick?.(genre.slug)}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-all duration-200 active:scale-95 scroll-snap-align-start whitespace-nowrap',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted/50 text-foreground border border-border/40 hover:bg-muted hover:border-border/60',
              )}
            >
              {genre.iconKey && (
                <AppIcon
                  name={genre.iconKey}
                  className={cn(
                    'h-3.5 w-3.5 transition-colors',
                    isActive ? 'text-primary-foreground' : 'text-muted-foreground',
                  )}
                />
              )}
              <span>{genre.name}</span>
            </Link>
          );
        })}

        {/* View All Button */}
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted/30 px-3 py-2 text-xs font-semibold text-muted-foreground backdrop-blur-sm transition-all duration-200 active:scale-95 hover:bg-muted/50 border border-border/40 whitespace-nowrap scroll-snap-align-start"
          >
            <span>{t('ViewAll')}</span>
            <ChevronDown className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Scroll Gradient Indicators */}
      {canScrollLeft && (
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-linear-to-r from-background via-background/50 to-transparent pointer-events-none hidden sm:block" />
      )}
      {canScrollRight && (
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-linear-to-l from-background via-background/50 to-transparent pointer-events-none hidden sm:block" />
      )}
    </div>
  );
}
