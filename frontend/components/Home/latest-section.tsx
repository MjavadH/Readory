'use client';

import { motion } from 'framer-motion';
import { ArrowUpRight, BookOpen, Clock, Lock, Sparkles } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { getBookCoverThumbnailUrl } from '@/lib/media';
import { formatUpdateTime } from '@/lib/time';
import type { BookType } from '@/lib/types';

interface Chapter {
  id: number;
  num: number;
  title: string;
  free: boolean;
}

interface LatestBook {
  id: number;
  title: string;
  cover: string;
  time: string;
  type: BookType;
  chapters: Chapter[];
}

function LatestItemSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 p-4 backdrop-blur-sm">
      <div className="flex gap-4">
        <div className="relative aspect-2/3 w-24 shrink-0 overflow-hidden rounded-xl bg-muted sm:w-28">
          <div className="h-full w-full animate-pulse bg-linear-to-br from-muted to-muted-foreground/10" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="space-y-2">
            <div className="h-4 w-[85%] animate-pulse rounded-md bg-muted" />
            <div className="h-4 w-[55%] animate-pulse rounded-md bg-muted" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
            <div className="h-3 w-20 animate-pulse rounded bg-muted" />
          </div>
          <div className="mt-auto space-y-1.5">
            <div className="h-8 w-full animate-pulse rounded-lg bg-muted" />
            <div className="h-8 w-full animate-pulse rounded-lg bg-muted" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function LatestSectionSkeleton({ count = 6 }: { count?: number }) {
  const SKELETON_KEYS = Array.from(
    { length: count },
    (_, i) => `dashboard-collection-skeleton-${i}`,
  );
  return (
    <section aria-label="Loading latest updates" aria-busy="true" className="relative">
      <div className="mb-8 flex items-end justify-between">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1">
            <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
            <div className="h-3 w-20 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-9 w-64 max-w-[80vw] animate-pulse rounded-lg bg-muted md:h-10 md:w-80" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {SKELETON_KEYS.map((key) => (
          <LatestItemSkeleton key={key} />
        ))}
      </div>
    </section>
  );
}

export function LatestSection({ books }: { books: LatestBook[] }) {
  const router = useRouter();
  const t = useTranslations('HomePage');
  const ti = useTranslations('Time');

  if (books.length === 0) return null;

  const filtered = books.filter((b) => b.chapters.length > 0);

  return (
    <section className="relative">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="mb-8 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
              {t('FreshDrops')}
            </span>
          </div>
          <h2 className="bg-linear-to-br from-foreground to-foreground/60 bg-clip-text text-3xl font-bold leading-tight text-transparent md:text-4xl">
            {t('LatestUpdates')}
          </h2>
        </div>
        <div className="hidden h-px flex-1 bg-linear-to-r from-transparent via-border to-transparent sm:mx-8 sm:block rtl:bg-linear-to-l" />
      </motion.div>

      {/* Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((book, index) => {
          const typeSlug = book.type.slug;
          const typeDisplay = book.type.name;
          const isFree = book.chapters[0]?.free;

          return (
            <motion.article
              key={book.id}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-30px' }}
              transition={{
                duration: 0.45,
                delay: Math.min(index * 0.05, 0.3),
                ease: [0.22, 1, 0.36, 1],
              }}
              whileHover={{ y: -4 }}
              onClick={() => router.push(`/${typeSlug}/${book.id}`)}
              className="group relative flex cursor-pointer gap-4 overflow-hidden rounded-2xl border border-border/60 bg-card/80 p-4 shadow-sm backdrop-blur-sm transition-colors duration-300 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
            >
              {/* Hover gradient wash */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/0 via-primary/0 to-primary/0 opacity-0 transition-opacity duration-500 group-hover:from-primary/5 group-hover:via-transparent group-hover:to-primary/10 group-hover:opacity-100"
              />

              {/* Cover */}
              <div className="relative aspect-2/3 w-24 shrink-0 overflow-hidden rounded-xl bg-muted shadow-md ring-1 ring-border/50 sm:w-28">
                <Image
                  src={book.cover ? getBookCoverThumbnailUrl(book.cover) : '/placeholder.svg'}
                  alt={book.title}
                  fill
                  sizes="(max-width: 480px) 45vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 200px"
                  className="object-cover transition-transform duration-700 group-hover:scale-110"
                />
                {/* subtle bottom gradient on cover */}
                <div
                  aria-hidden
                  className="absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-t from-black/50 to-transparent"
                />
                {isFree && (
                  <div className="absolute inset-s-1.5 top-1.5">
                    <Badge className="border-0 bg-emerald-500/95 px-1.5 py-0 text-[10px] font-bold tracking-wide text-white shadow-lg shadow-emerald-500/30">
                      {t('Free')}
                    </Badge>
                  </div>
                )}
                {/* Arrow appearing on hover */}
                <div className="absolute inset-e-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-background/90 opacity-0 shadow-md backdrop-blur-sm transition-all duration-300 group-hover:opacity-100 rtl:rotate-270">
                  <ArrowUpRight className="h-3.5 w-3.5 text-foreground" />
                </div>
              </div>

              {/* Info */}
              <div className="relative flex min-w-0 flex-1 flex-col justify-between py-0.5">
                <div className="min-w-0">
                  <h3 className="line-clamp-2 text-sm font-bold leading-snug text-foreground transition-colors duration-300 group-hover:text-primary sm:text-base">
                    {book.title}
                  </h3>

                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Badge
                      variant="secondary"
                      className="rounded-full border border-border/60 bg-secondary/70 px-2 py-0 text-[10px] font-medium"
                    >
                      {typeDisplay}
                    </Badge>
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatUpdateTime(book.time, ti)}
                    </span>
                  </div>
                </div>

                {/* Chapters */}
                <div className="mt-3 flex flex-col gap-1.5">
                  {book.chapters.slice(0, 2).map((ch) => (
                    <Link
                      key={ch.id}
                      href={`/${typeSlug}/${book.id}/c/${ch.num}`}
                      onClick={(e) => e.stopPropagation()}
                      className="group/ch flex items-center justify-between rounded-lg border border-border/40 bg-muted/60 px-2.5 py-1.5 text-xs transition-all duration-200 hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
                    >
                      <span className="inline-flex items-center gap-1.5 font-medium">
                        <BookOpen className="h-3 w-3 opacity-60 line-clamp-1 transition-opacity group-hover/ch:opacity-100" />
                        {ch.title}
                      </span>
                      <span
                        className={
                          ch.free
                            ? 'inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400'
                            : 'inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground'
                        }
                      >
                        {!ch.free && <Lock className="h-2.5 w-2.5" />}
                        {ch.free ? t('Free') : t('Paid')}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </motion.article>
          );
        })}
      </div>
    </section>
  );
}
