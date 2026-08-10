import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, ChevronLeft, ChevronRight, Star } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AppIcon } from '@/components/AppIcon';
import { getBookCoverThumbnailUrl } from '@/lib/media';
import type { BookCardData } from '@/lib/types';
import { useLocaleInfo } from '@/hooks/use-locale-info';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import Image from 'next/image';

export function HeroSkeleton() {
  return (
    <div className="relative w-full min-h-104 md:min-h-120 rounded-3xl bg-secondary/40 overflow-hidden">
      <div className="absolute inset-0 bg-linear-to-r from-secondary via-secondary/80 to-transparent rtl:bg-linear-to-l" />
      <div className="relative flex flex-col-reverse md:flex-row items-center h-full p-6 md:p-12 lg:p-16 gap-6 md:gap-12">
        <div className="flex-1 w-full min-w-0 space-y-5">
          <div className="h-5 bg-muted animate-pulse rounded-full w-24" />
          <div className="h-10 bg-muted animate-pulse rounded-lg w-4/5" />
          <div className="h-4 bg-muted animate-pulse rounded w-1/5" />
          <div className="space-y-2">
            <div className="h-4 bg-muted animate-pulse rounded w-2/4" />
            <div className="h-4 bg-muted animate-pulse rounded w-2/4" />
            <div className="h-4 bg-muted animate-pulse rounded w-2/5" />
          </div>
          <div className="flex gap-3 pt-2">
            <div className="h-5 w-16 bg-muted animate-pulse rounded-full" />
            <div className="h-5 w-24 bg-muted animate-pulse rounded-full" />
            <div className="h-5 w-20 bg-muted animate-pulse rounded-full" />
          </div>
          <div className="flex gap-3 pt-2">
            <div className="h-10 w-36 bg-muted animate-pulse rounded-full" />
          </div>
        </div>
        <div className="w-40 sm:w-48 md:w-56 aspect-2/3 bg-muted animate-pulse rounded-2xl shrink-0" />
      </div>
    </div>
  );
}

export function HeroCarousel({ books }: { books: BookCardData[] }) {
  const t = useTranslations('HomePage');
  const [[current, direction], setState] = useState<[number, 1 | -1]>([0, 1]);
  const [isHovered, setIsHovered] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const touchStartX = useRef<number | null>(null);
  const { isRTL } = useLocaleInfo();

  const goTo = useCallback(
    (idx: number, dirHint: 1 | -1) => {
      if (books.length === 0) return;
      const next = ((idx % books.length) + books.length) % books.length;
      setState([next, dirHint]);
    },
    [books.length],
  );

  const next = useCallback(() => goTo(current + 1, 1), [current, goTo]);
  const prev = useCallback(() => goTo(current - 1, -1), [current, goTo]);

  useEffect(() => {
    if (books.length <= 1 || isHovered) return;
    const timer = window.setInterval(next, 7000);
    return () => window.clearInterval(timer);
  }, [books.length, isHovered, next]);

  if (books.length === 0) return null;

  const book = books[current];
  const bookTypeSlug = book.type.slug;
  const coverSrc = book.coverImage ? getBookCoverThumbnailUrl(book.coverImage) : '/placeholder.svg';
  const bookHref = `/${bookTypeSlug}/${book.id}`;

  const rtlMul = isRTL ? -1 : 1;
  const slideVariants = prefersReducedMotion
    ? {
        enter: { opacity: 0 },
        center: { opacity: 1 },
        exit: { opacity: 0 },
      }
    : {
        enter: (d: 1 | -1) => ({ opacity: 0, x: 40 * d * rtlMul, scale: 0.98 }),
        center: { opacity: 1, x: 0, scale: 1 },
        exit: (d: 1 | -1) => ({ opacity: 0, x: -40 * d * rtlMul, scale: 0.98 }),
      };

  return (
    <section
      dir={isRTL ? 'rtl' : 'ltr'}
      className="relative w-full min-h-104 md:min-h-120 rounded-3xl overflow-hidden group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={(e) => (touchStartX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchStartX.current == null) return;
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        if (Math.abs(dx) > 40) {
          const forward = isRTL ? dx > 0 : dx < 0;
          if (forward) {
            next();
          } else {
            prev();
          }
        }
        touchStartX.current = null;
      }}
      aria-roledescription="carousel"
      aria-label="Featured books"
    >
      {/* Background */}
      <AnimatePresence initial={false} custom={direction} mode="popLayout">
        <motion.div
          key={`bg-${current}`}
          custom={direction}
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1.1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="absolute inset-0"
        >
          <Image
            src={coverSrc}
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover blur-md"
            fill
            sizes="(max-width: 480px) 45vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 200px"
          />
          <div className="absolute inset-0 bg-linear-to-r from-secondary/95 via-secondary/85 to-secondary/50 rtl:bg-linear-to-l" />
          <div className="absolute inset-0 bg-linear-to-t from-secondary/80 via-transparent to-secondary/30" />
        </motion.div>
      </AnimatePresence>

      {/* Foreground */}
      <div className="relative flex flex-col-reverse md:flex-row items-center h-full min-h-104 md:min-h-120 p-5 sm:p-8 md:p-12 lg:p-16 gap-6 md:gap-12">
        <div className="flex-1 min-w-0 w-full">
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
              key={`text-${current}`}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col justify-center min-w-0"
            >
              <div className="flex items-center gap-2 mb-3 sm:mb-4">
                <span className="inline-flex items-center gap-1.5 text-base sm:text-lg font-medium text-muted-foreground">
                  <AppIcon name={book.type.iconKey} className="h-5 w-5" />
                  {book.type.name}
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-secondary-foreground leading-tight mb-3 line-clamp-2">
                {book.title}
              </h1>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-3 sm:mb-4">
                <span className="text-sm font-medium text-secondary-foreground/70">
                  {t('By')} {book.contributors}
                </span>
                {book.ratingAvg && (
                  <>
                    <span className="w-1 h-1 rounded-full bg-secondary-foreground/30" />
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-secondary-foreground/70">
                      <Star className="w-3.5 h-3.5 fill-primary text-primary" />
                      {book.ratingAvg}
                    </span>
                  </>
                )}
              </div>

              <p className="text-sm md:text-base text-secondary-foreground/70 leading-relaxed mb-5 sm:mb-6 line-clamp-3 sm:line-clamp-2 max-w-lg">
                {book.description}
              </p>

              {book.genres && book.genres.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-6 sm:mb-7">
                  {book.genres.map((genre, idx) => (
                    <Badge
                      key={`${book.id}-genre-${idx}`}
                      variant="outline"
                      className="border-secondary-foreground/15 text-secondary-foreground/70 bg-secondary-foreground/5 backdrop-blur-sm text-xs px-3 py-1 rounded-full gap-1"
                    >
                      <AppIcon name={genre.iconKey} className="h-3 w-3" />
                      {genre.name}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-3">
                <Button
                  asChild
                  size="lg"
                  className="rounded-full font-semibold px-6 sm:px-7 gap-2 shadow-lg hover:shadow-xl transition-all"
                >
                  <Link href={bookHref}>
                    {t('StartReading')}
                    <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                  </Link>
                </Button>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Cover */}
        <div className="shrink-0 flex items-center justify-center">
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
              key={`cover-${current}`}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            >
              <Link href={bookHref} className="block" aria-label={book.title}>
                <motion.div
                  whileHover={prefersReducedMotion ? undefined : { scale: 1.04, rotate: 1 }}
                  transition={{ type: 'spring', stiffness: 220, damping: 18 }}
                  className="relative w-36 sm:w-44 md:w-52 lg:w-60 aspect-2/3 rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10"
                >
                  <Image
                    src={coverSrc}
                    alt={book.title}
                    className="w-full h-full object-cover"
                    loading="eager"
                    fill
                    sizes="(max-width: 480px) 45vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 200px"
                  />
                  <div className="absolute inset-0 bg-linear-to-tr from-transparent via-white/5 to-white/10 pointer-events-none" />
                </motion.div>
              </Link>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Controls */}
      {books.length > 1 && (
        <>
          <button
            type="button"
            onClick={prev}
            className="absolute inset-s-3 md:inset-s-5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-secondary-foreground/10 backdrop-blur-sm border border-secondary-foreground/10 flex items-center justify-center text-secondary-foreground/70 hover:bg-secondary-foreground/20 hover:text-secondary-foreground transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Previous slide"
          >
            <ChevronLeft className="w-5 h-5 rtl:hidden" />
            <ChevronRight className="w-5 h-5 hidden rtl:block" />
          </button>

          <button
            type="button"
            onClick={next}
            className="absolute inset-e-3 md:inset-e-5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-secondary-foreground/10 backdrop-blur-sm border border-secondary-foreground/10 flex items-center justify-center text-secondary-foreground/70 hover:bg-secondary-foreground/20 hover:text-secondary-foreground transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Next slide"
          >
            <ChevronRight className="w-5 h-5 rtl:hidden" />
            <ChevronLeft className="w-5 h-5 hidden rtl:block" />
          </button>

          {/* Dots */}
          <div className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
            {books.map((b, idx) => (
              <button
                key={b.id}
                type="button"
                onClick={() => goTo(idx, idx > current ? 1 : -1)}
                aria-label={`Go to slide ${idx + 1}`}
                aria-current={idx === current}
                className="h-1.5 rounded-full transition-all bg-secondary-foreground/30 hover:bg-secondary-foreground/60 data-[active=true]:bg-primary"
                data-active={idx === current}
                style={{ width: idx === current ? 24 : 8 }}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
