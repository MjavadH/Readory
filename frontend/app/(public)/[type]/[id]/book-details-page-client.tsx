'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookCard } from '@/components/book-card';
import { BookDetails, type BookDetailsData } from '@/components/book-details';
import { ChapterPurchaseDialog } from '@/components/chapter-purchase-dialog';
import { ChaptersSection, type ChaptersSectionChapter } from '@/components/chapters-section';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ApiError, apiClient, getApiErrorMessage } from '@/lib/api-client';
import type { Collection } from '@/lib/collection-types';

import { getBookCoverThumbnailUrl } from '@/lib/media';
import { type BookCardData, getBookUrl } from '@/lib/types';
import { useToast } from '@/providers/toast-provider';

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

type ActionChapter = ChaptersSectionChapter & { mode: 'purchase' | 'access' };

const CHAPTERS_PER_PAGE = 36;

export type BookDetailsPageClientProps = {
  initialBook: BookDetailsData;
  initialChapters: ChaptersSectionChapter[];
  initialChaptersTotal: number;
  initialChaptersTotalPages: number;
  initialRelatedBooks: BookCardData[];
};

export function BookDetailsPageClient({
  initialBook,
  initialChapters,
  initialChaptersTotal,
  initialChaptersTotalPages,
  initialRelatedBooks,
}: BookDetailsPageClientProps) {
  const t = useTranslations('Books');
  const g = useTranslations('General');
  const ti = useTranslations('Time');
  const toast = useToast();
  const router = useRouter();

  const book = initialBook;
  const bookId = book.id;

  const [viewer, setViewer] = useState<ViewerState | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const [selectedRating, setSelectedRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [isRatingPending, setIsRatingPending] = useState(false);

  const [isFavorited, setIsFavorited] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [collectionDialogOpen, setCollectionDialogOpen] = useState(false);
  const [userCollections, setUserCollections] = useState<
    Array<Collection & { containsBook?: boolean }>
  >([]);
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<number[]>([]);
  const [collectionsLoading, setCollectionsLoading] = useState(false);

  const [bookMeta, setBookMeta] = useState({
    ratingAvg: book.ratingAvg,
    ratingCount: book.ratingCount,
  });

  const [chapters, setChapters] = useState<ChaptersSectionChapter[]>(initialChapters);
  const [chaptersPage, setChaptersPage] = useState(1);
  const chaptersPaginationScrollRef = useRef<HTMLDivElement>(null);
  const [chaptersTotal, setChaptersTotal] = useState(initialChaptersTotal);
  const [chaptersTotalPages, setChaptersTotalPages] = useState(initialChaptersTotalPages);
  const [chapterSearch, setChapterSearch] = useState('');
  const [chapterSearchInput, setChapterSearchInput] = useState('');
  const [chaptersOrder, setChaptersOrder] = useState<'asc' | 'desc'>('asc');
  const [chaptersLoading, setChaptersLoading] = useState(false);
  const isFirstChaptersRun = useRef(true);

  const [relatedBooks] = useState<BookCardData[]>(initialRelatedBooks);
  const [actionChapter, setActionChapter] = useState<ActionChapter | null>(null);

  const purchasedIds = useMemo(
    () => viewer?.purchasedChapterIds ?? [],
    [viewer?.purchasedChapterIds],
  );

  // Auth + viewer-specific state (favorites, purchases, my rating). Public
  // book/chapters/related data was already rendered server-side.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const profile = await apiClient.get('/auth/profile').catch(() => null);
        if (cancelled) return;

        if (profile) {
          setIsAuthenticated(true);
          const viewerState = await apiClient.get<ViewerState>(`/books/${bookId}/viewer-state`);
          if (cancelled) return;
          setViewer(viewerState);
          setSelectedRating(viewerState.myRating ?? 0);
          setIsFavorited(viewerState.isFavorited);
        } else {
          setIsAuthenticated(false);
        }
      } catch (loadError: unknown) {
        if (loadError instanceof ApiError && !cancelled) {
          toast.error(getApiErrorMessage(loadError, t('FailedLoadDetails')));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bookId, t, toast]);

  // Chapters: skip the very first run since page 1 (default search/order)
  // was already fetched server-side and passed in via props.
  useEffect(() => {
    if (isFirstChaptersRun.current) {
      isFirstChaptersRun.current = false;
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const data = await apiClient.get<ChaptersResponse>(
          `/books/${bookId}/chapters?page=${chaptersPage}&limit=${CHAPTERS_PER_PAGE}&q=${encodeURIComponent(
            chapterSearch,
          )}&order=${chaptersOrder}&publishStatus=PUBLISHED`,
        );

        if (cancelled) return;

        setChapters(data.items);
        setChaptersTotal(data.pagination.total);
        setChaptersTotalPages(data.pagination.totalPages);
      } catch (chapterError) {
        if (!cancelled) {
          toast.error(getApiErrorMessage(chapterError, t('FailedLoadChapters')));
        }
      } finally {
        if (!cancelled) {
          setChaptersLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bookId, chapterSearch, chaptersPage, chaptersOrder, t, toast]);

  const handleSelectRating = (rating: number) => setSelectedRating(rating);

  const handleSubmitRating = async () => {
    if (!isAuthenticated || selectedRating === 0) {
      toast.error(t('SelectRating'));
      return;
    }

    setIsRatingPending(true);
    try {
      const updated = await apiClient.put<{
        ratingAvg: number;
        ratingCount: number;
        rating: number;
      }>(`/books/${book.id}/rating`, { rating: selectedRating });

      setBookMeta({ ratingAvg: updated.ratingAvg, ratingCount: updated.ratingCount });
      toast.success(t('RatingSaved'));
    } catch (rateError) {
      toast.error(getApiErrorMessage(rateError, t('UnableSaveRating')));
    } finally {
      setIsRatingPending(false);
    }
  };

  const openCollectionDialog = async () => {
    if (!isAuthenticated) {
      toast.error(t('OnlyRegisteredUsers'));
      return;
    }

    setCollectionDialogOpen(true);
    setCollectionsLoading(true);
    try {
      const res = await apiClient.get<{ items: Array<Collection & { containsBook?: boolean }> }>(
        `/collections/mine?limit=48&bookId=${book.id}`,
      );
      const items = res.items ?? [];
      setUserCollections(items);
      setSelectedCollectionIds(
        items.filter((collection) => collection.containsBook).map((collection) => collection.id),
      );
    } catch (err) {
      toast.error(getApiErrorMessage(err, t('FailedLoadDetails')));
    } finally {
      setCollectionsLoading(false);
    }
  };

  const saveCollectionSelection = async () => {
    setCollectionsLoading(true);
    try {
      const existingIds = new Set(
        userCollections
          .filter((collection) => collection.containsBook)
          .map((collection) => collection.id),
      );
      const idsToAdd = selectedCollectionIds.filter((id) => !existingIds.has(id));
      await Promise.all(
        idsToAdd.map((id) => apiClient.post(`/collections/${id}/items`, { bookId: book.id })),
      );
      toast.success(t('AddedToCollections'));
      setCollectionDialogOpen(false);
    } catch (err) {
      toast.error(getApiErrorMessage(err, t('UnableSaveRating')));
    } finally {
      setCollectionsLoading(false);
    }
  };

  const handleToggleFavorite = async () => {
    setFavoriteLoading(true);
    try {
      const res: { favorited: boolean } = await apiClient.post(`/books/${book.id}/favorite`);
      setIsFavorited(res.favorited);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setFavoriteLoading(false);
    }
  };

  const onChapterSelect = (chapter: ChaptersSectionChapter) => {
    if (!isAuthenticated) {
      toast.error(t('OnlyRegisteredUsers'));
      return;
    }

    const alreadyPurchased = new Set(purchasedIds).has(chapter.id);
    if (alreadyPurchased) {
      router.push(`${getBookUrl(book)}/c/${chapter.index}`);
      return;
    }

    setActionChapter({
      ...chapter,
      mode: chapter.isFree || chapter.price == null ? 'access' : 'purchase',
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
    setChaptersLoading(true);
    setChaptersPage(1);
    setChapterSearch(chapterSearchInput.trim());
  };

  const toggleOrder = () => {
    setChaptersLoading(true);
    setChaptersOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    setChaptersPage(1);
  };

  const ratingValue = Number(bookMeta.ratingAvg ?? 0);
  const coverSrc = book.coverImage ? getBookCoverThumbnailUrl(book.coverImage) : '/placeholder.svg';

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 px-4 py-6 sm:px-6 lg:space-y-12 lg:px-8 lg:py-10">
      {/* Book Details */}
      <BookDetails
        book={{ ...book, ratingAvg: bookMeta.ratingAvg, ratingCount: bookMeta.ratingCount }}
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
        onPageChange={(page) => {
          setChaptersLoading(true);
          setChaptersPage(page);
        }}
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
              <h2 className="text-xl font-bold sm:text-2xl">{t('SimilarBooks')}</h2>
              <p className="text-sm text-muted-foreground">{t('MayLike')}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {relatedBooks.map((relatedBook) => (
              <BookCard key={relatedBook.id} book={relatedBook} />
            ))}
          </div>
        </section>
      )}

      {actionChapter && (
        <ChapterPurchaseDialog
          book={book}
          chapter={actionChapter}
          onPurchased={handlePurchased}
          onClose={() => setActionChapter(null)}
        />
      )}
      <Dialog open={collectionDialogOpen} onOpenChange={setCollectionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('SelectCollections')}</DialogTitle>
          </DialogHeader>
          <div className="max-h-80 space-y-3 overflow-y-auto">
            {collectionsLoading && userCollections.length === 0 ? (
              <div className="h-24 animate-pulse rounded-2xl bg-muted" />
            ) : userCollections.length > 0 ? (
              userCollections.map((collection) => (
                <div
                  key={collection.id}
                  className="flex items-center gap-3 rounded-2xl border border-border p-3"
                >
                  <Checkbox
                    id={`collection-${collection.id}`}
                    checked={selectedCollectionIds.includes(collection.id)}
                    onCheckedChange={(checked) => {
                      setSelectedCollectionIds((prev) =>
                        checked
                          ? [...new Set([...prev, collection.id])]
                          : prev.filter((id) => id !== collection.id),
                      );
                    }}
                  />
                  <label
                    htmlFor={`collection-${collection.id}`}
                    className="min-w-0 flex-1 cursor-pointer truncate font-medium"
                  >
                    {collection.title}
                  </label>
                  <span className="text-xs text-muted-foreground">{collection.bookCount}</span>
                </div>
              ))
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t('NoUserCollections')}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCollectionDialogOpen(false)}
              disabled={collectionsLoading}
            >
              {g('Cancel')}
            </Button>
            <Button
              onClick={() => void saveCollectionSelection()}
              disabled={collectionsLoading || userCollections.length === 0}
            >
              {g('Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default BookDetailsPageClient;
