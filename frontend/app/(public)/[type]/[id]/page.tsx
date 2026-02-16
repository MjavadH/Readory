"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  BookOpen,
  Clock3,
  Search,
  Sparkles,
  Star,
  Tag,
  UserRound,
  Lock,
  CircleCheck,
  ShoppingCart,
} from "lucide-react";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { BookCard } from "@/components/book-card";
import type { BookCardData } from "@/lib/types";

type BookDetails = {
  id: number;
  title: string;
  author?: string | null;
  description?: string | null;
  ratingAvg: number;
  ratingCount: number;
  updatedAt: string;
  type: { id: number; name: string; slug: string };
  coverMedia?: { code: string; filename: string } | null;
  genres: Array<{ genre: { id: number; name: string; slug: string } }>;
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
  walletBalance: number;
  myRating: number | null;
  purchasedChapterIds: number[];
};

type ActionChapter = ChapterItem & { mode: "purchase" | "access" };

const CHAPTERS_PER_PAGE = 50;

const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));

export default function BookDetailsPage() {
  const params = useParams<{ type: string; id: string }>();
  const router = useRouter();

  const typeSlug = Array.isArray(params.type) ? params.type[0] : params.type;
  const idParam = Array.isArray(params.id) ? params.id[0] : params.id;
  const bookId = Number(idParam);

  const [book, setBook] = useState<BookDetails | null>(null);
  const [viewer, setViewer] = useState<ViewerState | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [selectedRating, setSelectedRating] = useState(0);

  const [chapters, setChapters] = useState<ChapterItem[]>([]);
  const [chaptersPage, setChaptersPage] = useState(1);
  const [chaptersTotal, setChaptersTotal] = useState(0);
  const [chaptersTotalPages, setChaptersTotalPages] = useState(1);
  const [chapterSearch, setChapterSearch] = useState("");
  const [chapterSearchInput, setChapterSearchInput] = useState("");
  const [chaptersLoading, setChaptersLoading] = useState(false);

  const [relatedBooks, setRelatedBooks] = useState<BookCardData[]>([]);

  const [actionChapter, setActionChapter] = useState<ActionChapter | null>(
    null,
  );
  const [actionChapterId, setActionChapterId] = useState<number | null>(null);

  const purchasedIds = useMemo(
    () => new Set(viewer?.purchasedChapterIds ?? []),
    [viewer?.purchasedChapterIds],
  );

  const loadBase = useCallback(async () => {
    if (!Number.isInteger(bookId) || bookId <= 0 || !typeSlug) {
      setError("Invalid book link.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [bookData, profile] = await Promise.all([
        apiClient.get<BookDetails>(`/books/${bookId}`),
        apiClient.get("/auth/profile").catch(() => null),
      ]);

      if (!bookData || bookData.type.slug !== typeSlug) {
        setError("Book not found for this category.");
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
      setError(getApiErrorMessage(loadError, "Failed to load book details."));
    } finally {
      setIsLoading(false);
    }
  }, [bookId, typeSlug]);

  const loadChapters = useCallback(async () => {
    if (!Number.isInteger(bookId) || bookId <= 0) return;

    setChaptersLoading(true);
    try {
      const data = await apiClient.get<ChaptersResponse>(
        `/books/${bookId}/chapters?page=${chaptersPage}&limit=${CHAPTERS_PER_PAGE}&q=${encodeURIComponent(chapterSearch)}`,
      );
      setChapters(data.items);
      setChaptersTotal(data.pagination.total);
      setChaptersTotalPages(data.pagination.totalPages);
    } catch (chapterError) {
      setError(getApiErrorMessage(chapterError, "Failed to load chapters."));
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

  const handleRate = async (rating: number) => {
    if (!book || !isAuthenticated) {
      setError("You must log in to rate this book.");
      return;
    }

    try {
      const updated = await apiClient.put<{
        ratingAvg: number;
        ratingCount: number;
        rating: number;
      }>(`/books/${book.id}/rating`, {
        rating,
      });
      setSelectedRating(updated.rating);
      setBook((prev) =>
        prev
          ? {
              ...prev,
              ratingAvg: updated.ratingAvg,
              ratingCount: updated.ratingCount,
            }
          : prev,
      );
      setSuccessMessage("Your rating has been saved.");
      setError(null);
    } catch (rateError) {
      setError(getApiErrorMessage(rateError, "Unable to save your rating."));
    }
  };

  const onChapterSelect = (chapter: ChapterItem) => {
    if (!book) return;
    if (!isAuthenticated) {
      setError("Only registered users can view and access chapters.");
      return;
    }

    const alreadyPurchased = purchasedIds.has(chapter.id);
    if (alreadyPurchased) {
      router.push(
        `/${encodeURIComponent(typeSlug)}/${book.id}/c/${chapter.index}`,
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
      setActionChapterId(actionChapter.id);
      await apiClient.post(
        `/books/${book.id}/chapters/${actionChapter.id}/purchase`,
      );

      setViewer((prev) => {
        if (!prev) return prev;
        const next = new Set(prev.purchasedChapterIds);
        next.add(actionChapter.id);

        const nextBalance =
          actionChapter.mode === "purchase" &&
          typeof actionChapter.price === "number"
            ? Math.max(0, prev.walletBalance - actionChapter.price)
            : prev.walletBalance;

        return {
          ...prev,
          walletBalance: nextBalance,
          purchasedChapterIds: [...next],
        };
      });

      setSuccessMessage(
        actionChapter.mode === "access"
          ? `Chapter ${actionChapter.index} is now accessible.`
          : `Chapter ${actionChapter.index} purchased successfully.`,
      );

      setActionChapter(null);
      router.push(chapterUrl);
    } catch (purchaseError) {
      setError(
        getApiErrorMessage(
          purchaseError,
          "Purchase failed. Please check your balance and try again.",
        ),
      );
    } finally {
      setActionChapterId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">Loading book details...</div>
    );
  }

  if (!book) {
    return (
      <div className="container mx-auto px-4 py-8 text-destructive">
        {error ?? "Book not found."}
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-5 px-3 py-4 sm:px-4 sm:py-6">
      {error && (
        <div className="rounded-xl border border-destructive/35 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
          {successMessage}
        </div>
      )}

      <Card className="overflow-hidden">
        <CardContent className="grid gap-4 p-4 sm:grid-cols-[130px_1fr] sm:p-6 md:grid-cols-[220px_1fr]">
          <div className="animate-in fade-in zoom-in-95 duration-500">
            <Image
              src={
                book.coverMedia?.code
                  ? `/media/${book.coverMedia.code}/thumbnail`
                  : "/placeholder.svg"
              }
              alt={`Cover of ${book.title}`}
              width={220}
              height={330}
              className="h-auto w-full rounded-xl border object-cover shadow-sm"
              sizes="(max-width: 640px) 50vw, 220px"
            />
          </div>

          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                {book.title}
              </h1>
              <p className="mt-1 inline-flex items-center gap-2 text-sm text-muted-foreground">
                <UserRound className="h-4 w-4" />
                {book.author || "Unknown author"}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge className="gap-1" variant="secondary">
                <Tag className="h-3.5 w-3.5" />
                Category: {book.type.name}
              </Badge>
              {book.genres.map(({ genre }) => (
                <Badge key={genre.id} variant="outline">
                  {genre.name}
                </Badge>
              ))}
            </div>

            <p className="text-sm leading-relaxed text-muted-foreground">
              {book.description || "No description available."}
            </p>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="rounded-lg border bg-muted/20 p-3 text-sm">
                <p className="text-muted-foreground">Rating</p>
                <p className="mt-1 inline-flex items-center gap-1 font-semibold">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  {Number(book.ratingAvg ?? 0).toFixed(2)} / 5 (
                  {book.ratingCount})
                </p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3 text-sm">
                <p className="text-muted-foreground">Last updated</p>
                <p className="mt-1 inline-flex items-center gap-1 font-semibold">
                  <Clock3 className="h-4 w-4" />
                  {formatDateTime(book.updatedAt)}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3 text-sm">
                <p className="text-muted-foreground">Total chapters</p>
                <p className="mt-1 inline-flex items-center gap-1 font-semibold">
                  <BookOpen className="h-4 w-4" />
                  {chaptersTotal}
                </p>
              </div>
            </div>

            {isAuthenticated && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Rate this book</p>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <Button
                      key={value}
                      variant="ghost"
                      size="icon"
                      onClick={() => void handleRate(value)}
                      aria-label={`Rate ${value} stars`}
                      className="transition-transform hover:scale-110"
                    >
                      <Star
                        className={`h-5 w-5 ${value <= selectedRating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`}
                      />
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-xl">Chapters</CardTitle>
            <Badge variant="outline">{chaptersTotal} total</Badge>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={chapterSearchInput}
                onChange={(event) => setChapterSearchInput(event.target.value)}
                placeholder="Search chapter by name or index"
                className="pl-9"
              />
            </div>
            <Button
              type="button"
              onClick={() => {
                setChaptersPage(1);
                setChapterSearch(chapterSearchInput.trim());
              }}
            >
              Search
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {chaptersLoading ? (
            <div className="text-sm text-muted-foreground">
              Loading chapters...
            </div>
          ) : chapters.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No chapters matched your search.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {chapters.map((chapter) => {
                const owned = purchasedIds.has(chapter.id);
                const isBusy = actionChapterId === chapter.id;
                const isFree = chapter.isFree || chapter.price == null;
                const priceLabel = isFree
                  ? "Free"
                  : `$${Number(chapter.price).toFixed(2)}`;

                return (
                  <button
                    key={chapter.id}
                    type="button"
                    onClick={() => onChapterSelect(chapter)}
                    disabled={isBusy}
                    className="group rounded-xl border bg-card p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md disabled:opacity-70"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="line-clamp-2 text-sm font-semibold">
                          Chapter {chapter.index}: {chapter.title}
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Updated {formatDateTime(chapter.updatedAt)}
                        </p>
                      </div>
                      <Badge variant={isFree ? "secondary" : "outline"}>
                        {priceLabel}
                      </Badge>
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                      {owned ? (
                        <>
                          <CircleCheck className="h-3.5 w-3.5 text-emerald-500" />
                          Purchased • Tap to open
                        </>
                      ) : isFree ? (
                        <>
                          <Sparkles className="h-3.5 w-3.5" />
                          Free • Tap to access
                        </>
                      ) : (
                        <>
                          <ShoppingCart className="h-3.5 w-3.5" />
                          Paid • Tap to buy
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-2">
            <p className="text-xs text-muted-foreground">
              Page {chaptersPage} of {chaptersTotalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={chaptersPage <= 1 || chaptersLoading}
                onClick={() => setChaptersPage((prev) => Math.max(1, prev - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={chaptersPage >= chaptersTotalPages || chaptersLoading}
                onClick={() =>
                  setChaptersPage((prev) =>
                    Math.min(chaptersTotalPages, prev + 1),
                  )
                }
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Similar books</CardTitle>
        </CardHeader>
        <CardContent>
          {relatedBooks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No related books available yet.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {relatedBooks.map((relatedBook) => (
                <BookCard key={relatedBook.id} book={relatedBook} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={Boolean(actionChapter)}
        onOpenChange={(open) => !open && setActionChapter(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              {actionChapter?.mode === "access" ? (
                <Sparkles className="h-7 w-7" />
              ) : (
                <Lock className="h-7 w-7" />
              )}
            </AlertDialogMedia>
            <AlertDialogTitle>
              {actionChapter?.mode === "access"
                ? "Access chapter"
                : "Buy chapter"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionChapter?.mode === "access"
                ? `Chapter ${actionChapter?.index} is free. Confirm to access this chapter.`
                : `Confirm purchase for chapter ${actionChapter?.index} for $${Number(actionChapter?.price ?? 0).toFixed(2)}.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionChapterId === actionChapter?.id}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void confirmChapterAction()}
              disabled={actionChapterId === actionChapter?.id}
            >
              {actionChapter?.mode === "access"
                ? "Access chapter"
                : "Confirm purchase"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
