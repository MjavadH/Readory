"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  BookOpen,
  Check,
  Clock,
  Lock,
  Search,
  Send,
  Sparkles,
  Star,
  User,
  AlertCircle,
  ArrowDown10,
  ArrowUp10,
} from "lucide-react";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { BookCard } from "@/components/book-card";
import type { BookCardData } from "@/lib/types";
import { formatUpdateTime } from "@/lib/time";
import { AppPagination } from "@/components/app-pagination";
import type { IconKey } from "@readory/shared";
import { AppIcon } from "@/components/AppIcon";
import { useToast } from "@/providers/toast-provider";
import { useTranslations } from "next-intl";
import { ChapterPurchaseDialog } from "@/components/chapter-purchase-dialog";

type BookDetails = {
  id: number;
  title: string;
  author?: string | null;
  description?: string | null;
  coverImage: string;
  isFeatured: boolean;
  ratingAvg: number;
  ratingCount: number;
  updatedAt: string;
  type: { name: string; slug: string; iconKey: IconKey };
  genres: Array<{ id: number; name: string; slug: string; iconKey: IconKey }>;
};

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
};

type ActionChapter = ChapterItem & { mode: "purchase" | "access" };

const CHAPTERS_PER_PAGE = 60;

function BookDetailsSkeleton() {
  return (
      <div className="container mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="animate-pulse">
          <Card className="overflow-hidden border-border">
            <CardContent className="p-5 sm:p-8">
              <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
                <div className="mx-auto aspect-2/3 w-44 rounded-2xl bg-muted sm:w-56 lg:w-full" />
                <div className="space-y-6">
                  <div className="space-y-3">
                    <div className="h-8 w-3/4 rounded-lg bg-muted" />
                    <div className="h-5 w-1/3 rounded-lg bg-muted" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-6 w-20 rounded-full bg-muted" />
                    ))}
                  </div>
                  <div className="space-y-2">
                    <div className="h-4 w-full rounded bg-muted" />
                    <div className="h-4 w-full rounded bg-muted" />
                    <div className="h-4 w-2/3 rounded bg-muted" />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-20 rounded-xl bg-muted" />
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
  );
}

function BrowseChaptersSkeleton() {
  return (
      <div className="animate-pulse space-y-4">
        <div className="h-10 w-full max-w-sm rounded-lg bg-muted" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-28 rounded-xl bg-muted" />
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

  const [book, setBook] = useState<BookDetails | null>(null);
  const [viewer, setViewer] = useState<ViewerState | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedRating, setSelectedRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [isRatingPending, setIsRatingPending] = useState(false);

  const [chapters, setChapters] = useState<ChapterItem[]>([]);
  const [chaptersPage, setChaptersPage] = useState(1);
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
        apiClient.get<BookDetails>(`/books/${bookId}`),
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
        <div className="container mx-auto max-w-7xl px-4 py-16 text-center sm:py-24">
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

  const stats = [
    {
      key: "rating",
      icon: Star,
      iconClass: "bg-amber-500 dark:bg-amber-500",
      label: t("Rating"),
      value: (
          <span className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-foreground">
            {ratingValue.toFixed(1)}
          </span>
          <span className="text-sm text-muted-foreground">/ 5</span>
        </span>
      ),
      sub: t("NReviews", { count: book.ratingCount }),
    },
    {
      key: "updated",
      icon: Clock,
      iconClass: "bg-blue-600 dark:bg-blue-500",
      label: t("LastUpdated"),
      value: (
          <span className="text-base font-semibold text-foreground">
          {formatUpdateTime(book.updatedAt, ti)}
        </span>
      ),
      sub: null,
    },
    {
      key: "chapters",
      icon: BookOpen,
      iconClass: "bg-emerald-600 dark:bg-emerald-500",
      label: t("TotalChapters"),
      value: (
          <span className="text-2xl font-bold text-foreground">
          {chaptersTotal}
        </span>
      ),
      sub: null,
    },
  ];

  return (
      <div className="container mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* Hero */}
        <Card className="overflow-hidden border-border shadow-sm">
          <CardContent className="p-5 sm:p-8">
            <div className="grid gap-6 lg:grid-cols-[260px_1fr] lg:gap-8">
              <div className="mx-auto w-44 sm:w-56 lg:w-full">
                <div className="group relative aspect-2/3 overflow-hidden rounded-2xl bg-muted shadow-lg ring-1 ring-border">
                  <Image
                      src={
                        book.coverImage
                            ? `/media/${book.coverImage}/thumbnail`
                            : "/placeholder.svg"
                      }
                      alt={`Cover of ${book.title}`}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      sizes="(max-width: 640px) 11rem, (max-width: 1024px) 14rem, 260px"
                      priority
                  />
                </div>
              </div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <h1 className="text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
                    {book.title}
                  </h1>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="h-4 w-4 shrink-0" />
                    <span className="text-sm font-medium">
                    {book.author || t("UnknownAuthor")}
                  </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge className="gap-1.5 border-transparent bg-blue-600 text-white hover:bg-blue-600 dark:bg-blue-500">
                    <AppIcon name={book.type.iconKey} className="h-3.5 w-3.5" />
                    {book.type.name}
                  </Badge>
                  {book.genres.map((genre) => (
                      <Badge
                          key={genre.id}
                          variant="outline"
                          className="gap-1.5 border-border bg-background"
                      >
                        <AppIcon name={genre.iconKey} className="h-3.5 w-3.5" />
                        {genre.name}
                      </Badge>
                  ))}
                </div>

                <p className="text-pretty leading-relaxed text-muted-foreground">
                  {book.description || t("NoDescriptionAvailable")}
                </p>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {stats.map(({ key, icon: Icon, iconClass, label, value, sub }) => (
                      <div
                          key={key}
                          className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-4"
                      >
                        <div
                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white shadow-sm ${iconClass}`}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            {label}
                          </p>
                          <div className="mt-0.5">{value}</div>
                          {sub && (
                              <p className="text-xs text-muted-foreground">{sub}</p>
                          )}
                        </div>
                      </div>
                  ))}
                </div>

                {isAuthenticated && (
                    <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <p className="font-semibold text-foreground">
                          {t("RateThisBook")}
                        </p>
                        {selectedRating > 0 && (
                            <span className="text-xs font-medium text-muted-foreground">
                        {t("UserRate", { UserRate: selectedRating })}
                      </span>
                        )}
                      </div>
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((value) => (
                              <button
                                  key={value}
                                  type="button"
                                  onClick={() => handleSelectRating(value)}
                                  onMouseEnter={() => setHoverRating(value)}
                                  onMouseLeave={() => setHoverRating(0)}
                                  className="rounded-md p-1 transition-transform duration-200 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95"
                                  aria-label={`Rate ${value} stars`}
                              >
                                <Star
                                    className={`h-8 w-8 transition-colors duration-200 ${
                                        value <= (hoverRating || selectedRating)
                                            ? "fill-amber-400 text-amber-400"
                                            : "text-muted-foreground/40"
                                    }`}
                                />
                              </button>
                          ))}
                        </div>
                        <Button
                            onClick={() => void handleSubmitRating()}
                            disabled={isRatingPending || selectedRating === 0}
                            className="h-11 gap-2"
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
                    </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Chapters */}
        <Card className="border-border">
          <CardHeader className="space-y-4 border-b border-border">
            <div>
              <CardTitle className="text-xl font-bold sm:text-2xl">
                {t("Chapters")}
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("BrowseAvailableChapters")}
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground ltr:left-3 rtl:right-3" />
                <Input
                    value={chapterSearchInput}
                    onChange={(e) => setChapterSearchInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    placeholder={t("SearchNameOrIndex")}
                    className="h-11 ps-9"
                />
              </div>
              <Button
                  onClick={handleSearch}
                  disabled={chaptersLoading}
                  className="h-11"
              >
                <Search className="me-2 h-4 w-4" />
                {t("Search")}
              </Button>
              <Button
                  variant="outline"
                  onClick={toggleOrder}
                  disabled={chaptersLoading}
                  className="h-11 w-11 shrink-0 p-0"
                  aria-label="Toggle sorting order"
              >
                {chaptersOrder === "asc" ? (
                    <ArrowDown10 className="h-5 w-5" />
                ) : (
                    <ArrowUp10 className="h-5 w-5" />
                )}
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-6 p-4 sm:p-6">
            {chaptersLoading ? (
                <BrowseChaptersSkeleton />
            ) : chapters.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-14 text-center">
                  <BookOpen className="mb-3 h-12 w-12 text-muted-foreground/50" />
                  <p className="text-sm font-medium text-foreground">
                    {t("NoChaptersFound")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("AdjustingSearch")}
                  </p>
                </div>
            ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {chapters.map((chapter) => {
                      const owned = purchasedIds.has(chapter.id);
                      const isFree = chapter.isFree || chapter.price == null;
                      const priceLabel = isFree
                          ? t("Free")
                          : t("ChapterPrice", {
                            CurrencySymbols: g("CurrencySymbols"),
                            ChapterPrice: Number(chapter.price).toFixed(2),
                          });

                      return (
                          <button
                              key={chapter.id}
                              type="button"
                              onClick={() => onChapterSelect(chapter)}
                              className="group relative flex flex-col rounded-xl border border-border bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ltr:text-left rtl:text-right dark:hover:border-blue-600"
                          >
                            <div className="absolute top-3 ltr:right-3 rtl:left-3">
                              <Badge
                                  variant={owned ? "default" : isFree ? "secondary" : "outline"}
                                  className={
                                    owned
                                        ? "border-transparent bg-emerald-600 text-white hover:bg-emerald-600 dark:bg-emerald-500"
                                        : isFree
                                            ? "border-transparent bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300"
                                            : "border-border bg-background"
                                  }
                              >
                                {owned ? t("Owned") : priceLabel}
                              </Badge>
                            </div>

                            <div className="mb-3 flex items-start gap-3 pe-16">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white shadow-sm dark:bg-blue-500">
                                {chapter.index}
                              </div>
                              <div className="min-w-0 flex-1">
                                <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
                                  {chapter.title}
                                </h3>
                              </div>
                            </div>

                            <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3">
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {formatUpdateTime(chapter.updatedAt, ti)}
                              </div>
                              <div className="flex items-center gap-1.5 text-xs font-medium">
                                {owned ? (
                                    <>
                                      <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                      <span className="text-emerald-600 dark:text-emerald-400">
                                        {t("Read")}
                                      </span>
                                    </>
                                ) : isFree ? (
                                    <>
                                      <Sparkles className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                                      <span className="text-blue-600 dark:text-blue-400">
                                        {t("Access")}
                                      </span>
                                    </>
                                ) : (
                                    <>
                                      <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                                      <span className="text-muted-foreground">
                                        {t("Buy")}
                                      </span>
                                    </>
                                )}
                              </div>
                            </div>
                          </button>
                      );
                    })}
                  </div>
                  {chaptersTotalPages > 1 && (
                      <div className="border-t border-border pt-6">
                        <AppPagination
                            currentPage={chaptersPage}
                            totalPages={chaptersTotalPages}
                            totalItems={chaptersTotal}
                            pageSize={CHAPTERS_PER_PAGE}
                            itemLabel={t("chapter")}
                            onPageChange={setChaptersPage}
                            canGoPrevious={!chaptersLoading && chaptersPage > 1}
                            canGoNext={!chaptersLoading && chaptersPage < chaptersTotalPages}
                        />
                      </div>
                  )}
                </>
            )}
          </CardContent>
        </Card>

        {relatedBooks.length > 0 && (
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-xl font-bold sm:text-2xl">
                  {t("MayLike")}
                </CardTitle>
                <p className="text-sm text-muted-foreground">{t("SimilarBooks")}</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                  {relatedBooks.map((relatedBook) => (
                      <BookCard key={relatedBook.id} book={relatedBook} />
                  ))}
                </div>
              </CardContent>
            </Card>
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
