"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Star, Clock, BookOpen, Wallet } from "lucide-react";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
  chapters: Array<{
    id: number;
    title: string;
    index: number;
    isFree: boolean;
    price: number | null;
    updatedAt: string;
  }>;
};

type ViewerState = {
  walletBalance: number;
  myRating: number | null;
  purchasedChapterIds: number[];
};

const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

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
  const [selectedRating, setSelectedRating] = useState(0);
  const [actionChapterId, setActionChapterId] = useState<number | null>(null);

  const purchasedIds = useMemo(() => new Set(viewer?.purchasedChapterIds ?? []), [viewer?.purchasedChapterIds]);

  const loadPage = useCallback(async () => {
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
        const viewerState = await apiClient.get<ViewerState>(`/books/${bookId}/viewer-state`);
        setViewer(viewerState);
        setSelectedRating(viewerState.myRating ?? 0);
      } else {
        setIsAuthenticated(false);
        setViewer(null);
        setSelectedRating(0);
      }
    } catch (loadError) {
      setError(getApiErrorMessage(loadError, "Failed to load book details."));
    } finally {
      setIsLoading(false);
    }
  }, [bookId, typeSlug]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  const handleRate = async (rating: number) => {
    if (!book) return;
    if (!isAuthenticated) {
      setError("You must log in to rate this book.");
      return;
    }

    try {
      const updated = await apiClient.put<{ ratingAvg: number; ratingCount: number; rating: number }>(
        `/books/${book.id}/rating`,
        { rating },
      );
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
      setError(null);
    } catch (rateError) {
      setError(getApiErrorMessage(rateError, "Unable to save your rating."));
    }
  };

  const handleChapterClick = async (chapter: BookDetails["chapters"][number]) => {
    if (!book) return;
    if (!isAuthenticated) {
      setError("Only registered users can access chapters.");
      return;
    }

    const alreadyPurchased = purchasedIds.has(chapter.id);
    const chapterUrl = `/${encodeURIComponent(typeSlug)}/${book.id}/c/${chapter.index}`;

    if (alreadyPurchased) {
      router.push(chapterUrl);
      return;
    }

    const actionLabel = chapter.isFree || chapter.price == null ? "access" : "purchase";
    const promptMessage =
      actionLabel === "access"
        ? `This chapter is free. Confirm to access chapter ${chapter.index}?`
        : `Confirm purchase of chapter ${chapter.index} for $${Number(chapter.price).toFixed(2)}?`;

    const confirmed = window.confirm(promptMessage);
    if (!confirmed) return;

    try {
      setActionChapterId(chapter.id);
      await apiClient.post(`/books/${book.id}/chapters/${chapter.id}/purchase`);
      setViewer((prev) => {
        if (!prev) return prev;
        const next = new Set(prev.purchasedChapterIds);
        next.add(chapter.id);
        return {
          ...prev,
          walletBalance:
            chapter.isFree || chapter.price == null ? prev.walletBalance : Math.max(0, prev.walletBalance - Number(chapter.price)),
          purchasedChapterIds: [...next],
        };
      });
      router.push(chapterUrl);
    } catch (purchaseError) {
      setError(getApiErrorMessage(purchaseError, "Purchase failed. Please check your balance and try again."));
    } finally {
      setActionChapterId(null);
    }
  };

  if (isLoading) {
    return <div className="container mx-auto px-4 py-10">Loading book details...</div>;
  }

  if (!book) {
    return <div className="container mx-auto px-4 py-10 text-destructive">{error ?? "Book not found."}</div>;
  }

  return (
    <div className="container mx-auto px-4 py-10 space-y-6">
      {error && <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>}

      <Card>
        <CardContent className="p-6 grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
          <div>
            <Image
              src={book.coverMedia?.code ? `/media/${book.coverMedia.code}/thumbnail` : "/placeholder.svg"}
              alt={`Cover of ${book.title}`}
              width={220}
              height={330}
              className="w-full max-w-[220px] rounded-md border object-cover"
            />
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight">{book.title}</h1>
              <p className="text-sm text-muted-foreground">by {book.author || "Unknown author"}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Category: {book.type.name}</Badge>
              {book.genres.map(({ genre }) => (
                <Badge key={genre.id} variant="outline">
                  {genre.name}
                </Badge>
              ))}
            </div>

            <p className="text-sm leading-relaxed text-muted-foreground">{book.description || "No description available."}</p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div className="rounded-md border p-3">
                <p className="text-muted-foreground">Rating</p>
                <p className="font-semibold">{Number(book.ratingAvg ?? 0).toFixed(2)} / 5 ({book.ratingCount} ratings)</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-muted-foreground">Last update</p>
                <p className="font-semibold inline-flex items-center gap-2"><Clock className="h-4 w-4" />{formatDateTime(book.updatedAt)}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-muted-foreground">Chapters</p>
                <p className="font-semibold inline-flex items-center gap-2"><BookOpen className="h-4 w-4" />{book.chapters.length} total</p>
              </div>
            </div>

            {isAuthenticated && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Your rating</p>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <Button key={value} variant="ghost" size="sm" onClick={() => void handleRate(value)} className="px-2" aria-label={`Rate ${value} stars`}>
                      <Star className={`h-5 w-5 ${value <= selectedRating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {isAuthenticated && viewer && (
              <div className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <Wallet className="h-4 w-4" /> Wallet balance: ${viewer.walletBalance.toFixed(2)}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Chapters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {book.chapters.map((chapter) => {
            const owned = purchasedIds.has(chapter.id);
            const isBusy = actionChapterId === chapter.id;
            const priceLabel = chapter.isFree || chapter.price == null ? "Free" : `$${Number(chapter.price).toFixed(2)}`;

            return (
              <button
                key={chapter.id}
                type="button"
                onClick={() => void handleChapterClick(chapter)}
                disabled={isBusy}
                className="w-full text-left rounded-md border p-4 transition-colors hover:bg-muted/30 disabled:opacity-70"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">Chapter {chapter.index}: {chapter.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">Updated: {formatDateTime(chapter.updatedAt)}</p>
                  </div>
                  <div className="text-right space-y-1">
                    <Badge variant={chapter.isFree ? "secondary" : "outline"}>{priceLabel}</Badge>
                    <p className="text-xs text-muted-foreground">{owned ? "Purchased" : chapter.isFree ? "Access" : "Buy"}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
