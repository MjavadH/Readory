'use client';

import React, { useRef, type RefObject } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowDown10,
  ArrowUp10,
  BookOpen,
  Check,
  Clock,
  Edit,
  EyeIcon,
  Lock,
  Plus,
  Search,
  Sparkles,
  Trash,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AppPagination } from '@/components/app-pagination';
import { formatUpdateTime } from '@/lib/time';
import { cn } from '@/lib/utils';
import { PublicationStatus } from '@readory/shared';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLocaleInfo } from '@/hooks/use-locale-info';

export type ChaptersSectionChapter = {
  id: number;
  title: string;
  index: number;
  isFree: boolean;
  price: number | null;
  updatedAt: string;
  publishStatus: PublicationStatus;
};

type Translator = (key: string, values?: Record<string, string | number | Date>) => string;

type CommonProps = {
  /** Chapters currently rendered */
  chapters: ChaptersSectionChapter[];
  chaptersLoading: boolean;
  chaptersTotal: number;
  chaptersTotalPages: number;
  chaptersPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;

  /** Ref for pagination scroll target + section anchor */
  scrollRef?: RefObject<HTMLDivElement | null>;

  /** Search + sort */
  searchInput: string;
  onSearchInputChange: (v: string) => void;
  onSearchSubmit: () => void;
  order: 'asc' | 'desc';
  onToggleOrder: () => void;

  /** i18n */
  t: Translator; // Books namespace
  ti: Translator; // Time namespace
  g: Translator; // General namespace
};

type PublicProps = CommonProps & {
  mode: 'public';
  purchasedChapterIds: number[];
  onChapterSelect: (chapter: ChaptersSectionChapter) => void;
};

type AdminProps = CommonProps & {
  mode: 'admin';
  onAddChapter: () => void;
  onEditChapter: (chapter: ChaptersSectionChapter) => void;
  onDeleteChapter: (chapterId: number) => void;
  /** Builds the "view" link (admin preview of a chapter). */
  buildChapterHref: (chapter: ChaptersSectionChapter) => string;

  statusFilter: PublicationStatus | 'ALL';
  onStatusFilterChange: (status: PublicationStatus | 'ALL') => void;
};

export type ChaptersSectionProps = PublicProps | AdminProps;

function ChaptersGridSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-2xl border border-border/70 bg-card/70 p-4">
          <div className="mb-3 flex items-start gap-3">
            <div className="h-11 w-11 rounded-xl bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-full rounded bg-muted" />
              <div className="h-3 w-2/3 rounded bg-muted" />
            </div>
          </div>
          <div className="h-8 w-full rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

export function ChaptersSection(props: ChaptersSectionProps) {
  const {
    chapters,
    chaptersLoading,
    chaptersTotal,
    chaptersTotalPages,
    chaptersPage,
    pageSize,
    onPageChange,
    scrollRef,
    searchInput,
    onSearchInputChange,
    onSearchSubmit,
    order,
    onToggleOrder,
    t,
    ti,
  } = props;

  // Fallback ref
  const localRef = useRef<HTMLDivElement | null>(null);
  const sectionRef = (scrollRef ?? localRef) as RefObject<HTMLDivElement | null>;
  const { isRTL } = useLocaleInfo();

  const isAdmin = props.mode === 'admin';
  const purchasedIds =
    props.mode === 'public' ? new Set(props.purchasedChapterIds) : new Set<number>();

  return (
    <section ref={sectionRef} id="chapters" className="scroll-mt-24">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="relative overflow-hidden rounded-3xl border border-border/70 bg-card/60 shadow-sm backdrop-blur-sm"
      >
        {/* Ambient gradient */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,--theme(--color-primary/8%),transparent_60%),radial-gradient(circle_at_bottom_left,--theme(--color-primary/6%),transparent_55%)]"
        />

        {/* Header */}
        <div className="space-y-5 border-b border-border/70 p-4 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
                <BookOpen className="h-5 w-5" />
                <motion.span
                  aria-hidden
                  className="absolute inset-0 rounded-2xl ring-2 ring-primary/30"
                  animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0, 0.6] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                />
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-xl font-bold tracking-tight sm:text-2xl">
                  {t('Chapters')}
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
                  {isAdmin ? t('ManageAllChapters') : t('BrowseAvailableChapters')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isAdmin && (
                <Button
                  onClick={(props as AdminProps).onAddChapter}
                  size="sm"
                  className="h-9 rounded-xl"
                >
                  <Plus className="sm:me-2 h-4 w-4" />
                  <span className="hidden sm:inline">{t('AddChapter')}</span>
                </Button>
              )}
            </div>
          </div>

          {/* Search + sort */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="group relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary ltr:left-3 rtl:right-3" />
              <Input
                value={searchInput}
                onChange={(e) => onSearchInputChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onSearchSubmit()}
                placeholder={t('SearchNameOrIndex')}
                className="h-11 rounded-xl border-border/70 bg-background/70 ps-9 transition-all focus-visible:ring-2 focus-visible:ring-primary/30"
              />
            </div>
            <div className="flex gap-2">
              {isAdmin && (
                <div className="relative shrink-0">
                  <Select
                    dir={isRTL ? 'rtl' : 'ltr'}
                    value={(props as AdminProps).statusFilter}
                    onValueChange={(e) =>
                      (props as AdminProps).onStatusFilterChange(e as PublicationStatus | 'ALL')
                    }
                    aria-label="Filter by status"
                  >
                    <SelectTrigger className="h-11! w-full rounded-xl border-border/70 bg-background/80 px-3 text-sm sm:w-48">
                      <div className="flex items-center gap-2 truncate">
                        <SelectValue />
                      </div>
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectItem value="ALL">{t('AllStatuses')}</SelectItem>
                      <SelectSeparator />
                      <SelectItem value={PublicationStatus.PUBLISHED}>{t('Published')}</SelectItem>
                      <SelectItem value={PublicationStatus.DRAFT}>{t('Draft')}</SelectItem>
                      <SelectItem value={PublicationStatus.SCHEDULED}>{t('Scheduled')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button
                onClick={onSearchSubmit}
                disabled={chaptersLoading}
                className="h-11 flex-1 rounded-xl sm:flex-none"
              >
                <Search className="me-2 h-4 w-4" />
                {t('Search')}
              </Button>
              <motion.button
                type="button"
                onClick={onToggleOrder}
                disabled={chaptersLoading}
                whileTap={{ scale: 0.92 }}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background/70 text-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-50"
                aria-label="Toggle sorting order"
              >
                <motion.span
                  key={props.order}
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                  className="flex items-center justify-center"
                >
                  {order === 'asc' ? (
                    <ArrowDown10 className="h-5 w-5" />
                  ) : (
                    <ArrowUp10 className="h-5 w-5" />
                  )}
                </motion.span>
              </motion.button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="space-y-6 p-4 sm:p-6">
          <AnimatePresence initial={false} mode="wait">
            {chaptersLoading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <ChaptersGridSkeleton />
              </motion.div>
            ) : chapters.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/70 bg-background/40 py-16 text-center"
              >
                <motion.div
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <BookOpen className="mb-3 h-12 w-12 text-muted-foreground/50" />
                </motion.div>
                <p className="text-sm font-medium text-foreground">
                  {isAdmin ? t('NoChapters') : t('NoChaptersFound')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isAdmin ? t('NoChaptersDescription') : t('AdjustingSearch')}
                </p>
                {isAdmin && (
                  <Button
                    onClick={(props as AdminProps).onAddChapter}
                    variant="outline"
                    className="mt-5"
                  >
                    <Plus className="me-2 h-4 w-4" />
                    {t('AddChapter')}
                  </Button>
                )}
              </motion.div>
            ) : (
              <div key="grid" className="space-y-6">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {chapters.map((chapter) => (
                    <ChapterCard
                      key={chapter.id}
                      chapter={chapter}
                      isAdmin={isAdmin}
                      owned={purchasedIds.has(chapter.id)}
                      t={t}
                      ti={ti}
                      g={props.g}
                      onSelect={
                        props.mode === 'public' ? () => props.onChapterSelect(chapter) : undefined
                      }
                      onEdit={
                        props.mode === 'admin' ? () => props.onEditChapter(chapter) : undefined
                      }
                      onDelete={
                        props.mode === 'admin' ? () => props.onDeleteChapter(chapter.id) : undefined
                      }
                      viewHref={
                        props.mode === 'admin' ? props.buildChapterHref(chapter) : undefined
                      }
                    />
                  ))}
                </div>

                {chaptersTotalPages > 1 && (
                  <div className="border-t border-border/60 pt-6">
                    <AppPagination
                      currentPage={chaptersPage}
                      totalPages={chaptersTotalPages}
                      totalItems={chaptersTotal}
                      pageSize={pageSize}
                      itemLabel={t('chapter')}
                      onPageChange={onPageChange}
                      canGoPrevious={!chaptersLoading && chaptersPage > 1}
                      canGoNext={!chaptersLoading && chaptersPage < chaptersTotalPages}
                      scrollTarget={sectionRef}
                    />
                  </div>
                )}
              </div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </section>
  );
}

type ChapterCardProps = {
  chapter: ChaptersSectionChapter;
  isAdmin: boolean;
  owned: boolean;
  t: Translator;
  ti: Translator;
  g: Translator;
  onSelect?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  viewHref?: string;
};

function ChapterCard({
  chapter,
  isAdmin,
  owned,
  t,
  ti,
  g,
  onSelect,
  onEdit,
  onDelete,
  viewHref,
}: ChapterCardProps) {
  const isFree = chapter.isFree || chapter.price == null;

  const priceLabel = isFree
    ? t('Free')
    : g
      ? t('ChapterPrice', {
          CurrencySymbols: g('CurrencySymbols'),
          ChapterPrice: Number(chapter.price).toFixed(2),
        })
      : `$${Number(chapter.price).toFixed(2)}`;

  let accent;

  if (isAdmin) {
    switch (chapter.publishStatus) {
      case PublicationStatus.DRAFT:
        accent = 'from-yellow-500/60 to-yellow-500/20';
        break;
      case PublicationStatus.PUBLISHED:
        accent = 'from-emerald-500/60 to-emerald-500/20';
        break;
      case PublicationStatus.SCHEDULED:
        accent = 'from-blue-500/60 to-blue-500/20';
        break;
      default:
        accent = 'from-muted-foreground/60 to-muted-foreground/20';
    }
  } else {
    accent = owned
      ? 'from-emerald-500/60 to-emerald-500/20'
      : isFree
        ? 'from-primary/60 to-primary/20'
        : 'from-muted-foreground/60 to-muted-foreground/20';
  }

  const cardClasses = cn(
    'group relative flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/80 p-4 text-start transition-colors duration-200 hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ltr:text-left rtl:text-right',
  );

  const inner = (
    <>
      {/* Accent gradient wash */}
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-0 -z-10 bg-linear-to-br opacity-60 transition-opacity duration-300 group-hover:opacity-100',
          accent,
        )}
      />

      {/* Price / Owned pill */}
      <div className="absolute top-3 ltr:right-3 rtl:left-3">
        <Badge
          variant={owned ? 'default' : isFree ? 'secondary' : 'outline'}
          className={cn(
            'rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
            owned
              ? 'border-transparent bg-emerald-600 text-white hover:bg-emerald-600 dark:bg-emerald-500'
              : isFree
                ? 'border-transparent bg-primary/15 text-primary hover:bg-primary/15'
                : 'border-border bg-background/70',
          )}
        >
          {owned ? t('Owned') : priceLabel}
        </Badge>
      </div>

      <div className="mb-3 mt-4 flex items-start gap-3 pe-16 ps-4">
        <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-primary/20 to-primary/5 text-sm font-bold text-primary ring-1 ring-primary/20 tabular-nums">
          {chapter.index}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
            {chapter.title}
          </h3>
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/60 pt-3">
        <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3 w-3 shrink-0" />
          <span className="truncate">{formatUpdateTime(chapter.updatedAt, ti)}</span>
        </div>

        {isAdmin ? (
          <div className="flex shrink-0 items-center gap-1">
            {viewHref && (
              <Link
                href={viewHref}
                onClick={(e) => e.stopPropagation()}
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label={g('View')}
              >
                <EyeIcon className="h-4 w-4" />
              </Link>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.();
              }}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={g('Edit')}
            >
              <Edit className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.();
              }}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              aria-label={g('Delete')}
            >
              <Trash className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex shrink-0 items-center gap-1.5 text-xs font-semibold">
            {owned ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-emerald-600 dark:text-emerald-400">{t('Read')}</span>
              </>
            ) : isFree ? (
              <>
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span className="text-primary">{t('Access')}</span>
              </>
            ) : (
              <>
                <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">{t('Buy')}</span>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );

  // Public: whole card is a button. Admin: div (action icons handle intent).
  if (isAdmin) {
    return <div className={cardClasses}>{inner}</div>;
  }

  return (
    <button type="button" onClick={onSelect} className={cardClasses}>
      {inner}
    </button>
  );
}

export default ChaptersSection;
