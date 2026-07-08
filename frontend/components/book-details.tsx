import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  Calendar,
  Clock,
  EyeOff,
  Heart,
  Plus,
  Send,
  Sparkles,
  Star,
  User,
} from "lucide-react";
import type { ReactNode, RefObject } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AppIcon } from "@/components/AppIcon";
import { formatUpdateTime } from "@/lib/time";
import { ContributorRole, CONTRIBUTOR_ROLE_ICONS, type AgeRating, type BookStatus, type IconKey } from "@readory/shared";
import Link from "next/link";

export type BookDetailsData = {
  id: number;
  title: string;
  originalTitle?: string | null;
  alternativeTitles?: string[];
  contributors?: Array<{
      id: number;
      name: string;
      role: string;
      slug: string;
  }>;
  description?: string | null;
  coverImage: string;
  isFeatured: boolean;
  publishStatus?: "DRAFT" | "SCHEDULED" | "PUBLISHED";
  status: BookStatus;
  ageRating?: AgeRating | null;
  publicationYear?: number | null;
  chapterCount: number;
  lastContentUpdate?: string | null;
  ratingAvg: number;
  ratingCount: number;
  updatedAt: string;
  createdAt: string;
  type: { id?: number; name: string; slug: string; iconKey: IconKey };
  genres: Array<{ id: number; name: string; slug: string; iconKey: IconKey }>;
};

type chapterSectionType = RefObject<HTMLElement | null> | string;
type Translator = (key: string, values?: Record<string, string | number | Date>) => string;

export type BookDetailsProps = {
  book: BookDetailsData;
  coverSrc: string;
  ratingValue: number;
  chaptersTotal: number;

  isAuthenticated?: boolean;

  // Favorite
  isFavorited?: boolean;
  favoriteLoading?: boolean;
  onToggleFavorite?: () => void;

  // Rating
  selectedRating?: number;
  hoverRating?: number;
  onHoverRating?: (value: number) => void;
  onSelectRating?: (value: number) => void;
  onSubmitRating?: () => void;
  isRatingPending?: boolean;

  chapterSection?: chapterSectionType;

  t: Translator;
  ti: Translator;

  /** Replace the primary "Chapters" CTA entirely (admin may not need it). */
  primaryActionSlot?: boolean;
  /** Hide the public "Rate this book" panel (admin page typically hides it). */
  hideRatingPanel?: boolean;
  /** Hide the favorite button (admin page typically hides it). */
  hideFavoriteButton?: boolean;

  hideUpdatedAt?: boolean;
  hideCreatedAt?: boolean;

  editMode?: ReactNode;

  className?: string;
};

export function BookDetailsSkeleton() {
  return (
      <div className="mx-auto w-full max-w-7xl space-y-8 px-4 py-6 sm:px-6 lg:px-8">
        <div className="animate-pulse overflow-hidden rounded-3xl border border-border bg-card">
          <div className="grid gap-6 p-5 sm:p-8 lg:grid-cols-[260px_1fr] lg:gap-10">
            <div>
              <div className="mx-auto aspect-2/3 w-40 rounded-2xl bg-muted sm:w-56 lg:w-full" />
              <div className="mt-4 h-8 w-full rounded-2xl bg-muted" />
            </div>
            <div className="space-y-5">
              <div className="flex flex-wrap gap-2">
                <div className="h-5 w-20 rounded-full bg-muted" />
                <div className="h-5 w-24 rounded-full bg-muted" />
              </div>
              <div className="h-9 w-3/4 rounded-lg bg-muted" />
              <div className="h-5 w-1/3 rounded-lg bg-muted" />
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-muted-foreground">
              <span className="inline-flex items-center gap-2 text-sm font-medium">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted">
                  <User className="h-3.5 w-3.5" />
                </span>
                <div className="h-5 w-30 rounded-full bg-muted" />
              </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="h-7 w-20 rounded-full bg-muted" />
                ))}
              </div>
              <div className="space-y-2">
                <div className="h-4 w-full rounded bg-muted" />
                <div className="h-4 w-full rounded bg-muted" />
                <div className="h-4 w-2/3 rounded bg-muted" />
              </div>
              <div className="flex items-center gap-3">
                <div className="h-5 w-24 rounded-md bg-muted" />
                <div className="h-1 w-1 rounded-full bg-muted" />
                <div className="h-5 w-32 rounded-md bg-muted" />
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}

export function BookDetails({
                              book,
                              coverSrc,
                              ratingValue,
                              chaptersTotal,
                              isAuthenticated,
                              isFavorited,
                              favoriteLoading,
                              onToggleFavorite,
                              selectedRating = 0,
                              hoverRating = 0,
                              onHoverRating,
                              onSelectRating,
                              onSubmitRating,
                              isRatingPending,
                              chapterSection,
                              t,
                              ti,
                              primaryActionSlot,
                              hideRatingPanel,
                              hideFavoriteButton,
                              editMode,
                              hideUpdatedAt,
                              hideCreatedAt,
                              className,
                            }: BookDetailsProps) {
  const scrollToTarget = () => {
    if (!chapterSection || typeof window === "undefined") return;

    window.requestAnimationFrame(() => {
      const target =
          typeof chapterSection === "string"
              ? document.getElementById(chapterSection)
              : chapterSection.current;

      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      target?.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "start",
      });
    });
  };

  const alternativeTitles = book.alternativeTitles?.filter(Boolean) ?? [];
  const isDraft = book.publishStatus !== "PUBLISHED";

  return (
      <section
          className={`relative rounded-3xl border border-border bg-card shadow-sm ${!editMode && "overflow-hidden"} ${className ? ` ${className}` : ""}`}
      >
        {/* Ambient cover backdrop */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-64 overflow-hidden rounded-t-3xl sm:h-96">
          <Image
              src={coverSrc}
              alt=""
              aria-hidden
              fill
              sizes="100vw"
              className="scale-125 object-cover opacity-50 blur-3xl saturate-150"
              priority
          />
          <div className="absolute inset-0 bg-linear-to-b from-background/20 via-background/70 to-card" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,transparent_0%,var(--card)_75%)]" />
        </div>

        <div className="relative p-4 sm:p-8 lg:p-10">
          {editMode ? (
              editMode
          ) : (
              <div className="grid gap-6 sm:gap-8 lg:grid-cols-[280px_1fr] lg:gap-12">
                {/* Cover column */}
                <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                    className="mx-auto w-36 self-start sm:w-56 lg:sticky lg:top-20 lg:w-full"
                >
                  <motion.div
                      whileHover={{ y: -4, rotate: -0.4 }}
                      transition={{ type: "spring", stiffness: 220, damping: 18 }}
                      className="group relative aspect-2/3 overflow-hidden rounded-3xl bg-muted shadow-[0_25px_60px_-15px_rgba(0,0,0,0.45)] ring-1 ring-border"
                  >
                    <Image
                        src={coverSrc}
                        alt={`Cover of ${book.title}`}
                        fill
                        className="object-cover transition-transform duration-700 group-hover:scale-110"
                        sizes="(max-width: 640px) 9rem, (max-width: 1024px) 14rem, 280px"
                        priority
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-black/40 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

                    {/* corner badges */}
                    <div className="absolute top-2 flex flex-col gap-1.5 ltr:right-2 rtl:left-2 sm:top-3 sm:gap-2 ltr:sm:right-3 rtl:sm:left-3">
                      {isDraft && (
                          <div
                              className="flex items-center gap-1 rounded-full bg-foreground/85 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-background shadow-lg backdrop-blur"
                              aria-label={t("Draft")}
                              title={t("Draft")}
                          >
                            <EyeOff className="h-3 w-3" />
                            <span className="hidden sm:inline">{t("Draft")}</span>
                          </div>
                      )}
                      {book.isFeatured && (
                          <div
                              className="flex w-fit items-center gap-1 rounded-full bg-amber-500/95 px-2 py-1 text-white shadow-lg backdrop-blur"
                              aria-label={t("Featured")}
                              title={t("Featured")}
                          >
                            <Sparkles className="h-3.5 w-3.5" />
                          </div>
                      )}
                    </div>
                  </motion.div>

                  {/* Compact rating chip under 'Cover' */}
                  <div className="relative mt-3 flex items-center justify-center gap-2 overflow-hidden rounded-2xl border border-border bg-background/70 px-3 py-2 backdrop-blur-md sm:mt-4">
                    <div className="pointer-events-none absolute -top-12 h-40 w-40 rounded-full bg-amber-400/10 blur-3xl ltr:-left-12 rtl:-right-12" />
                    <div className="relative flex items-center gap-1">
                      <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                      <span className="text-sm font-bold text-foreground">
                    {ratingValue.toFixed(2)}
                  </span>
                    </div>
                    <span className="relative text-xs text-muted-foreground">·</span>
                    <span className="relative truncate text-xs text-muted-foreground">
                  {t("NReviews", { count: book.ratingCount })}
                </span>
                  </div>
                </motion.div>

                {/* Meta column */}
                <motion.div
                    initial="hidden"
                    animate="show"
                    variants={{
                      hidden: { opacity: 0 },
                      show: {
                        opacity: 1,
                        transition: { staggerChildren: 0.07, delayChildren: 0.1 },
                      },
                    }}
                    className="min-w-0 space-y-5 sm:space-y-6"
                >
                  {/* Type chip row */}
                  <motion.div
                      variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
                      className="flex flex-wrap items-center gap-2"
                  >
                    <Badge className="items-center-safe gap-1.5 rounded-full border-transparent bg-primary/10 px-3 py-1 text-primary hover:bg-primary/15">
                      <AppIcon name={book.type.iconKey} className="h-3.5 w-3.5" />
                      {book.type.name}
                    </Badge>
                    <Badge variant="outline" className="gap-1.5 rounded-full px-3 py-1">
                      {t(`BookStatus_${book.status}`)}
                    </Badge>
                    {book.ageRating && (
                        <Badge variant="outline" className="rounded-full px-3 py-1">
                          {t(`AgeRating_${book.ageRating}`)}
                        </Badge>
                    )}
                    {book.publicationYear && (
                        <Badge
                            variant="outline"
                            className="flex items-center-safe gap-1.5 rounded-full px-3 py-1"
                        >
                          <Calendar className="h-3.5 w-3.5" />
                          {book.publicationYear}
                        </Badge>
                    )}
                    {isDraft && (
                        <Badge
                            variant="outline"
                            className="flex items-center-safe gap-1.5 rounded-full border-amber-500/50 bg-amber-500/10 px-3 py-1 text-amber-700 dark:text-amber-400"
                        >
                          <EyeOff className="h-3.5 w-3.5" />
                          {t("Draft")}
                        </Badge>
                    )}
                  </motion.div>

                  {/* Title + contributors */}
                  <motion.div
                      variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
                      className="min-w-0 space-y-3"
                  >
                    <h1 className="text-balance bg-linear-to-br from-foreground via-foreground to-foreground/70 bg-clip-text text-2xl font-extrabold leading-[1.1] tracking-tight text-transparent sm:text-4xl lg:text-[3.25rem]">
                      {book.title}
                    </h1>

                    {book.originalTitle && (
                        <p className="text-sm font-medium text-muted-foreground/90 sm:text-base">
                          {book.originalTitle}
                        </p>
                    )}

                    {alternativeTitles.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground/80 sm:text-sm">
                          <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          <span className="sr-only">{t("OtherNames")}</span>
                          {alternativeTitles.map((alt, i) => (
                              <span key={`${alt}-${i}`} className="inline-flex items-center gap-1.5">
                                  <span className="italic">{alt}</span>
                                  {i < alternativeTitles.length - 1 && (
                                      <span aria-hidden className="text-muted-foreground/40">·</span>
                                  )}
                              </span>
                          ))}
                        </div>
                    )}

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-muted-foreground">
                        <div className="flex flex-wrap items-center gap-3">
                            {book.contributors && book.contributors.length > 0 ? (
                                book.contributors.map((item, index) => {
                                    const contributorName = item.name || t("UnknownContributor");
                                    const roleLabel = item.role;
                                    const roleIconKey = CONTRIBUTOR_ROLE_ICONS[item.role as ContributorRole];

                                    return (
                                        <Link key={item.slug} href={`/contributor/${item.slug}`}>
                                            <span
                                                key={index}
                                                className="inline-flex min-w-0 items-center gap-2 rounded-md bg-muted/40 px-2.5 py-1 text-sm font-medium"
                                            >
                                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
                                                    {roleIconKey ? (
                                                        <AppIcon name={roleIconKey as IconKey} className="h-3 w-3 text-muted-foreground" />
                                                    ) : (
                                                        <User className="h-3 w-3 text-muted-foreground" />
                                                    )}
                                                </span>
                                                <span className="truncate">{contributorName}</span>
                                                <span className="text-xs text-muted-foreground">({roleLabel})</span>
                                            </span>
                                        </Link>
                                    );
                                })
                            ) : (
                                <span className="inline-flex min-w-0 items-center gap-2 rounded-md bg-muted/40 px-2.5 py-1 text-sm font-medium">
                                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
                                        <User className="h-3 w-3 text-muted-foreground" />
                                    </span>
                                    <span className="truncate">{t("UnknownContributor")}</span>
                                </span>
                            )}
                        </div>
                    </div>
                  </motion.div>

                  {/* Genres */}
                  {book.genres.length > 0 && (
                      <motion.div
                          variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
                          className="flex flex-wrap gap-2"
                      >
                        {book.genres.map((genre) => (
                            <Badge
                                key={genre.id}
                                variant="outline"
                                className="gap-1.5 select-none rounded-full border-border bg-background/60 px-3 py-1 font-medium backdrop-blur transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
                            >
                              <AppIcon name={genre.iconKey} className="h-3.5 w-3.5" />
                              {genre.name}
                            </Badge>
                        ))}
                      </motion.div>
                  )}

                  {/* Description */}
                  <motion.p
                      variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
                      className="text-pretty text-start text-[15px] leading-relaxed text-muted-foreground sm:text-base sm:text-justify"
                  >
                    {book.description || t("NoDescriptionAvailable")}
                  </motion.p>

                  {/* Primary actions */}
                  <motion.div
                      variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
                      className="flex flex-wrap items-center gap-3"
                  >
                    {primaryActionSlot ?? (
                        <motion.div whileTap={{ scale: 0.97 }} className="flex-1 sm:flex-initial">
                          <Button
                              size="lg"
                              onClick={scrollToTarget}
                              className="h-12 w-full gap-2 rounded-2xl bg-linear-to-br from-primary to-primary/85 px-6 text-base font-semibold shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/30 sm:w-auto"
                          >
                            <BookOpen className="h-5 w-5" />
                            {t("Chapters")}
                          </Button>
                        </motion.div>
                    )}

                    {!hideFavoriteButton && (
                        <motion.div whileTap={{ scale: 0.92 }} whileHover={{ scale: 1.04 }}>
                          <Button
                              variant="outline"
                              size="lg"
                              onClick={onToggleFavorite}
                              disabled={favoriteLoading}
                              aria-pressed={isFavorited}
                              aria-label={t(isFavorited ? "RemoveFromFavorites" : "AddToFavorites")}
                              className={`h-12 w-12 shrink-0 gap-2 rounded-2xl border-2 p-0 transition-colors ${
                                  isFavorited
                                      ? "border-red-500/50 bg-red-500/10 text-red-500 hover:bg-red-500/15"
                                      : "text-foreground hover:border-red-500/40 hover:text-red-500"
                              }`}
                          >
                            <AnimatePresence mode="wait" initial={false}>
                              <motion.span
                                  key={String(isFavorited)}
                                  initial={{ scale: 0.6 }}
                                  animate={{ scale: 1 }}
                                  transition={{ type: "spring", stiffness: 400, damping: 14 }}
                                  className="inline-flex"
                              >
                                <Heart className={`h-5 w-5 ${isFavorited ? "fill-current" : ""}`} />
                              </motion.span>
                            </AnimatePresence>
                          </Button>
                        </motion.div>
                    )}
                  </motion.div>

                  {/* Stats strip */}
                  <motion.div
                      variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
                      className="grid grid-cols-1 gap-3 rounded-2xl border border-border/70 bg-background/40 p-3 text-sm text-muted-foreground backdrop-blur sm:grid-cols-2 sm:gap-x-6 sm:p-4"
                  >
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <BookOpen className="h-4 w-4 shrink-0 text-primary" />
                      <span className="truncate">
                        <span>{t("TotalChapters")}: </span>
                        <span className="font-semibold text-foreground">{chaptersTotal}</span>
                      </span>
                    </span>

                      {!hideUpdatedAt &&(
                          <span className="inline-flex min-w-0 items-center gap-2">
                              <Clock className="h-4 w-4 shrink-0 text-emerald-500"/>
                              <span className="min-w-0 truncate">
                                  <span>{t("LastUpdated")}: </span>
                                  <span className="font-medium text-foreground">
                                      {formatUpdateTime(book.updatedAt, ti)}
                                  </span>
                              </span>
                          </span>
                      )}

                      {book.lastContentUpdate && (
                          <span className="inline-flex min-w-0 items-center gap-2">
                              <Sparkles className="h-4 w-4 shrink-0 text-amber-500"/>
                              <span className="min-w-0 truncate">
                                  <span>{t("LastContentUpdate")}: </span>
                                  <span className="font-medium text-foreground">
                                      {formatUpdateTime(book.lastContentUpdate, ti)}
                                  </span>
                              </span>
                          </span>
                      )}

                      {!hideCreatedAt &&(
                          <span className="inline-flex min-w-0 items-center gap-2">
                              <Calendar className="h-4 w-4 shrink-0 text-sky-500" />
                              <span className="min-w-0 truncate">
                                  <span>{t("AddedOn")}: </span>
                                  <span className="font-medium text-foreground">
                                      {formatUpdateTime(book.createdAt, ti)}
                                  </span>
                              </span>
                          </span>
                      )}
                  </motion.div>

                  {/* Rate this book */}
                  {!hideRatingPanel && isAuthenticated && (
                      <motion.div
                          variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
                          className="relative overflow-hidden rounded-2xl border border-border bg-linear-to-br from-background/80 via-card to-background/60 p-4 backdrop-blur sm:p-5"
                      >
                        <div className="pointer-events-none absolute -top-12 h-40 w-40 rounded-full bg-amber-400/10 blur-3xl ltr:-right-12 rtl:-left-12" />
                        <div className="relative mb-4 flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold text-foreground">{t("RateThisBook")}</p>
                          {selectedRating > 0 && (
                              <motion.span
                                  key={selectedRating}
                                  initial={{ opacity: 0, y: -4 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className="rounded-full bg-amber-400/15 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400"
                              >
                                {t("UserRate", { UserRate: selectedRating })}
                              </motion.span>
                          )}
                        </div>
                        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-center justify-center gap-1 sm:justify-start">
                            {[1, 2, 3, 4, 5].map((value) => {
                              const active = value <= (hoverRating || selectedRating);
                              return (
                                  <motion.button
                                      key={value}
                                      type="button"
                                      onClick={() => (onSelectRating ? onSelectRating(value) : null)}
                                      onMouseEnter={() => (onHoverRating ? onHoverRating(value) : null)}
                                      onMouseLeave={() => (onHoverRating ? onHoverRating(0) : null)}
                                      whileTap={{ scale: 0.85 }}
                                      whileHover={{ scale: 1.15, rotate: -6 }}
                                      transition={{ type: "spring", stiffness: 350, damping: 14 }}
                                      className="rounded-md p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                      aria-label={`Rate ${value} stars`}
                                  >
                                    <Star
                                        className={`h-8 w-8 transition-colors duration-200 ${
                                            active
                                                ? "fill-amber-400 text-amber-400 drop-shadow-[0_2px_8px_rgba(251,191,36,0.45)]"
                                                : "text-muted-foreground/40"
                                        }`}
                                    />
                                  </motion.button>
                              );
                            })}
                          </div>
                          <Button
                              onClick={onSubmitRating}
                              disabled={isRatingPending || selectedRating === 0}
                              className="h-11 w-full gap-2 rounded-xl sm:w-auto"
                          >
                            {isRatingPending ? (
                                <span className="flex items-center gap-2">
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                  {t("Submitting")}
                        </span>
                            ) : (
                                <>
                                  <Send className="h-4 w-4" />
                                  {t("SubmitRating")}
                                </>
                            )}
                          </Button>
                        </div>
                      </motion.div>
                  )}
                </motion.div>
              </div>
          )}
        </div>
      </section>
  );
}

export default BookDetails;
