'use client';
import { type AgeRating, BookStatus, PublicationStatus } from '@readory/shared';
import { BookOpen, CheckCircle2, Clock, Plus, Search, Star, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import AdminPageHeader from '@/components/admin/admin-page-header';
import { BookEditor } from '@/components/admin/book-editor';
import type { BookContributorEntry } from '@/components/admin/contributors/contributors-field';
import { MediaPicker } from '@/components/admin/media-picker';
import { StatCard } from '@/components/admin/stat-card';
import { AppPagination } from '@/components/app-pagination';
import { BookCard } from '@/components/book-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLocaleInfo } from '@/hooks/use-locale-info';
import { apiClient, getApiErrorMessage } from '@/lib/api-client';
import type { BookCardData, BookGenre, BookType } from '@/lib/types';
import { useToast } from '@/providers/toast-provider';

type StatusFilter = 'all' | 'published' | 'draft' | 'featured';

type Genre = {
  id: number;
  name: string;
  slug: string;
};

interface BookStats {
  total: number;
  Published: number;
  Drafts: number;
  Featured: number;
}

interface AdminApiBook {
  id: number;
  title: string;
  originalTitle?: string | null;
  alternativeTitles?: string[];
  contributors: string | null;
  coverImage: string;
  publishStatus?: PublicationStatus;
  isFeatured?: boolean;
  status?: BookStatus;
  ageRating?: AgeRating | null;
  publicationYear?: number | null;
  chapterCount?: number;
  lastContentUpdate?: string | null;
  ratingAvg?: number;
  ratingCount?: number;
  updatedAt?: string;
  genres?: Array<{ genre: BookGenre }>;
  type?: { name: string };
}

const ITEMS_PER_PAGE = 24;

type NewBookForm = {
  title: string;
  originalTitle: string;
  alternativeTitles: string[];
  contributors: BookContributorEntry[];
  typeId: number | undefined;
  description: string;
  coverImage: string;
  genreIds: number[];
  publishStatus: PublicationStatus;
  isFeatured: boolean;
  status: BookStatus;
  ageRating: AgeRating | undefined;
  publicationYear: number | null;
};

export default function AdminBooks() {
  const t = useTranslations('Books');
  const g = useTranslations('General');
  const toast = useToast();
  const { isRTL } = useLocaleInfo();
  const [books, setBooks] = useState<BookCardData[]>([]);
  const [stats, setStats] = useState<BookStats>({
    total: 0,
    Published: 0,
    Drafts: 0,
    Featured: 0,
  });
  const [newCoverPickerOpen, setNewCoverPickerOpen] = useState(false);
  const [, setNewCoverLabel] = useState<string>('');
  const [genres, setGenres] = useState<Genre[]>([]);
  const [bookTypes, setBookTypes] = useState<BookType[]>([]);
  const [, setIsLoadingTypes] = useState(true);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const paginationScrollRef = useRef<HTMLDivElement>(null);
  const totalPages = Math.ceil(stats.total / ITEMS_PER_PAGE);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddCard, setShowAddCard] = useState(false);

  const [newBook, setNewBook] = useState<NewBookForm>({
    title: '',
    originalTitle: '',
    alternativeTitles: [] as string[],
    contributors: [] as BookContributorEntry[],
    typeId: undefined as number | undefined,
    description: '',
    coverImage: '',
    genreIds: [] as number[],
    publishStatus: PublicationStatus.DRAFT,
    isFeatured: false,
    status: BookStatus.Upcoming,
    ageRating: undefined as AgeRating | undefined,
    publicationYear: null as number | null,
  });

  const fetchGenres = useCallback(async (): Promise<Genre[]> => {
    try {
      const data = await apiClient.get<Genre[]>('/genres');
      return Array.isArray(data) ? data : [];
    } catch {
      toast.error(t('ErrorFetchingGenres'));
      return [];
    }
  }, [toast, t]);

  const fetchTypes = useCallback(async (): Promise<BookType[]> => {
    try {
      const data = await apiClient.get<BookType[]>('/book-types');
      return Array.isArray(data) ? data : [];
    } catch {
      toast.error(t('ErrorFetchingTypes'));
      return [];
    }
  }, [toast, t]);

  useEffect(() => {
    let cancelled = false;

    void Promise.all([fetchGenres(), fetchTypes()])
      .then(([genresData, typesData]) => {
        if (cancelled) return;

        setGenres(genresData);
        setBookTypes(typesData);
        setNewBook((prev) => ({
          ...prev,
          typeId: prev.typeId ?? typesData[0]?.id,
        }));
        setIsLoadingTypes(false);
      })
      .catch(() => {
        if (cancelled) return;
        setGenres([]);
        setBookTypes([]);
        setIsLoadingTypes(false);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fetchGenres, fetchTypes]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(searchQuery.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const requestBooks = useCallback(async () => {
    const qs = new URLSearchParams({
      page: String(page),
      limit: String(ITEMS_PER_PAGE),
      status: statusFilter,
    });

    if (debouncedQ.length >= 2) {
      qs.set('q', debouncedQ);
    }

    return apiClient.get<{
      books: AdminApiBook[];
      stats?: BookStats;
    }>(`/books/allBooks?${qs.toString()}`);
  }, [page, statusFilter, debouncedQ]);

  const transformBooks = (items: AdminApiBook[]): BookCardData[] =>
    items.map((book) => ({
      id: book.id,
      title: book.title,
      originalTitle: book.originalTitle,
      alternativeTitles: book.alternativeTitles,
      coverImage: book.coverImage || '',
      type: book.type as BookType,
      contributors: book.contributors ?? undefined,
      ratingAvg: book.ratingAvg,
      ratingCount: book.ratingCount,
      genres: book.genres?.map((g) => g.genre) || [],
      isFeatured: book.isFeatured,
      publishStatus: book.publishStatus,
      status: book.status,
      ageRating: book.ageRating,
      publicationYear: book.publicationYear,
      chapterCount: book.chapterCount || 0,
      lastContentUpdate: book.lastContentUpdate,
      updatedAt: book.updatedAt,
    }));

  useEffect(() => {
    let cancelled = false;

    void requestBooks()
      .then((data) => {
        if (cancelled) return;

        setBooks(transformBooks(data.books ?? []));

        if (data.stats) {
          setStats(data.stats);
        }
      })
      .catch(() => {
        if (cancelled) return;

        toast.error(t('ErrorFetchingBooks'));
        setBooks([]);
      });

    return () => {
      cancelled = true;
    };
  }, [requestBooks, toast, t]);

  const handleAddBook = async () => {
    if (!newBook.title.trim()) {
      return toast.error(t('TitleRequired'), t('Validation Error'));
    }

    if (newBook.genreIds.length === 0) {
      return toast.error(t('SelectOneGenre'), t('Validation Error'));
    }

    if (newBook.typeId == null) {
      return toast.error(t('BookTypeRequired'), t('Validation Error'));
    }

    setIsSubmitting(true);

    try {
      await apiClient.post('/books', {
        ...newBook,
        publicationYear: newBook.publicationYear ?? undefined,
        genreIds: newBook.genreIds,
        contributors: newBook.contributors.map(({ contributorId, role }) => ({
          contributorId,
          role,
        })),
      });

      const data = await requestBooks();

      setBooks(transformBooks(data.books ?? []));

      if (data.stats) {
        setStats(data.stats);
      }

      setShowAddCard(false);

      setNewBook({
        title: '',
        originalTitle: '',
        alternativeTitles: [],
        contributors: [],
        typeId: bookTypes[0]?.id,
        description: '',
        coverImage: '',
        genreIds: [],
        publishStatus: PublicationStatus.DRAFT,
        isFeatured: false,
        status: BookStatus.Upcoming,
        ageRating: undefined,
        publicationYear: null,
      });

      setNewCoverLabel('');
      toast.success(t('BookCreatedSuccessfully'));
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, t('ErrorFetchingBooks')));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelAdd = () => {
    setShowAddCard(false);
    setNewBook({
      title: '',
      originalTitle: '',
      alternativeTitles: [] as string[],
      contributors: [] as BookContributorEntry[],
      typeId: bookTypes[0]?.id,
      description: '',
      coverImage: '',
      genreIds: [],
      publishStatus: PublicationStatus.DRAFT,
      isFeatured: false,
      status: BookStatus.Upcoming,
      ageRating: undefined,
      publicationYear: null as number | null,
    });
    setNewCoverLabel('');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-muted/30 via-background to-muted/20">
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-400 mx-auto">
          <div className="space-y-2 p-3 md:p-0">
            <div className="h-8 w-72 rounded-lg bg-muted animate-pulse" />
            <div className="h-4 w-48 rounded-md bg-muted animate-pulse" />
          </div>
          <div className="animate-pulse space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="h-32 bg-muted rounded-xl" />
              <div className="h-32 bg-muted rounded-xl" />
              <div className="h-32 bg-muted rounded-xl" />
            </div>
            <div className="flex gap-4 md:grid-cols-2">
              <div className="h-10 bg-muted rounded-xl w-4/5" />
              <div className="h-10 bg-muted rounded-xl w-1/5" />
            </div>
            <div className="h-96 bg-muted rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-muted/30 via-background to-muted/20 pb-20 sm:pb-0">
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-400 mx-auto">
        <AdminPageHeader icon={BookOpen} title={t('Title')} description={t('Description')} />

        <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            index={0}
            title={t('TotalBooks')}
            value={stats.total.toLocaleString()}
            icon={BookOpen}
            accent="primary"
          />
          <StatCard
            index={1}
            title={t('Published')}
            value={stats.Published.toLocaleString()}
            icon={CheckCircle2}
            accent="emerald"
          />
          <StatCard
            index={2}
            title={t('Drafts')}
            value={stats.Drafts.toLocaleString()}
            icon={Clock}
            accent="orange"
          />
          <StatCard
            index={3}
            title={t('Featured')}
            value={stats.Featured.toLocaleString()}
            icon={Star}
            accent="yellow"
          />
        </div>

        {showAddCard ? (
          <Card className="relative border-border/60 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="text-xl">{t('AddNewBook')}</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancelAdd}
                disabled={isSubmitting}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="p-5 z-10 sm:p-8">
              <BookEditor
                value={newBook}
                onChange={(value) =>
                  setNewBook({
                    ...newBook,
                    ...value,
                    title: value.title || '',
                    originalTitle: value.originalTitle || '',
                    contributors: value.contributors || [],
                    description: value.description || '',
                    coverImage: value.coverImage || '',
                    typeId: value.typeId,
                    genreIds: value.genreIds || [],
                    alternativeTitles: value.alternativeTitles || [],
                    publicationYear: value.publicationYear ?? null,
                    ageRating: value.ageRating ?? undefined,
                  })
                }
                types={bookTypes}
                genres={genres}
                isRTL={isRTL}
                t={t}
                onSelectCover={() => setNewCoverPickerOpen(true)}
                coverAlt={newBook.title || t('AddNewBook')}
              />
              <div className="flex gap-3 pt-5">
                <Button
                  variant="outline"
                  onClick={handleCancelAdd}
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  {g('Cancel')}
                </Button>
                <Button
                  onClick={handleAddBook}
                  disabled={isSubmitting || bookTypes.length === 0 || newBook.typeId == null}
                  className="flex-1"
                >
                  {isSubmitting ? t('CreatingBook') : t('CreateBook')}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card
            className="border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 transition-colors cursor-pointer group"
            onClick={() => setShowAddCard(true)}
          >
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <Plus className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-1">{t('AddNewBook')}</h3>
              <p className="text-sm text-muted-foreground">{t('ClickToCreate')}</p>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div className="relative flex-1">
            <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder={t('SearchByTitle')}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
                setLoading(true);
              }}
              className="ps-10 h-11 shadow-sm"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(value: StatusFilter) => {
              setStatusFilter(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-50 h-11 shadow-sm">
              <SelectValue placeholder={t('FilterByStatus')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('AllBooks')}</SelectItem>
              <SelectItem value="published">{t('PublishedOnly')}</SelectItem>
              <SelectItem value="draft">{t('DraftsOnly')}</SelectItem>
              <SelectItem value="featured">{t('FeaturedOnly')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {books.length === 0 ? (
          <Card className="py-16 sm:py-20 border-none shadow-lg bg-linear-to-br from-card to-muted/20">
            <CardContent className="flex flex-col items-center justify-center text-center px-4">
              <div className="size-16 sm:size-20 rounded-2xl bg-muted/50 flex items-center justify-center mb-4 sm:mb-6">
                <BookOpen className="w-8 h-8 sm:w-10 sm:h-10 text-muted-foreground" />
              </div>
              <h3 className="text-lg sm:text-xl font-semibold mb-2">{t('NoBooksFound')}</h3>
              <p className="text-sm sm:text-base text-muted-foreground mb-6 max-w-md">
                {stats.total === 0 ? t('GetStarted') : t('AdjustingFilter')}
              </p>
              {stats.total === 0 && (
                <Button size="lg" onClick={() => setShowAddCard(true)} className="shadow-lg">
                  <Plus className="w-4 h-4 me-2" />
                  {t('AddFirstBook')}
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div
            ref={paginationScrollRef}
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
          >
            {books.map((book) => (
              <BookCard key={book.id} book={book} link={`/admin/books/${book.id}`} />
            ))}
          </div>
        )}

        {books.length > 0 && (
          <AppPagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={stats.total}
            pageSize={ITEMS_PER_PAGE}
            itemLabel={t('Title')}
            onPageChange={setPage}
            canGoPrevious={page > 1}
            canGoNext={page < totalPages}
            scrollTarget={paginationScrollRef}
          />
        )}

        <MediaPicker
          open={newCoverPickerOpen}
          onOpenChangeAction={setNewCoverPickerOpen}
          value={newBook.coverImage || null}
          onSelectAction={(item) => {
            setNewBook((p) => ({ ...p, coverImage: item?.code ?? '' }));
            setNewCoverLabel(item?.filename ?? '');
          }}
        />
      </div>
    </div>
  );
}
