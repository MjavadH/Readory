'use client';

import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { AppIcon } from '@/components/AppIcon';
import type { IconKey } from '@readory/shared';
import { BookGenre } from '@/lib/types';
import { useTranslations } from 'next-intl';

const genrePalette = [
  {
    grad: 'from-rose-500/20 via-rose-500/5 to-transparent',
    ring: 'ring-rose-500/30',
    dot: 'bg-rose-500',
  },
  {
    grad: 'from-sky-500/20 via-sky-500/5 to-transparent',
    ring: 'ring-sky-500/30',
    dot: 'bg-sky-500',
  },
  {
    grad: 'from-amber-500/20 via-amber-500/5 to-transparent',
    ring: 'ring-amber-500/30',
    dot: 'bg-amber-500',
  },
  {
    grad: 'from-emerald-500/20 via-emerald-500/5 to-transparent',
    ring: 'ring-emerald-500/30',
    dot: 'bg-emerald-500',
  },
  {
    grad: 'from-fuchsia-500/20 via-fuchsia-500/5 to-transparent',
    ring: 'ring-fuchsia-500/30',
    dot: 'bg-fuchsia-500',
  },
  {
    grad: 'from-cyan-500/20 via-cyan-500/5 to-transparent',
    ring: 'ring-cyan-500/30',
    dot: 'bg-cyan-500',
  },
  {
    grad: 'from-orange-500/20 via-orange-500/5 to-transparent',
    ring: 'ring-orange-500/30',
    dot: 'bg-orange-500',
  },
  {
    grad: 'from-indigo-500/20 via-indigo-500/5 to-transparent',
    ring: 'ring-indigo-500/30',
    dot: 'bg-indigo-500',
  },
];

function GenreCardSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-4 md:p-5">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 shrink-0 animate-pulse rounded-xl bg-muted" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-3.5 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-2.5 w-1/2 animate-pulse rounded bg-muted/70" />
        </div>
      </div>
    </div>
  );
}

export function GenresSectionSkeleton({ count = 8 }: { count?: number }) {
  return (
    <section aria-label="Loading genres" aria-busy="true">
      <div className="mb-8 space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 animate-pulse rounded-md bg-muted" />
          <div className="h-3 w-20 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-8 w-64 max-w-[80vw] animate-pulse rounded bg-muted md:h-10" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4">
        {Array.from({ length: count }).map((_, i) => (
          <GenreCardSkeleton key={i} />
        ))}
      </div>
    </section>
  );
}

export function GenresSection({ genres }: { genres: BookGenre[] }) {
  const t = useTranslations('HomePage');

  if (genres.length === 0) return null;

  return (
    <section className="relative">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="mb-8 flex flex-col gap-3 sm:mb-10 sm:flex-row sm:items-end sm:justify-between"
      >
        <div className="min-w-0">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1 backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
              {t('Explore')}
            </span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl">
            {t('BrowseGenre')}
          </h2>
        </div>
      </motion.header>

      {/* Grid */}
      <motion.ul
        variants={{
          hidden: {},
          show: {
            transition: { staggerChildren: 0.06, delayChildren: 0.05 },
          },
        }}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-40px' }}
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4"
      >
        {genres.map((genre, index) => {
          const c = genrePalette[index % genrePalette.length];
          return (
            <motion.li
              key={genre.slug}
              variants={{
                hidden: { opacity: 0, y: 16, scale: 0.98 },
                show: {
                  opacity: 1,
                  y: 0,
                  scale: 1,
                  transition: { type: 'spring', stiffness: 260, damping: 24 },
                },
              }}
              className="min-w-0"
            >
              <Link
                href={`/genres/${genre.slug}`}
                className="group relative block h-full focus:outline-none"
              >
                <motion.div
                  whileHover={{ y: -3 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className={`relative h-full overflow-hidden rounded-2xl border border-border/60 bg-card/70 p-4 backdrop-blur-sm ring-1 ring-transparent transition-colors duration-300 group-hover:border-border group-hover:${c.ring} group-focus-visible:ring-2 group-focus-visible:ring-primary md:p-5`}
                >
                  {/* gradient wash */}
                  <div
                    aria-hidden
                    className={`absolute inset-0 -z-10 bg-linear-to-br ${c.grad} opacity-80`}
                  />
                  {/* corner glow */}
                  <div
                    aria-hidden
                    className={`absolute -top-10 -inset-e-10 h-24 w-24 rounded-full ${c.dot} opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-30`}
                  />

                  <div className="flex items-center gap-3">
                    <div className="relative shrink-0">
                      <div className="absolute inset-0 rounded-xl bg-linear-to-br from-foreground/10 to-transparent" />
                      <div className="relative grid h-11 w-11 place-items-center rounded-xl border border-border/60 bg-background/70 backdrop-blur-md transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[-4deg]">
                        <AppIcon
                          name={genre.iconKey as IconKey}
                          className="h-5 w-5 text-foreground"
                        />
                      </div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground transition-colors group-hover:text-primary md:text-base">
                        {genre.name}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground/80">
                        <span className={`h-1 w-1 rounded-full ${c.dot}`} />
                        <span className="truncate">{genre.slug}</span>
                      </span>
                    </div>

                    <ArrowUpRight
                      className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100 rtl:-scale-x-100"
                      aria-hidden
                    />
                  </div>

                  {/* underline sweep */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-4 bottom-0 h-px origin-start scale-x-0 bg-linear-to-r from-transparent via-foreground/40 to-transparent transition-transform duration-500 group-hover:scale-x-100"
                  />
                </motion.div>
              </Link>
            </motion.li>
          );
        })}
      </motion.ul>
    </section>
  );
}
