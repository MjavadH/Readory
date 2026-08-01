"use client";

import { getBookCoverThumbnailUrl } from "@/lib/media";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { BookCard } from "@/components/book-card";
import type { BookCardData } from "@/lib/types";
import type { Collection } from "@/lib/collection-types";
import { useToast } from "@/providers/toast-provider";
import { useTranslations } from "next-intl";
import { ChapterPurchaseDialog } from "@/components/chapter-purchase-dialog";
import {
  BookDetails,
  BookDetailsData,
  BookDetailsSkeleton,
} from "@/components/book-details";
import {
  ChaptersSection,
  type ChaptersSectionChapter,
} from "@/components/chapters-section";

type ChaptersResponse = {
  items: ChaptersSectionChapter[];
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

type ActionChapter = ChaptersSectionChapter & { mode: "purchase" | "access" };

const CHAPTERS_PER_PAGE = 36;

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
  const [collectionDialogOpen, setCollectionDialogOpen] = useState(false);
  const [userCollections, setUserCollections] = useState<Array<Collection & { containsBook?: boolean }>>([]);
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<number[]>([]);
  const [collectionsLoading, setCollectionsLoading] = useState(false);

  const [chapters, setChapters] = useState<ChaptersSectionChapter[]>([]);
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
      () => viewer?.purchasedChapterIds ?? [],
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
          `/books/${bookId}/chapters?page=${chaptersPage}&limit=${CHAPTERS_PER_PAGE}&q=${encodeURIComponent(chapterSearch)}&order=${chaptersOrder}&publishStatus=PUBLISHED`,
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

  const handleSelectRating = (rating: number) => setSelectedRating(rating);

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


  const openCollectionDialog = async () => {
    if (!book) return;
    if (!isAuthenticated) {
      toast.error(t("OnlyRegisteredUsers"));
      return;
    }

    setCollectionDialogOpen(true);
    setCollectionsLoading(true);
    try {
      const res = await apiClient.get<{ items: Array<Collection & { containsBook?: boolean }> }>(`/collections/mine?limit=48&bookId=${book.id}`);
      const items = res.items ?? [];
      setUserCollections(items);
      setSelectedCollectionIds(items.filter((collection) => collection.containsBook).map((collection) => collection.id));
    } catch (err) {
      toast.error(getApiErrorMessage(err, t("FailedLoadDetails")));
    } finally {
      setCollectionsLoading(false);
    }
  };

  const saveCollectionSelection = async () => {
    if (!book) return;
    setCollectionsLoading(true);
    try {
      const existingIds = new Set(userCollections.filter((collection) => collection.containsBook).map((collection) => collection.id));
      const idsToAdd = selectedCollectionIds.filter((id) => !existingIds.has(id));
      await Promise.all(idsToAdd.map((id) => apiClient.post(`/collections/${id}/items`, { bookId: book.id })));
      toast.success(t("AddedToCollections"));
      setCollectionDialogOpen(false);
    } catch (err) {
      toast.error(getApiErrorMessage(err, t("UnableSaveRating")));
    } finally {
      setCollectionsLoading(false);
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

  const onChapterSelect = (chapter: ChaptersSectionChapter) => {
    if (!book) return;
    if (!isAuthenticated) {
      toast.error(t("OnlyRegisteredUsers"));
      return;
    }

    const alreadyPurchased = new Set(purchasedIds).has(chapter.id);
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
            onAddToCollection={openCollectionDialog}
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

        {/* Chapters (shared component, public mode) */}
        <ChaptersSection
            mode="public"
            chapters={chapters}
            chaptersLoading={chaptersLoading}
            chaptersTotal={chaptersTotal}
            chaptersTotalPages={chaptersTotalPages}
            chaptersPage={chaptersPage}
            pageSize={CHAPTERS_PER_PAGE}
            onPageChange={setChaptersPage}
            scrollRef={chaptersPaginationScrollRef}
            t={t}
            ti={ti}
            g={g}
            purchasedChapterIds={purchasedIds}
            onChapterSelect={onChapterSelect}
            searchInput={chapterSearchInput}
            onSearchInputChange={setChapterSearchInput}
            onSearchSubmit={handleSearch}
            order={chaptersOrder}
            onToggleOrder={toggleOrder}
        />

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
        <Dialog open={collectionDialogOpen} onOpenChange={setCollectionDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("SelectCollections")}</DialogTitle>
            </DialogHeader>
            <div className="max-h-80 space-y-3 overflow-y-auto">
              {collectionsLoading && userCollections.length === 0 ? (
                  <div className="h-24 animate-pulse rounded-2xl bg-muted" />
              ) : userCollections.length > 0 ? (
                  userCollections.map((collection) => (
                      <label key={collection.id} className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border p-3">
                        <Checkbox
                            checked={selectedCollectionIds.includes(collection.id)}
                            onCheckedChange={(checked) => {
                              setSelectedCollectionIds((prev) => checked ? [...new Set([...prev, collection.id])] : prev.filter((id) => id !== collection.id))
                            }}
                        />
                        <span className="min-w-0 flex-1 truncate font-medium">{collection.title}</span>
                        <span className="text-xs text-muted-foreground">{collection.bookCount}</span>
                      </label>
                  ))
              ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">{t("NoUserCollections")}</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCollectionDialogOpen(false)} disabled={collectionsLoading}>{g("Cancel")}</Button>
              <Button onClick={() => void saveCollectionSelection()} disabled={collectionsLoading || userCollections.length === 0}>{g("Save")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
  );
}
