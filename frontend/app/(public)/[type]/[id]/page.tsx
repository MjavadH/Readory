"use client";

import { getBookCoverThumbnailUrl } from "@/lib/media";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  BookOpen,
  Check,
  Clock,
  Lock,
  Search,
  Sparkles,
  AlertCircle,
  ArrowDown10,
  ArrowUp10,
} from "lucide-react";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BookCard } from "@/components/book-card";
import type { BookCardData } from "@/lib/types";
import { formatUpdateTime } from "@/lib/time";
import { AppPagination } from "@/components/app-pagination";
import { useToast } from "@/providers/toast-provider";
import { useTranslations } from "next-intl";
import { ChapterPurchaseDialog } from "@/components/chapter-purchase-dialog";
import {AnimatePresence, motion } from "framer-motion";
import {cn} from "@/lib/utils";
import {BookDetails, BookDetailsData, BookDetailsSkeleton} from "@/components/book-details";


type ChapterItem = {
  id: number;
  title: string;
  index: number;
  isFree: boolean;
  price: number | null;
  updatedAt: string;
};

type ChaptersResponse = {
  items: ChapterItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type ViewerState = {
  myRating: number | null;
  purchasedChapterIds: number[];
  isFavorited: boolean;
};

type ActionChapter = ChapterItem & { mode: "purchase" | "access" };

const CHAPTERS_PER_PAGE = 36;

function BrowseChaptersSkeleton() {
  return (
      <div className="animate-pulse space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-28 rounded-2xl bg-muted" />
          ))}
        </div>
      </div>
  );
}

export default function BookDetailsPage() {
  const t = useTranslations("Books");
  const g = useTranslations("General");
  const ti = useTranslations("Time");
  const toast = useToast();
  const params = useParams<{ type: string; id: string }>();
  const router = useRouter();

  const typeSlug = Array.isArray(params.type) ? params.type[0] : params.type;
  const idParam = Array.isArray(params.id) ? params.id[0] : params.id;
  const bookId = Number(idParam);

  const [book, setBook] = useState<BookDetailsData | null>(null);
  const [viewer, setViewer] = useState<ViewerState | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedRating, setSelectedRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [isRatingPending, setIsRatingPending] = useState(false);

  const [isFavorited, setIsFavorited] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);

  const [chapters, setChapters] = useState<ChapterItem[]>([]);
  const [chaptersPage, setChaptersPage] = useState(1);
  const chaptersPaginationScrollRef = useRef<HTMLDivElement>(null);
  const [chaptersTotal, setChaptersTotal] = useState(0);
  const [chaptersTotalPages, setChaptersTotalPages] = useState(1);
  const [chapterSearch, setChapterSearch] = useState("");
  const [chapterSearchInput, setChapterSearchInput] = useState("");
  const [chaptersOrder, setChaptersOrder] = useState<"asc" | "desc">("asc");
  const [chaptersLoading, setChaptersLoading] = useState(false);

  const [relatedBooks, setRelatedBooks] = useState<BookCardData[]>([]);

  const [actionChapter, setActionChapter] = useState<ActionChapter | null>(null);

  const purchasedIds = useMemo(
      () => new Set(viewer?.purchasedChapterIds ?? []),
      [viewer?.purchasedChapterIds],
  );

  const loadBase = useCallback(async () => {
    if (!Number.isInteger(bookId) || bookId <= 0 || !typeSlug) {
      toast.error(t("InvalidBookLink"));
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const [bookData, profile] = await Promise.all([
        apiClient.get<BookDetailsData>(`/books/${bookId}`),
        apiClient.get("/auth/profile").catch(() => null),
      ]);

      if (!bookData || bookData.type.slug !== typeSlug) {
        toast.error(t("BookNotFoundForThisCategory"));
        return;
      }

      setBook(bookData);

      if (profile) {
        setIsAuthenticated(true);
        const viewerState = await apiClient.get<ViewerState>(
            `/books/${bookId}/viewer-state`,
        );
        setViewer(viewerState);
        setSelectedRating(viewerState.myRating ?? 0);
        setIsFavorited(viewerState.isFavorited);
      } else {
        setIsAuthenticated(false);
        setViewer(null);
        setSelectedRating(0);
      }

      const relatedResponse = await apiClient.get<{ items: BookCardData[] }>(
          `/books/${bookId}/related?limit=12`,
      );
      setRelatedBooks(relatedResponse.items ?? []);
    } catch (loadError) {
      toast.error(getApiErrorMessage(loadError, t("FailedLoadDetails")));
    } finally {
      setIsLoading(false);
    }
  }, [bookId, typeSlug]);

  const loadChapters = useCallback(async () => {
    if (!Number.isInteger(bookId) || bookId <= 0) return;

    setChaptersLoading(true);
    try {
      const data = await apiClient.get<ChaptersResponse>(
          `/books/${bookId}/chapters?page=${chaptersPage}&limit=${CHAPTERS_PER_PAGE}&q=${encodeURIComponent(chapterSearch)}&order=${chaptersOrder}`,
      );
      setChapters(data.items);
      setChaptersTotal(data.pagination.total);
      setChaptersTotalPages(data.pagination.totalPages);
    } catch (chapterError) {
      toast.error(getApiErrorMessage(chapterError, t("FailedLoadChapters")));
    } finally {
      setChaptersLoading(false);
    }
  }, [bookId, chapterSearch, chaptersPage, chaptersOrder]);

  useEffect(() => {
    void loadBase();
  }, [loadBase]);

  useEffect(() => {
    void loadChapters();
  }, [loadChapters]);

  const handleSelectRating = (rating: number) => {
    setSelectedRating(rating);
  };

  const handleSubmitRating = async () => {
    if (!book || !isAuthenticated || selectedRating === 0) {
      toast.error(t("SelectRating"));
      return;
    }

    setIsRatingPending(true);
    try {
      const updated = await apiClient.put<{
        ratingAvg: number;
        ratingCount: number;
        rating: number;
      }>(`/books/${book.id}/rating`, { rating: selectedRating });

      setBook((prev) =>
          prev
              ? {
                ...prev,
                ratingAvg: updated.ratingAvg,
                ratingCount: updated.ratingCount,
              }
              : prev,
      );
      toast.success(t("RatingSaved"));
    } catch (rateError) {
      toast.error(getApiErrorMessage(rateError, t("UnableSaveRating")));
    } finally {
      setIsRatingPending(false);
    }
  };

  const handleToggleFavorite = async () => {
    if (!book) return;
    setFavoriteLoading(true);
    try {
      const res: { favorited: boolean } = await apiClient.post(
          `/books/${book.id}/favorite`,
      );
      setIsFavorited(res.favorited);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setFavoriteLoading(false);
    }
  };

  const onChapterSelect = (chapter: ChapterItem) => {
    if (!book) return;
    if (!isAuthenticated) {
      toast.error(t("OnlyRegisteredUsers"));
      return;
    }

    const alreadyPurchased = purchasedIds.has(chapter.id);
    if (alreadyPurchased) {
      router.push(`/${encodeURIComponent(typeSlug)}/${book.id}/c/${chapter.index}`);
      return;
    }

    setActionChapter({
      ...chapter,
      mode: chapter.isFree || chapter.price == null ? "access" : "purchase",
    });
  };

  const handlePurchased = useCallback((chapterId: number) => {
    setViewer((prev) => {
      if (!prev) return prev;
      const next = new Set(prev.purchasedChapterIds);
      next.add(chapterId);
      return { ...prev, purchasedChapterIds: [...next] };
    });
  }, []);

  const handleSearch = () => {
    setChaptersPage(1);
    setChapterSearch(chapterSearchInput.trim());
  };

  const toggleOrder = () => {
    setChaptersOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    setChaptersPage(1);
  };

  if (isLoading) {
    return <BookDetailsSkeleton />;
  }

  if (!book) {
    return (
        <div className="mx-auto w-full max-w-7xl px-4 py-20 text-center sm:py-28">
          <div className="mx-auto max-w-md">
            <div className="mb-5 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
                <AlertCircle className="h-8 w-8 text-destructive" />
              </div>
            </div>
            <h2 className="mb-2 text-2xl font-bold text-foreground">
              {t("BookNotFound")}
            </h2>
            <p className="text-muted-foreground">{t("BookNotFoundDescription")}</p>
          </div>
        </div>
    );
  }

  const ratingValue = Number(book.ratingAvg ?? 0);
  const coverSrc = book.coverImage
      ? getBookCoverThumbnailUrl(book.coverImage)
      : "/placeholder.svg";

  return (
      <div className="mx-auto w-full max-w-7xl space-y-8 px-4 py-6 sm:px-6 lg:space-y-12 lg:px-8 lg:py-10">
        {/* Book Details */}
        <BookDetails
            book={book}
            coverSrc={coverSrc}
            ratingValue={ratingValue}
            chaptersTotal={chaptersTotal}
            isAuthenticated={isAuthenticated}
            isFavorited={isFavorited}
            favoriteLoading={favoriteLoading}
            onToggleFavorite={handleToggleFavorite}
            selectedRating={selectedRating}
            hoverRating={hoverRating}
            onHoverRating={setHoverRating}
            onSelectRating={handleSelectRating}
            onSubmitRating={() => void handleSubmitRating()}
            isRatingPending={isRatingPending}
            chapterSection={chaptersPaginationScrollRef}
            t={t}
            ti={ti}
            hideUpdatedAt={true}
            hideCreatedAt={true}
        />

        {/* Chapters */}
        <section ref={chaptersPaginationScrollRef} id="chapters" className="scroll-mt-24">
          <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, ease: "easeOut" }}
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
                <div className="flex items-center gap-3">
                  <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
                    <BookOpen className="h-5 w-5" />
                    <motion.span
                        aria-hidden
                        className="absolute inset-0 rounded-2xl ring-2 ring-primary/30"
                        animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0, 0.6] }}
                        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                    />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
                      {t("Chapters")}
                    </h2>
                    <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
                      {t("BrowseAvailableChapters")}
                    </p>
                  </div>
                </div>
                {chaptersTotal > 0 && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="rounded-full border border-border/70 bg-background/60 px-3 py-1 text-xs font-semibold text-muted-foreground"
                    >
                      {chaptersTotal}
                    </motion.div>
                )}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="group relative flex-1">
                  <Search className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary ltr:left-3 rtl:right-3" />
                  <Input
                      value={chapterSearchInput}
                      onChange={(e) => setChapterSearchInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                      placeholder={t("SearchNameOrIndex")}
                      className="h-11 rounded-xl border-border/70 bg-background/70 ps-9 transition-all focus-visible:ring-2 focus-visible:ring-primary/30"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                      onClick={handleSearch}
                      disabled={chaptersLoading}
                      className="h-11 flex-1 rounded-xl sm:flex-none"
                  >
                    <Search className="me-2 h-4 w-4" />
                    {t("Search")}
                  </Button>
                  <motion.button
                      type="button"
                      onClick={toggleOrder}
                      disabled={chaptersLoading}
                      whileTap={{ scale: 0.92 }}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background/70 text-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-50"
                      aria-label="Toggle sorting order"
                  >
                    <motion.span
                        key={chaptersOrder}
                        initial={{ rotate: -90, opacity: 0 }}
                        animate={{ rotate: 0, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 260, damping: 20 }}
                        className="flex items-center justify-center"
                    >
                      {chaptersOrder === "asc" ? (
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
              <AnimatePresence initial={false}>
                {chaptersLoading ? (
                    <motion.div
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                      <BrowseChaptersSkeleton />
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
                          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                      >
                        <BookOpen className="mb-3 h-12 w-12 text-muted-foreground/50" />
                      </motion.div>
                      <p className="text-sm font-medium text-foreground">
                        {t("NoChaptersFound")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("AdjustingSearch")}
                      </p>
                    </motion.div>
                ) : (
                    <motion.div
                        layout
                        className="space-y-6"
                    >
                      <motion.div
                          layout
                          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                      >
                        {chapters.map((chapter, index) => {
                          const owned = purchasedIds.has(chapter.id);
                          const isFree = chapter.isFree || chapter.price == null;
                          const priceLabel = isFree
                              ? t("Free")
                              : t("ChapterPrice", {
                                CurrencySymbols: g("CurrencySymbols"),
                                ChapterPrice: Number(chapter.price).toFixed(2),
                              });

                          const accent = owned
                              ? "from-emerald-500/15 to-emerald-500/0 ring-emerald-500/30"
                              : isFree
                                  ? "from-primary/15 to-primary/0 ring-primary/30"
                                  : "from-muted-foreground/10 to-transparent ring-border";

                          const dotColor = owned
                              ? "bg-emerald-500"
                              : isFree
                                  ? "bg-primary"
                                  : "bg-muted-foreground/40";

                          return (
                              <motion.button
                                  key={chapter.id}
                                  layout
                                  layoutId={`chapter-${chapter.id}`}
                                  type="button"
                                  onClick={() => onChapterSelect(chapter)}
                                  initial={{opacity: 0, y: 18, scale: 0.98}}
                                  animate={{opacity: 1, y: 0, scale: 1}}
                                  exit={{opacity: 0, y: -12}}
                                  transition={{duration: 0.28, delay: index * 0.035, ease: [0.22, 1, 0.36, 1]}}
                                  whileHover={{scale: 1.015}}
                                  whileTap={{scale: 0.985}}
                                  className={cn(
                                      "group relative flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/80 p-4 text-start transition-colors duration-200 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ltr:text-left rtl:text-right",
                                  )}
                              >
                                {/* Accent gradient wash */}
                                <div
                                    aria-hidden
                                    className={cn(
                                        "pointer-events-none absolute inset-0 -z-10 bg-linear-to-br opacity-60 transition-opacity duration-300 group-hover:opacity-100",
                                        accent,
                                    )}
                                />

                                {/* Status dot */}
                                <span
                                    aria-hidden
                                    className={cn(
                                        "absolute top-3 h-2 w-2 rounded-full ltr:left-3 rtl:right-3",
                                        dotColor,
                                    )}
                                >
                                  <span
                                      className={cn(
                                          "absolute inset-0 animate-ping rounded-full opacity-60",
                                          dotColor,
                                      )}
                                  />
                                </span>

                                {/* Price/Owned pill */}
                                <div className="absolute top-3 ltr:right-3 rtl:left-3">
                                  <Badge
                                      variant={owned ? "default" : isFree ? "secondary" : "outline"}
                                      className={cn(
                                          "rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                                          owned
                                              ? "border-transparent bg-emerald-600 text-white hover:bg-emerald-600 dark:bg-emerald-500"
                                              : isFree
                                                  ? "border-transparent bg-primary/15 text-primary hover:bg-primary/15"
                                                  : "border-border bg-background/70",
                                      )}
                                  >
                                    {owned ? t("Owned") : priceLabel}
                                  </Badge>
                                </div>

                                <div className="mb-3 mt-4 flex items-start gap-3 pe-16 ps-4">
                                  <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-primary/20 to-primary/5 text-sm font-bold text-primary ring-1 ring-primary/20 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                                    {chapter.index}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
                                      {chapter.title}
                                    </h3>
                                  </div>
                                </div>

                                <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/60 pt-3">
                                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <Clock className="h-3 w-3" />
                                    {formatUpdateTime(chapter.updatedAt, ti)}
                                  </div>
                                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                                    {owned ? (
                                        <>
                                          <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                          <span className="text-emerald-600 dark:text-emerald-400">
                                            {t("Read")}
                                          </span>
                                        </>
                                    ) : isFree ? (
                                        <>
                                          <Sparkles className="h-3.5 w-3.5 text-primary" />
                                          <span className="text-primary">{t("Access")}</span>
                                        </>
                                    ) : (
                                        <>
                                          <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                                          <span className="text-muted-foreground">{t("Buy")}</span>
                                        </>
                                    )}
                                  </div>
                                </div>
                              </motion.button>
                          );
                        })}
                      </motion.div>

                      {chaptersTotalPages > 1 && (
                          <motion.div
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.15 }}
                              className="border-t border-border/60 pt-6"
                          >
                            <AppPagination
                                currentPage={chaptersPage}
                                totalPages={chaptersTotalPages}
                                totalItems={chaptersTotal}
                                pageSize={CHAPTERS_PER_PAGE}
                                itemLabel={t("chapter")}
                                onPageChange={setChaptersPage}
                                canGoPrevious={!chaptersLoading && chaptersPage > 1}
                                canGoNext={!chaptersLoading && chaptersPage < chaptersTotalPages}
                                scrollTarget={chaptersPaginationScrollRef}
                            />
                          </motion.div>
                      )}
                    </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </section>

        {/* Related */}
        {relatedBooks.length > 0 && (
            <section>
              <div className="mb-5 flex items-end justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold sm:text-2xl">{t("SimilarBooks")}</h2>
                  <p className="text-sm text-muted-foreground">{t("MayLike")}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {relatedBooks.map((relatedBook) => (
                    <BookCard key={relatedBook.id} book={relatedBook} />
                ))}
              </div>
            </section>
        )}

        {book && actionChapter && (
            <ChapterPurchaseDialog
                book={book}
                chapter={actionChapter}
                typeSlug={typeSlug}
                onPurchased={handlePurchased}
                onClose={() => setActionChapter(null)}
            />
        )}
      </div>
  );
}