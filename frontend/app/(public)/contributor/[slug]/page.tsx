'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { BookOpen, Calendar, ChevronDown, Library, UserIcon } from 'lucide-react';

import { apiClient, getApiErrorMessage } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { BookCard, BookCardSkeleton } from '@/components/book-card';
import { AppPagination } from '@/components/app-pagination';
import type { BookCardData } from '@/lib/types';
import { ContributorGender } from '@readory/shared';

type ContributorPublic = {
  id: number;
  name: string;
  originalName: string | null;
  slug: string;
  biography: string | null;
  gender: ContributorGender;
  bookCount: number;
  updatedAt: string;
};

type ContributorPublicResponse = {
  contributors: ContributorPublic;
  books: BookCardData[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

const PAGE_SIZE = 18;
const BIO_COLLAPSED_CHARS = 320;

export default function ContributorPublicPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? '';

  const t = useTranslations('Contributors');

  const [page, setPage] = useState(1);
  const [data, setData] = useState<ContributorPublicResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bioExpanded, setBioExpanded] = useState(false);

  const booksSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    const controller = new AbortController();

    setIsLoading(true);
    setError(null);

    apiClient
      .get<ContributorPublicResponse>(`contributor/public/${slug}`, {
        query: { page, limit: PAGE_SIZE },
        signal: controller.signal,
      })
      .then((res) => {
        if (cancelled) return;
        setData(res);
      })
      .catch((err) => {
        if (cancelled || controller.signal.aborted) return;
        setError(getApiErrorMessage(err, t('LoadError')));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [slug, page, t]);

  const contributors = data?.contributors;
  const pagination = data?.pagination;

  const books: BookCardData[] = useMemo(() => {
    if (!data?.books) return [];
    return data.books.map((b) => ({
      id: b.id,
      title: b.title,
      coverImage: b.coverImage,
      ratingAvg: b.ratingAvg ?? undefined,
      ratingCount: b.ratingCount ?? undefined,
      type: b.type ?? undefined,
      genres: b.genres,
      chapterCount: b.chapterCount ?? undefined,
      updatedAt: b.updatedAt,
      contributors: contributors?.name,
    })) as BookCardData[];
  }, [data?.books, contributors?.name]);

  if (isLoading && !data) {
    return <ContributorPageSkeleton />;
  }

  if (error && !data) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-destructive/10 text-destructive">
          <UserIcon className="h-8 w-8" />
        </div>
        <h1 className="mt-4 text-xl font-semibold">{t('NotFoundTitle')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!contributors) return null;

  const initials = getInitials(contributors.name);
  const bioText = contributors.biography?.trim() ?? '';
  const isBioLong = bioText.length > BIO_COLLAPSED_CHARS;
  const bioDisplay =
    !isBioLong || bioExpanded ? bioText : bioText.slice(0, BIO_COLLAPSED_CHARS).trimEnd() + '…';

  return (
    <main className="relative min-h-screen bg-background text-foreground">
      <div className="relative mx-auto w-full max-w-7xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10 lg:px-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
          <motion.aside
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="lg:col-span-4"
          >
            <div
              className={cn(
                'rounded-3xl border border-border/60 bg-card/70 shadow-sm backdrop-blur-sm',
                'lg:sticky lg:top-20',
              )}
            >
              {/* Header band */}
              <div className="relative overflow-hidden rounded-t-3xl">
                <div className="absolute inset-0 bg-linear-to-br from-primary/15 via-primary/5 to-transparent" />
                <div className="relative flex flex-col items-center gap-4 px-6 pb-6 pt-8 text-center sm:pt-10">
                  <motion.div
                    initial={{ scale: 0.85, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.05, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    className={cn(
                      'grid place-items-center rounded-2xl',
                      'h-24 w-24 sm:h-28 sm:w-28',
                      'bg-linear-to-br from-primary/25 via-primary/10 to-secondary',
                      'ring-1 ring-border/60 shadow-inner',
                    )}
                  >
                    <span className="text-3xl font-black tracking-tight text-primary sm:text-4xl">
                      {initials}
                    </span>
                  </motion.div>

                  {contributors.gender && contributors.gender !== 'UNKNOWN' && (
                    <Badge
                      variant="outline"
                      className="rounded-full border-border/70 bg-background/60 px-2.5 py-0.5 text-[10px] font-medium capitalize backdrop-blur-sm"
                    >
                      {t(
                        `ContributorGender_${contributors.gender}` as never,
                        {
                          defaultValue: contributors.gender.toLowerCase(),
                        } as never,
                      )}
                    </Badge>
                  )}

                  <div className="min-w-0">
                    <motion.h1
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15, duration: 0.4 }}
                      className="text-balance text-2xl font-black leading-tight tracking-tight sm:text-3xl"
                    >
                      {contributors.name}
                    </motion.h1>

                    {contributors.originalName &&
                      contributors.originalName !== contributors.name && (
                        <motion.p
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.2, duration: 0.4 }}
                          className="mt-1 text-sm text-muted-foreground sm:text-base"
                          dir="auto"
                        >
                          {contributors.originalName}
                        </motion.p>
                      )}
                  </div>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-2 px-6 pb-2">
                <StatCard
                  icon={<BookOpen className="h-4 w-4" />}
                  value={String(pagination?.total ?? 0)}
                  label={t('BookCount', { count: pagination?.total ?? 0 })}
                />
                <StatCard
                  icon={<Calendar className="h-4 w-4" />}
                  value={new Date(contributors.updatedAt).toLocaleDateString()}
                  label={t('UpdatedOn', {
                    date: new Date(contributors.updatedAt).toLocaleDateString(),
                  })}
                  compact
                />
              </div>

              {/* Biography */}
              {bioText && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35, duration: 0.4 }}
                  className="px-6 pb-6 pt-4"
                >
                  <Separator className="mb-4" />
                  <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('Biography')}
                  </h2>
                  <AnimatePresence initial={false} mode="wait">
                    <motion.p
                      key={bioExpanded ? 'expanded' : 'collapsed'}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="whitespace-pre-line text-sm leading-relaxed text-foreground/90"
                      dir="auto"
                    >
                      {bioDisplay}
                    </motion.p>
                  </AnimatePresence>
                  {isBioLong && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setBioExpanded((v) => !v)}
                      className="mt-2 h-8 gap-1 px-2 text-xs"
                    >
                      {bioExpanded ? t('ShowLess') : t('ShowMore')}
                      <ChevronDown
                        className={cn(
                          'h-3.5 w-3.5 transition-transform',
                          bioExpanded && 'rotate-180',
                        )}
                      />
                    </Button>
                  )}
                </motion.div>
              )}
            </div>
          </motion.aside>

          <section ref={booksSectionRef} className="scroll-mt-20 lg:col-span-8">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className={cn(
                'mb-5 flex items-center gap-3 rounded-2xl border border-border/60',
                'bg-card/60 px-4 py-3 shadow-sm backdrop-blur-sm sm:mb-6 sm:px-5',
              )}
            >
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <Library className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-base font-bold tracking-tight sm:text-lg">
                  {t('BooksByContributor', { name: contributors.name })}
                </h2>
                {pagination && (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {t('BookCount', { count: pagination.total })}
                  </p>
                )}
              </div>
            </motion.div>

            {/* Loading overlay when paginating */}
            {isLoading && data ? (
              <BooksGrid>
                {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                  <BookCardSkeleton key={i} />
                ))}
              </BooksGrid>
            ) : books.length === 0 ? (
              <EmptyBooks label={t('NoBooks')} />
            ) : (
              <motion.div
                key={`page-${page}`}
                initial="hidden"
                animate="show"
                variants={{
                  hidden: { opacity: 0 },
                  show: {
                    opacity: 1,
                    transition: { staggerChildren: 0.04, delayChildren: 0.05 },
                  },
                }}
              >
                <BooksGrid>
                  {books.map((book, index) => (
                    <motion.div
                      key={book.id}
                      variants={{
                        hidden: { opacity: 0, y: 14 },
                        show: {
                          opacity: 1,
                          y: 0,
                          transition: {
                            duration: 0.35,
                            ease: [0.22, 1, 0.36, 1],
                          },
                        },
                      }}
                    >
                      <BookCard book={book} priority={index < 6} />
                    </motion.div>
                  ))}
                </BooksGrid>
              </motion.div>
            )}

            {pagination && pagination.totalPages > 1 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="mt-8"
              >
                <AppPagination
                  currentPage={pagination.page}
                  totalPages={pagination.totalPages}
                  totalItems={pagination.total}
                  pageSize={pagination.limit}
                  itemLabel={t('Contributor')}
                  onPageChange={(p) => setPage(p)}
                  scrollTarget={booksSectionRef}
                />
              </motion.div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function BooksGrid({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'grid gap-x-3 gap-y-6 sm:gap-x-4 sm:gap-y-8',
        'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5',
      )}
    >
      {children}
    </div>
  );
}

function StatCard({
  icon,
  value,
  label,
  compact,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-2xl border border-border/60',
        'bg-background/60 px-3 py-3 shadow-sm backdrop-blur-sm',
      )}
    >
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="min-w-0">
        <div
          className={cn(
            'truncate font-bold leading-tight text-foreground',
            compact ? 'text-sm' : 'text-base',
          )}
          dir="auto"
        >
          {value}
        </div>
        <div className="truncate text-[11px] text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

function EmptyBooks({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/30 px-6 py-16 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-full bg-background text-muted-foreground shadow-sm">
        <BookOpen className="h-6 w-6" />
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join('') || '?';
}

function ContributorPageSkeleton() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10 lg:px-8">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
        {/* Sidebar skeleton */}
        <div className="lg:col-span-4">
          <div className="rounded-3xl border border-border/60 bg-card/70 p-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <Skeleton className="h-24 w-24 rounded-2xl sm:h-28 sm:w-28" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <div className="mt-6 grid grid-cols-2 gap-2">
              <Skeleton className="h-16 rounded-2xl" />
              <Skeleton className="h-16 rounded-2xl" />
            </div>
            <div className="mt-6 space-y-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-11/12" />
              <Skeleton className="h-3 w-9/12" />
            </div>
          </div>
        </div>

        {/* Books skeleton */}
        <div className="lg:col-span-8">
          <Skeleton className="mb-6 h-14 w-full rounded-2xl" />
          <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 sm:gap-y-8 md:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <BookCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
