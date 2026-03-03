"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  BookOpen,
  Clock,
  Search,
  Sparkles,
  Star,
  User,
  Lock,
  Check,
  ShoppingCart,
  Unlock,
  AlertCircle,
  Send,
} from "lucide-react";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { BookCard } from "@/components/book-card";
import type { BookCardData } from "@/lib/types";
import { formatUpdateTime } from "@/lib/time";
import {AppPagination} from "@/components/app-pagination";
import type { IconKey } from "@readory/shared";
import {AppIcon} from "@/components/AppIcon";
import {useToast} from "@/providers/toast-provider";

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
  genres: Array<{ genre: { id: number; name: string; slug: string; iconKey: IconKey } }>;
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
          <Card className="overflow-hidden border-0 bg-linear-to-br from-slate-50 to-slate-100/50 shadow-xl dark:from-slate-900 dark:to-slate-800/50">
            <CardContent className="p-6 sm:p-8">
              <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
                <div className="mx-auto h-105 w-full max-w-70 rounded-2xl bg-slate-300 dark:bg-slate-700" />
                <div className="space-y-6">
                  <div className="space-y-3">
                    <div className="h-8 w-3/4 rounded-lg bg-slate-300 dark:bg-slate-700" />
                    <div className="h-5 w-1/3 rounded-lg bg-slate-300 dark:bg-slate-700" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[1, 2, 3].map((i) => (
                        <div
                            key={i}
                            className="h-6 w-20 rounded-full bg-slate-300 dark:bg-slate-700"
                        />
                    ))}
                  </div>
                  <div className="space-y-2">
                    <div className="h-4 w-full rounded bg-slate-300 dark:bg-slate-700" />
                    <div className="h-4 w-full rounded bg-slate-300 dark:bg-slate-700" />
                    <div className="h-4 w-2/3 rounded bg-slate-300 dark:bg-slate-700" />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[1, 2, 3].map((i) => (
                        <div
                            key={i}
                            className="h-24 rounded-xl bg-slate-300 dark:bg-slate-700"
                        />
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
        <div className="h-10 w-64 rounded-lg bg-slate-300 dark:bg-slate-700" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
              <div
                  key={i}
                  className="rounded-xl border bg-card p-4"
              >
                <div className="mb-3 flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-slate-300 dark:bg-slate-700" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-full rounded bg-slate-300 dark:bg-slate-700" />
                    <div className="h-3 w-2/3 rounded bg-slate-300 dark:bg-slate-700" />
                  </div>
                </div>
                <div className="border-t border-slate-200 pt-3 dark:border-slate-800">
                  <div className="h-3 w-1/2 rounded bg-slate-300 dark:bg-slate-700" />
                </div>
              </div>
          ))}
        </div>
      </div>
  );
}

function ConfirmDialog({chapter, onConfirm, onCancel, isPending}: {
  chapter: ActionChapter;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in">
        <div className="w-full max-w-md animate-in zoom-in-95 rounded-2xl border bg-card p-6 shadow-2xl">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-linear-to-br from-blue-500 to-cyan-500">
            {chapter.mode === "access" ? (
                <Unlock className="h-6 w-6 text-white" />
            ) : (
                <ShoppingCart className="h-6 w-6 text-white" />
            )}
          </div>
          <h3 className="mb-2 text-xl font-bold">
            {chapter.mode === "access" ? "Access Chapter" : "Purchase Chapter"}
          </h3>
          <p className="mb-6 text-sm text-muted-foreground">
            {chapter.mode === "access"
                ? `Chapter ${chapter.index}: "${chapter.title}" is free. Confirm to access this chapter.`
                : `Purchase Chapter ${chapter.index}: "${chapter.title}" for $${Number(chapter.price ?? 0).toFixed(2)}. The amount will be deducted from your wallet.`}
          </p>
          <div className="flex gap-3">
            <Button
                variant="outline"
                onClick={onCancel}
                disabled={isPending}
                className="flex-1"
            >
              Cancel
            </Button>
            <Button
                onClick={onConfirm}
                disabled={isPending}
                className="flex-1 bg-linear-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
            >
              {isPending ? (
                  <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Processing...
              </span>
              ) : chapter.mode === "access" ? (
                  "Confirm Access"
              ) : (
                  "Confirm Purchase"
              )}
            </Button>
          </div>
        </div>
      </div>
  );
}

export default function BookDetailsPage() {
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
  const [chaptersLoading, setChaptersLoading] = useState(false);

  const [relatedBooks, setRelatedBooks] = useState<BookCardData[]>([]);

  const [actionChapter, setActionChapter] = useState<ActionChapter | null>(null);
  const [actionPending, setActionPending] = useState(false);

  const purchasedIds = useMemo(
      () => new Set(viewer?.purchasedChapterIds ?? []),
      [viewer?.purchasedChapterIds]
  );

  const loadBase = useCallback(async () => {
    if (!Number.isInteger(bookId) || bookId <= 0 || !typeSlug) {
      toast.error("Invalid book link.")
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
        toast.error("Book not found for this category.")
        return;
      }

      setBook(bookData);

      if (profile) {
        setIsAuthenticated(true);
        const viewerState = await apiClient.get<ViewerState>(
            `/books/${bookId}/viewer-state`
        );
        setViewer(viewerState);
        setSelectedRating(viewerState.myRating ?? 0);
      } else {
        setIsAuthenticated(false);
        setViewer(null);
        setSelectedRating(0);
      }

      const relatedResponse = await apiClient.get<{ items: BookCardData[] }>(
          `/books/${bookId}/related?limit=12`
      );
      setRelatedBooks(relatedResponse.items ?? []);
    } catch (loadError) {
      toast.error(getApiErrorMessage(loadError, "Failed to load book details."))
    } finally {
      setIsLoading(false);
    }
  }, [bookId, typeSlug]);

  const loadChapters = useCallback(async () => {
    if (!Number.isInteger(bookId) || bookId <= 0) return;

    setChaptersLoading(true);
    try {
      const data = await apiClient.get<ChaptersResponse>(
          `/books/${bookId}/chapters?page=${chaptersPage}&limit=${CHAPTERS_PER_PAGE}&q=${encodeURIComponent(chapterSearch)}`
      );
      setChapters(data.items);
      setChaptersTotal(data.pagination.total);
      setChaptersTotalPages(data.pagination.totalPages);
    } catch (chapterError) {
      toast.error(getApiErrorMessage(chapterError, "Failed to load chapters."))
    } finally {
      setChaptersLoading(false);
    }
  }, [bookId, chapterSearch, chaptersPage]);

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
      toast.error("Please select a rating before submitting.")
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
              : prev
      );
      toast.success("Rating saved successfully!")
    } catch (rateError) {
      toast.error(getApiErrorMessage(rateError, "Unable to save your rating."))
    } finally {
      setIsRatingPending(false);
    }
  };

  const onChapterSelect = (chapter: ChapterItem) => {
    if (!book) return;
    if (!isAuthenticated) {
      toast.error("Only registered users can view and access chapters.")
      return;
    }

    const alreadyPurchased = purchasedIds.has(chapter.id);
    if (alreadyPurchased) {
      router.push(
          `/${encodeURIComponent(typeSlug)}/${book.id}/c/${chapter.index}`
      );
      return;
    }

    setActionChapter({
      ...chapter,
      mode: chapter.isFree || chapter.price == null ? "access" : "purchase",
    });
  };

  const confirmChapterAction = async () => {
    if (!book || !actionChapter) return;

    const chapterUrl = `/${encodeURIComponent(typeSlug)}/${book.id}/c/${actionChapter.index}`;

    try {
      setActionPending(true);
      await apiClient.post(
          `/books/${book.id}/chapters/${actionChapter.id}/purchase`
      );

      setViewer((prev) => {
        if (!prev) return prev;
        const next = new Set(prev.purchasedChapterIds);
        next.add(actionChapter.id);
        return { ...prev, purchasedChapterIds: [...next] };
      });
      toast.success(actionChapter.mode === "access"
          ? "Chapter is now accessible!"
          : "Chapter purchased successfully!",)

      setActionChapter(null);
      router.push(chapterUrl);
    } catch (purchaseError) {
      toast.error(getApiErrorMessage(purchaseError, "Purchase failed. Please check your balance and try again."))
    } finally {
      setActionPending(false);
    }
  };

  const handleSearch = () => {
    setChaptersPage(1);
    setChapterSearch(chapterSearchInput.trim());
  };

  if (isLoading) {
    return <BookDetailsSkeleton />;
  }

  if (!book) {
    return (
        <div className="container mx-auto max-w-7xl px-4 py-12 text-center">
          <div className="mx-auto max-w-md">
            <div className="mb-4 flex justify-center">
              <div className="rounded-full bg-red-100 p-3 dark:bg-red-950">
                <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
            </div>
            <h2 className="mb-2 text-2xl font-bold">Book Not Found</h2>
            <p className="text-muted-foreground">
              The book you're looking for doesn't exist or has been removed.
            </p>
          </div>
        </div>
    );
  }

  return (
      <div className="container mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <Card className="overflow-hidden border-0 bg-linear-to-br from-slate-50 to-slate-100/50 shadow-xl transition-all duration-300 hover:shadow-2xl dark:from-slate-900 dark:to-slate-800/50">
          <CardContent className="p-6 sm:p-8">
            <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
              <div className="group mx-auto w-full max-w-70">
                <div className="relative overflow-hidden rounded-2xl shadow-2xl transition-transform duration-300 group-hover:scale-[1.02]">
                  <Image
                      src={
                        book.coverImage
                            ? `/media/${book.coverImage}/thumbnail`
                            : "/placeholder.svg"
                      }
                      alt={`Cover of ${book.title}`}
                      width={280}
                      height={420}
                      className="h-auto w-full object-cover"
                      sizes="(max-width: 640px) 100vw, 280px"
                      priority
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <h1 className="bg-linear-to-r from-slate-900 to-slate-700 bg-clip-text text-3xl font-bold tracking-tight text-transparent dark:from-slate-100 dark:to-slate-300 sm:text-4xl">
                    {book.title}
                  </h1>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="h-4 w-4" />
                    <span className="text-sm font-medium">
                    {book.author || "Unknown Author"}
                  </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge className="gap-1.5 border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">
                    <AppIcon name={book.type.iconKey} className="h-3.5 w-3.5" />
                    {book.type.name}
                  </Badge>
                  {book.genres.map(({ genre }) => (
                      <Badge
                          key={genre.id}
                          variant="outline"
                          className="border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900"
                      >
                        <AppIcon name={genre.iconKey} className="h-3.5 w-3.5" />
                        {genre.name}
                      </Badge>
                  ))}
                </div>

                <p className="leading-relaxed text-slate-700 dark:text-slate-300">
                  {book.description || "No description available."}
                </p>

                <div className="space-y-4">
                  <div className="flex flex-col gap-4 sm:flex-row">
                    <div className="flex flex-1 items-center gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-800/30">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-amber-400 to-orange-500 text-white shadow-lg">
                        <Star className="h-6 w-6" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-600 dark:text-slate-400">
                          Rating
                        </p>
                        <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-slate-900 dark:text-white">
                          {Number(book.ratingAvg ?? 0).toFixed(1)}
                        </span>
                          <span className="text-sm text-slate-600 dark:text-slate-400">
                          / 5
                        </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          {book.ratingCount} {book.ratingCount === 1 ? "rating" : "ratings"}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-1 items-center gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-800/30">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-blue-400 to-cyan-500 text-white shadow-lg">
                        <Clock className="h-6 w-6" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-600 dark:text-slate-400">
                          Last Updated
                        </p>
                        <p className="mt-1 font-semibold text-slate-900 dark:text-white">
                          {formatUpdateTime(book.updatedAt)}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-1 items-center gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-800/30">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-emerald-400 to-teal-500 text-white shadow-lg">
                        <BookOpen className="h-6 w-6" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-600 dark:text-slate-400">
                          Total Chapters
                        </p>
                        <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                          {chaptersTotal}
                        </p>
                      </div>
                    </div>
                  </div>

                  {isAuthenticated && (
                      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/50">
                        <div className="mb-4 flex items-center justify-between">
                          <p className="font-semibold text-slate-900 dark:text-white">
                            Rate This Book
                          </p>
                          {selectedRating > 0 && (
                              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                          {selectedRating} out of 5
                        </span>
                          )}
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="mb-4 flex items-center gap-2">
                            {[1, 2, 3, 4, 5].map((value) => (
                                <button
                                    key={value}
                                    onClick={() => handleSelectRating(value)}
                                    onMouseEnter={() => setHoverRating(value)}
                                    onMouseLeave={() => setHoverRating(0)}
                                    className="transition-transform duration-200 hover:scale-110 active:scale-95"
                                    aria-label={`Rate ${value} stars`}
                                >
                                  <Star
                                      className={`h-8 w-8 transition-all duration-200 ${
                                          value <= (hoverRating || selectedRating)
                                              ? "fill-amber-400 text-amber-400 drop-shadow-lg"
                                              : "text-slate-300 dark:text-slate-600"
                                      }`}
                                  />
                                </button>
                            ))}
                          </div>
                          <Button
                              onClick={() => void handleSubmitRating()}
                              disabled={isRatingPending || selectedRating === 0}
                              className="gap-2 bg-linear-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700"
                          >
                            {isRatingPending ? (
                                <span className="flex items-center gap-2">
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          Submitting...
                        </span>
                            ) : (
                                <>
                                  <Send className="h-4 w-4" />
                                  Submit Rating
                                </>
                            )}
                          </Button>
                        </div>
                      </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-800">
          <CardHeader className="space-y-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <CardTitle className="text-2xl font-bold">Chapters</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Browse all available chapters
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    value={chapterSearchInput}
                    onChange={(e) => setChapterSearchInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    placeholder="Search by name or index..."
                    className="pl-9"
                />
              </div>
              <Button
                  onClick={handleSearch}
                  disabled={chaptersLoading}
                  className="bg-linear-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
              >
                <Search className="mr-2 h-4 w-4" />
                Search
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-6 p-6">
            {chaptersLoading ? (
                <BrowseChaptersSkeleton />
            ) : chapters.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 py-12 dark:border-slate-700">
                  <BookOpen className="mb-3 h-12 w-12 text-slate-400" />
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    No chapters found
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Try adjusting your search
                  </p>
                </div>
            ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {chapters.map((chapter) => {
                      const owned = purchasedIds.has(chapter.id);
                      const isFree = chapter.isFree || chapter.price == null;
                      const priceLabel = isFree
                          ? "Free"
                          : `$${Number(chapter.price).toFixed(2)}`;

                      return (
                          <button
                              key={chapter.id}
                              onClick={() => onChapterSelect(chapter)}
                              className="group relative overflow-hidden rounded-xl border bg-card p-4 text-left transition-all duration-300 hover:-translate-y-1 hover:border-blue-300 hover:shadow-xl dark:hover:border-blue-700"
                          >
                            <div className="absolute right-2 top-2">
                              <Badge
                                  variant={owned ? "default" : isFree ? "secondary" : "outline"}
                                  className={
                                    owned
                                        ? "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                        : isFree
                                            ? "border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300"
                                            : ""
                                  }
                              >
                                {owned ? "Owned" : priceLabel}
                              </Badge>
                            </div>

                            <div className="mb-3 flex items-start gap-3 pr-20">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-blue-500 to-cyan-500 text-sm font-bold text-white shadow-lg">
                                {chapter.index}
                              </div>
                              <div className="min-w-0 flex-1">
                                <h3 className="line-clamp-2 text-sm font-semibold leading-snug">
                                  {chapter.title}
                                </h3>
                              </div>
                            </div>

                            <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {formatUpdateTime(chapter.updatedAt)}
                              </div>
                              <div className="flex items-center gap-1.5 text-xs font-medium">
                                {owned ? (
                                    <>
                                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                                      <span className="text-emerald-600">Read</span>
                                    </>
                                ) : isFree ? (
                                    <>
                                      <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                                      <span className="text-blue-600">Access</span>
                                    </>
                                ) : (
                                    <>
                                      <Lock className="h-3.5 w-3.5 text-slate-600" />
                                      <span className="text-slate-600">Buy</span>
                                    </>
                                )}
                              </div>
                            </div>

                            <div className="absolute inset-0 -z-10 bg-linear-to-br from-blue-500/5 to-cyan-500/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                          </button>
                      );
                    })}
                  </div>
                  {chaptersTotalPages > 1 && (
                      <div className="border-t border-slate-200 pt-6 sm:flex-row dark:border-slate-800">
                        <AppPagination
                            currentPage={chaptersPage}
                            totalPages={chaptersTotalPages}
                            totalItems={chaptersTotal}
                            pageSize={CHAPTERS_PER_PAGE}
                            itemLabel="chapter"
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
            <Card className="border-slate-200 dark:border-slate-800">
              <CardHeader>
                <CardTitle className="text-2xl font-bold">You May Also Like</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Similar books based on your interests
                </p>
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

        {actionChapter && (
            <ConfirmDialog
                chapter={actionChapter}
                onConfirm={() => void confirmChapterAction()}
                onCancel={() => setActionChapter(null)}
                isPending={actionPending}
            />
        )}
      </div>
  );
}
