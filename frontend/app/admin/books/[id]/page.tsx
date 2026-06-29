"use client"
import { getBookCoverThumbnailUrl } from "@/lib/media"
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    ArrowLeft,
    BookOpen,
    Clock,
    Edit,
    Trash,
    Plus,
    Check,
    AlertCircle,
    X,
    EyeIcon,
    Lock,
    Unlock,
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from '@/components/ui/switch';
import { Label } from "@/components/ui/label";
import { formatUpdateTime } from "@/lib/time";
import { AppPagination } from "@/components/app-pagination";
import { useParams } from "next/navigation";
import { MediaPicker } from "@/components/admin/media-picker";
import Link from "next/link";
import { useToast } from "@/providers/toast-provider";
import { useTranslations } from "next-intl";
import {useLocaleInfo} from "@/hooks/use-locale-info";
import {BookDetails, BookDetailsData, BookDetailsSkeleton} from "@/components/book-details";
import {BookEditor} from "@/components/admin/book-editor";

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

const CHAPTERS_PER_PAGE = 36;

type OptionItem = { id: number; name: string };

export default function AdminBookDetail() {
    const t = useTranslations('Books');
    const g = useTranslations('General');
    const ti = useTranslations('Time');
    const { isRTL } = useLocaleInfo()
    const toast = useToast();
    const params = useParams<{ id: string }>();
    const idParam = Array.isArray(params.id) ? params.id[0] : params.id;
    const bookId = Number(idParam);

    const [book, setBook] = useState<BookDetailsData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [newCoverPickerOpen, setNewCoverPickerOpen] = useState(false);

    const [types, setTypes] = useState<OptionItem[]>([]);
    const [genres, setGenres] = useState<OptionItem[]>([]);

    const [chapters, setChapters] = useState<ChapterItem[]>([]);
    const [chaptersPage, setChaptersPage] = useState(1);
    const chaptersPaginationScrollRef = useRef<HTMLDivElement>(null);
    const [chaptersTotal, setChaptersTotal] = useState(0);
    const [chaptersTotalPages, setChaptersTotalPages] = useState(1);
    const [chaptersLoading, setChaptersLoading] = useState(false);

    const [editMode, setEditMode] = useState(false);
    const [editedBook, setEditedBook] = useState<Partial<BookDetailsData> & { typeId?: number; genreIds?: number[] }>({});

    const [deleteBookDialog, setDeleteBookDialog] = useState(false);
    const [deleteChapterDialog, setDeleteChapterDialog] = useState<number | null>(null);

    const [chapterDialog, setChapterDialog] = useState<{
        mode: 'add' | 'edit';
        chapter?: ChapterItem;
    } | null>(null);

    const [chapterForm, setChapterForm] = useState({
        title: "",
        index: 0,
        price: 0,
        isFree: true,
    });

    const loadOptions = useCallback(async () => {
        try {
            const [typesRes, genresRes] = await Promise.all([
                apiClient.get<OptionItem[]>('/book-types'),
                apiClient.get<OptionItem[]>('/genres')
            ]);
            setTypes(typesRes);
            setGenres(genresRes);
        } catch (error) {
            console.error('Failed to load metadata options', error);
        }
    }, []);

    const loadBook = useCallback(async () => {
        if (!Number.isInteger(bookId) || bookId <= 0) {
            toast.error(t("InvalidBookLink"));
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        try {
            const data = await apiClient.get<BookDetailsData>(`/books/admin/${bookId}`);
            setBook(data);
            setEditedBook({
                ...data,
                typeId: data.type?.id,
                genreIds: data.genres?.map((g: { id: number }) => g.id) || []
            });
        } catch (error) {
            toast.error(getApiErrorMessage(error, t("FailedLoadDetails")));
        } finally {
            setIsLoading(false);
        }
    }, [bookId]);

    const loadChapters = useCallback(async () => {
        if (!bookId) return;

        setChaptersLoading(true);
        try {
            const data = await apiClient.get<ChaptersResponse>(
                `/books/${bookId}/chapters/admin?page=${chaptersPage}&limit=${CHAPTERS_PER_PAGE}`
            );
            setChapters(data.items);
            setChaptersTotal(data.pagination.total);
            setChaptersTotalPages(data.pagination.totalPages);
        } catch (error) {
            toast.error(getApiErrorMessage(error, t("FailedLoadChapters")));
        } finally {
            setChaptersLoading(false);
        }
    }, [bookId, chaptersPage]);

    useEffect(() => {
        void loadBook();
        void loadOptions();
    }, [loadBook, loadOptions]);

    useEffect(() => {
        void loadChapters();
    }, [loadChapters]);

    const handleSaveBook = async () => {
        if (!book) return;

        try {
            await apiClient.patch(`/books/${book.id}`, {
                title: editedBook.title,
                author: editedBook.author,
                description: editedBook.description,
                originalTitle: editedBook.originalTitle,
                alternativeTitles: editedBook.alternativeTitles,
                status: editedBook.status,
                ageRating: editedBook.ageRating,
                publicationYear: editedBook.publicationYear,
                translators: editedBook.translators,
                isPublished: editedBook.isPublished,
                isFeatured: editedBook.isFeatured,
                coverImage: editedBook.coverImage,
                typeId: editedBook.typeId,
                genreIds: editedBook.genreIds,
            });
            toast.success(t("BookUpdated"));
            setEditMode(false);
            await loadBook();
        } catch (error) {
            toast.error(getApiErrorMessage(error, t("BookUpdatedFailed")));
        }
    };

    const handleDeleteBook = async () => {
        if (!book) return;

        try {
            await apiClient.delete(`/books/${book.id}`);
            toast.success(t("BookDeleted"));
            setTimeout(() => {
                window.history.back();
            }, 1500);
        } catch (error) {
            toast.error(getApiErrorMessage(error, t("BookDeletedFailed")));
        }
        setDeleteBookDialog(false);
    };

    const handleDeleteChapter = async (chapterId: number) => {
        if (!book) return;

        try {
            await apiClient.delete(`/books/${book.id}/chapters/${chapterId}`);
            toast.success(t("ChapterDeleted"));
            await loadChapters();
        } catch (error) {
            toast.error(getApiErrorMessage(error, t("ChapterDeletedFailed")));
        }
        setDeleteChapterDialog(null);
    };

    const handleSaveChapter = async () => {
        if (!book) return;

        try {
            if (chapterDialog?.mode === 'add') {
                await apiClient.post(`/books/${book.id}/chapters`, {
                    ...chapterForm,
                    price: chapterForm.isFree ? undefined : (Number(chapterForm.price) || 0).toFixed(2),
                });
                toast.success(t("ChapterAdded"));
            } else if (chapterDialog?.mode === 'edit' && chapterDialog.chapter) {
                await apiClient.patch(`/books/${book.id}/chapters/${chapterDialog.chapter.id}`, {
                    ...chapterForm,
                    price: chapterForm.isFree ? undefined : (Number(chapterForm.price) || 0).toFixed(2),
                });
                toast.success(t("ChapterUpdated"));
            }
            setChapterDialog(null);
            await loadChapters();
        } catch (error) {
            toast.error(getApiErrorMessage(error, t("ChapterSaveFailed")));
        }
    };

    const openAddChapter = () => {
        setChapterForm({
            title: '',
            index: chapters.length + 1,
            price: 0,
            isFree: true,
        });
        setChapterDialog({ mode: 'add' });
    };

    const openEditChapter = (chapter: ChapterItem) => {
        setChapterForm({
            title: chapter.title,
            index: chapter.index,
            isFree: chapter.isFree,
            price: chapter.price ?? 0,
        });
        setChapterDialog({ mode: 'edit', chapter });
    };

    if (isLoading) {
        return <BookDetailsSkeleton />;
    }

    if (!book) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background p-6">
                <div className="max-w-md text-center">
                    <div className="mb-5 flex justify-center">
                        <div className="rounded-full border border-destructive/30 bg-destructive/10 p-5">
                            <AlertCircle className="h-8 w-8 text-destructive" />
                        </div>
                    </div>
                    <h2 className="mb-2 text-2xl font-semibold tracking-tight">{t("BookNotFound")}</h2>
                    <p className="text-sm text-muted-foreground">{t("BookNotFoundDescription")}</p>
                    <Button onClick={() => window.history.back()} className="mt-6">
                        <ArrowLeft className="me-2 h-4 w-4 rtl:rotate-180" />
                        {t("GoBack")}
                    </Button>
                </div>
            </div>
        );
    }

    const coverCodeForDisplay = editMode
        ? (typeof editedBook.coverImage === "string" ? editedBook.coverImage : book.coverImage)
        : book.coverImage;

    const coverUrl = coverCodeForDisplay ? getBookCoverThumbnailUrl(coverCodeForDisplay) : '/placeholder.svg';

    return (
        <div className="min-h-screen bg-background">
            {/* Sticky toolbar */}
            <div className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-md supports-backdrop-filter:bg-background/60">
                <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-10">
                    <Link
                        href="/admin/books"
                        className="group inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                        <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
                        <span className="hidden sm:inline">{t("BackToBooks")}</span>
                    </Link>

                    <div className="flex items-center gap-2">
                        {!editMode ? (
                            <>
                                <Button variant="outline" size="sm" onClick={() => setEditMode(true)}>
                                    <Edit className="h-4 w-4 sm:me-2" />
                                    <span className="hidden sm:inline">{g("Edit") || "Edit"}</span>
                                </Button>
                                <Button variant="destructive" size="sm" onClick={() => setDeleteBookDialog(true)}>
                                    <Trash className="h-4 w-4 sm:me-2" />
                                    <span className="hidden sm:inline">{t("DeleteBook")}</span>
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setEditMode(false);
                                        setEditedBook({
                                            ...book,
                                            typeId: book.type?.id,
                                            genreIds: book.genres?.map((g: { id: number }) => g.id) || [],
                                        });
                                    }}
                                >
                                    <X className="h-4 w-4 sm:me-2" />
                                    <span className="hidden sm:inline">{g("Cancel")}</span>
                                </Button>
                                <Button size="sm" onClick={handleSaveBook}>
                                    <Check className="h-4 w-4 sm:me-2" />
                                    <span className="hidden sm:inline">{t("SaveChanges")}</span>
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </div>
            <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-10">
                <BookDetails
                    book={book}
                    coverSrc={coverUrl}
                    ratingValue={Number(book.ratingAvg ?? 0)}
                    chaptersTotal={chaptersTotal}
                    hideRatingPanel={true}
                    hideFavoriteButton={true}
                    hideUpdatedAt={false}
                    hideCreatedAt={false}
                    primaryActionSlot={false}
                    t={t}
                    ti={ti}
                    editMode={editMode &&(
                        <BookEditor
                            value={editedBook}
                            onChange={setEditedBook}
                            types={types}
                            genres={genres}
                            isRTL={isRTL}
                            t={t}
                            onSelectCover={() => setNewCoverPickerOpen(true)}
                            coverAlt={book.title}
                        />
                    )}
                />

                {/* Chapters */}
                <Card ref={chaptersPaginationScrollRef} className="border-border/60 shadow-sm">
                    <div className="flex flex-col gap-3 border-b border-border/60 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                        <div className="min-w-0">
                            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{t("Chapters")}</h2>
                            <p className="mt-1 text-sm text-muted-foreground">{t("ManageAllChapters")}</p>
                        </div>
                        <Button onClick={openAddChapter} className="w-full sm:w-auto">
                            <Plus className="me-2 h-4 w-4" />
                            {t("AddChapter")}
                        </Button>
                    </div>

                    <CardContent className="space-y-6 p-4 sm:p-6">
                        {chaptersLoading ? (
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                {Array.from({ length: 8 }).map((_, i) => (
                                    <div key={i} className="animate-pulse rounded-xl border border-border/60 bg-card p-4">
                                        <div className="mb-3 flex items-start gap-3">
                                            <div className="h-10 w-10 rounded-lg bg-muted" />
                                            <div className="flex-1 space-y-2">
                                                <div className="h-4 w-full rounded bg-muted" />
                                                <div className="h-3 w-2/3 rounded bg-muted" />
                                            </div>
                                        </div>
                                        <div className="h-8 w-full rounded bg-muted" />
                                    </div>
                                ))}
                            </div>
                        ) : chapters.length === 0 ? (
                            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30 py-16 text-center">
                                <div className="mb-4 rounded-full border border-border/60 bg-background p-4">
                                    <BookOpen className="h-7 w-7 text-muted-foreground" />
                                </div>
                                <p className="text-sm font-medium">{t("NoChapters")}</p>
                                <p className="mt-1 text-xs text-muted-foreground">{t("NoChaptersDescription")}</p>
                                <Button onClick={openAddChapter} variant="outline" className="mt-5">
                                    <Plus className="me-2 h-4 w-4" />
                                    {t("AddChapter")}
                                </Button>
                            </div>
                        ) : (
                            <>
                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                    {chapters.map((chapter) => {
                                        const isFree = chapter.isFree || chapter.price == null;
                                        const priceLabel = isFree ? t("Free") : `$${Number(chapter.price).toFixed(2)}`;

                                        return (
                                            <div
                                                key={chapter.id}
                                                className="group relative flex flex-col rounded-xl border border-border/60 bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                                            >
                                                <div className="mb-3 flex items-start gap-3">
                                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted text-sm font-semibold tabular-nums text-foreground">
                                                        {chapter.index}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <h3 className="line-clamp-2 text-sm font-semibold leading-snug">
                                                            {chapter.title}
                                                        </h3>
                                                        <div className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                                            <Clock className="h-3 w-3" />
                                                            {formatUpdateTime(chapter.updatedAt, ti)}
                                                        </div>
                                                    </div>
                                                    <Badge
                                                        variant="outline"
                                                        className={
                                                            isFree
                                                                ? "shrink-0 gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                                                : "shrink-0 gap-1 border-primary/30 bg-primary/5"
                                                        }
                                                    >
                                                        {isFree ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                                                        {priceLabel}
                                                    </Badge>
                                                </div>

                                                <div className="mt-auto flex items-center justify-end gap-1 border-t border-border/60 pt-3">
                                                    <Link href={`/admin/books/${bookId}/c/${chapter.index}`}>
                                                        <button
                                                            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                                            aria-label="View"
                                                        >
                                                            <EyeIcon className="h-4 w-4" />
                                                        </button>
                                                    </Link>
                                                    <button
                                                        onClick={() => openEditChapter(chapter)}
                                                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                                        aria-label="Edit"
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => setDeleteChapterDialog(chapter.id)}
                                                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                                                        aria-label="Delete"
                                                    >
                                                        <Trash className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {chaptersTotalPages > 1 && (
                                    <div className="border-t border-border/60 pt-6">
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
                                    </div>
                                )}
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Delete book dialog */}
            <Dialog open={deleteBookDialog} onOpenChange={() => setDeleteBookDialog(false)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t("DeleteBook")}</DialogTitle>
                        <DialogDescription>
                            {t("DeleteBookDescription", { BookTitle: book.title })}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteBookDialog(false)}>
                            {g("Cancel")}
                        </Button>
                        <Button variant="destructive" onClick={handleDeleteBook}>
                            <Trash className="h-4 w-4" />
                            {t("DeleteBook")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete chapter dialog */}
            <Dialog open={deleteChapterDialog !== null} onOpenChange={() => setDeleteChapterDialog(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t("DeleteChapter")}</DialogTitle>
                        <DialogDescription>{t("DeleteChapterDescription")}</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteChapterDialog(null)}>
                            {g("Cancel")}
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => deleteChapterDialog && handleDeleteChapter(deleteChapterDialog)}
                        >
                            <Trash className="h-4 w-4" />
                            {t("DeleteChapter")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Chapter add/edit dialog */}
            <Dialog open={chapterDialog !== null} onOpenChange={() => setChapterDialog(null)}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>
                            {chapterDialog?.mode === 'add' ? t("AddNewChapter") : t("EditChapter")}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                                {t("ChapterTitle")}
                            </Label>
                            <Input
                                value={chapterForm.title}
                                onChange={(e) => setChapterForm({ ...chapterForm, title: e.target.value })}
                                placeholder={t("EnterChapterTitle")}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                                {t("ChapterIndex")}
                            </Label>
                            <Input
                                type="number"
                                min="1"
                                value={chapterForm.index}
                                onChange={(e) =>
                                    setChapterForm({ ...chapterForm, index: parseInt(e.target.value) || 1 })
                                }
                                placeholder={t("ChapterNumber")}
                            />
                        </div>

                        <label className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-card px-3 py-2.5">
                            <span className="flex items-center gap-2 text-sm">
                                <Unlock className="h-4 w-4 text-muted-foreground" />
                                {t("FreeChapter")}
                            </span>
                            <Switch
                                id="isFree"
                                checked={chapterForm.isFree}
                                onCheckedChange={(checked) => setChapterForm({ ...chapterForm, isFree: checked })}
                            />
                        </label>

                        {!chapterForm.isFree && (
                            <div className="space-y-2">
                                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                                    {t("Price", { CurrencySymbols: (g("CurrencySymbols") + g("CurrencyName")) })}
                                </Label>
                                <Input
                                    type="text"
                                    value={chapterForm.price}
                                    onChange={(e) => setChapterForm({ ...chapterForm, price: Number(e.target.value) })}
                                    placeholder="0.00"
                                />
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setChapterDialog(null)}>
                            {g("Cancel")}
                        </Button>
                        <Button onClick={handleSaveChapter}>
                            <Check className="h-4 w-4" />
                            {chapterDialog?.mode === 'add' ? t("AddChapter") : t("SaveChanges")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <MediaPicker
                open={newCoverPickerOpen}
                onOpenChangeAction={setNewCoverPickerOpen}
                value={coverCodeForDisplay || null}
                onSelectAction={(item: { code?: string } | null) => {
                    setEditedBook((prev) => ({
                        ...prev,
                        coverImage: item?.code ?? "",
                    }));
                }}
            />
        </div>
    );
}
