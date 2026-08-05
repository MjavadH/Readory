'use client';

import Link from 'next/link';
import { useRef, useState, useEffect } from 'react';
import { AppIcon } from '@/components/AppIcon';
import { cn } from '@/lib/utils';
import type { IconKey } from '@readory/shared';
import { useTranslations } from 'next-intl';

interface BookType {
  name: string;
  slug: string;
  iconKey: IconKey;
}

interface TypeCarouselProps {
  types: BookType[];
  isLoading?: boolean;
  activePath?: string;
  onItemClick?: (slug: string) => void;
}

export function TypeCarousel({ types, isLoading, activePath, onItemClick }: TypeCarouselProps) {
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

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 200;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex gap-2 overflow-hidden px-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex h-12 w-24 shrink-0 items-center justify-center rounded-lg bg-muted animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (types.length === 0) {
    return <p className="px-1 py-4 text-center text-sm text-muted-foreground">{t('NoBookType')}</p>;
  }

  return (
    <div className="relative">
      <div
        ref={scrollContainerRef}
        className="flex gap-2 overflow-x-auto scroll-smooth px-1 pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {types.map((type) => {
          const isActive = activePath === `/${type.slug}`;
          return (
            <Link
              key={type.slug}
              href={`/${type.slug}`}
              onClick={() => onItemClick?.(type.slug)}
              className={cn(
                'flex shrink-0 flex-col items-center gap-2 rounded-xl px-4 py-3 text-center transition-all duration-200 active:scale-95 scroll-snap-align-start',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted/60 text-foreground hover:bg-muted',
              )}
            >
              <div className="flex h-6 w-6 items-center justify-center">
                <AppIcon
                  name={type.iconKey}
                  className={cn(
                    'h-5 w-5 transition-colors',
                    isActive ? 'text-primary-foreground' : 'text-muted-foreground',
                  )}
                />
              </div>
              <span className="text-xs font-semibold whitespace-nowrap">{type.name}</span>
            </Link>
          );
        })}
      </div>

      {/* Scroll Indicators (optional, on mobile hide) */}
      {canScrollLeft && (
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-linear-to-r from-background via-background/50 to-transparent pointer-events-none hidden sm:block" />
      )}
      {canScrollRight && (
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-linear-to-l from-background via-background/50 to-transparent pointer-events-none hidden sm:block" />
      )}
    </div>
  );
}
