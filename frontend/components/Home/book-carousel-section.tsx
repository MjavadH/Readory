'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { BookCard, BookCardSkeleton } from '@/components/book-card';
import type { BookCardData } from '@/lib/types';
import { cn } from '@/lib/utils';

export interface BookCarouselSectionProps {
  /** Books to render. If empty, the section renders nothing. */
  books: BookCardData[];
  /** Lucide icon shown beside the eyebrow. */
  icon: LucideIcon;
  /** Small eyebrow text above the title (already translated). */
  eyebrow: string;
  /** Main heading (already translated). */
  title: string;
  /** aria-label for the section landmark. */
  ariaLabel?: string;
}

interface SkeletonProps {
  icon: LucideIcon;
  count?: number;
  ariaLabel?: string;
}

export function BookCarouselSkeleton({
  icon: Icon,
  count = 8,
  ariaLabel = 'Loading books',
}: SkeletonProps) {
  return (
    <section aria-label={ariaLabel} aria-busy="true" className="relative">
      <div className="mb-5 flex items-center gap-3 px-1 sm:mb-6">
        <div className="relative grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-muted animate-pulse sm:h-11 sm:w-11">
          <Icon className="h-4 w-4 text-muted-foreground/60" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-3 w-24 rounded-full bg-muted animate-pulse" />
          <div className="h-5 w-56 max-w-[70vw] rounded-md bg-muted animate-pulse sm:h-6" />
        </div>
        <div className="hidden h-2 w-24 rounded-full bg-muted animate-pulse sm:block" />
      </div>

      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-hidden px-4 pb-3 sm:gap-4 sm:px-6 md:-mx-6">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="w-[42vw] max-w-44 shrink-0 sm:w-40 md:w-44 lg:w-48">
            <BookCardSkeleton />
          </div>
        ))}
      </div>
    </section>
  );
}

function useDragScroll<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const state = useRef({ pointerId: -1, startX: 0, startScroll: 0, moved: false });
  const [isDragging, setIsDragging] = useState(false);

  const onPointerDown = useCallback((e: React.PointerEvent<T>) => {
    if (e.pointerType === 'touch' || e.button !== 0) return;
    const el = ref.current;
    if (!el) return;
    state.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startScroll: el.scrollLeft,
      moved: false,
    };
    setIsDragging(true);
  }, []);

  const endDrag = useCallback((e: React.PointerEvent<T>) => {
    if (state.current.pointerId !== e.pointerId) return;
    const el = ref.current;
    if (el?.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    state.current.pointerId = -1;
    setIsDragging(false);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<T>) => {
    const el = ref.current;
    if (!el || state.current.pointerId !== e.pointerId) return;
    const dx = e.clientX - state.current.startX;
    if (!state.current.moved) {
      if (Math.abs(dx) < 4) return;
      state.current.moved = true;
      el.setPointerCapture(e.pointerId);
    }
    e.preventDefault();
    el.scrollLeft = state.current.startScroll - dx;
  }, []);

  // Swallow the click that follows a drag so cards don't navigate accidentally.
  const onClickCapture = useCallback((e: React.MouseEvent<T>) => {
    if (state.current.moved) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  return {
    ref,
    isDragging,
    dragProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      onClickCapture,
      onDragStartCapture: (e: React.DragEvent<T>) => e.preventDefault(),
    },
  };
}

export function BookCarouselSection({
  books,
  icon: Icon,
  eyebrow,
  title,
  ariaLabel,
}: BookCarouselSectionProps) {
  const prefersReducedMotion = useReducedMotion();
  const { ref: railRef, isDragging, dragProps } = useDragScroll<HTMLDivElement>();

  if (books.length === 0) return null;

  return (
    <section aria-label={ariaLabel ?? title} className="relative">
      {/* Header */}
      <motion.div
        className="mb-5 flex items-center gap-3 px-1 sm:mb-6"
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Icon tile */}
        <div className="relative grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-primary/15 via-primary/5 to-transparent ring-1 ring-primary/20 sm:h-11 sm:w-11">
          <Icon className="h-4.5 w-4.5 text-primary sm:h-5 sm:w-5" />
          <span className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/5" />
        </div>

        {/* Text */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/80 sm:text-xs">
              {eyebrow}
            </span>
            <span
              aria-hidden
              className="h-px flex-1 bg-linear-to-r from-primary/30 to-transparent rtl:from-transparent rtl:to-primary/30"
            />
          </div>
          <h2 className="mt-1 truncate text-lg font-bold tracking-tight text-foreground sm:text-2xl md:text-[26px]">
            {title}
          </h2>
        </div>
      </motion.div>

      {/* Rail */}
      <div className="relative">
        {/* Edge fades */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 -left-4 sm:-left-6 z-10 w-6 bg-linear-to-r from-background to-transparent sm:w-10"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 -right-4 sm:-right-7 z-10 w-6 bg-linear-to-l from-background to-transparent sm:w-10"
        />

        <motion.div
          ref={railRef}
          {...dragProps}
          className={cn(
            'scrollbar-hide -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto overflow-y-visible px-4 pb-3 pt-1 sm:gap-4 sm:px-6 md:-mx-6',
            'scroll-px-4 sm:scroll-px-6',
            '[-webkit-overflow-scrolling:touch] overscroll-x-contain',
            'md:cursor-grab',
            isDragging && 'md:cursor-grabbing select-none snap-none',
          )}
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          variants={{
            hidden: {},
            visible: {
              transition: {
                staggerChildren: prefersReducedMotion ? 0 : 0.05,
                delayChildren: 0.1,
              },
            },
          }}
        >
          {books.map((book, index) => (
            <motion.div
              key={book.id}
              variants={{
                hidden: { opacity: 0, y: 24, scale: 0.96 },
                visible: {
                  opacity: 1,
                  y: 0,
                  scale: 1,
                  transition: {
                    duration: 0.4,
                    ease: [0.22, 1, 0.36, 1],
                  },
                },
              }}
              whileHover={
                prefersReducedMotion ? undefined : { y: -6, transition: { duration: 0.2 } }
              }
              className="group relative w-[42vw] max-w-44 shrink-0 snap-start sm:w-40 md:w-44 lg:w-48"
            >
              {/* Subtle glow behind card on hover */}
              <span
                aria-hidden
                className="pointer-events-none absolute -inset-2 -z-10 rounded-3xl bg-linear-to-br from-primary/10 via-transparent to-transparent opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-100"
              />
              <BookCard book={book} priority={index < 6} />
            </motion.div>
          ))}

          {/* Trailing spacer so the last card can snap comfortably */}
          <div aria-hidden className="w-2 shrink-0 sm:w-4" />
        </motion.div>
      </div>
    </section>
  );
}
