"use client"
import { getBookCoverThumbnailUrl } from "@/lib/media"
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    ArrowLeft,
    BookOpen,
    Clock,
    Star,
    User,
    Edit,
    Trash,
    Plus,
    Check,
    AlertCircle,
    X,
    Eye,
    EyeOff,
    Sparkles,
    ImageIcon,
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
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from "@/components/ui/label";
import { formatUpdateTime } from "@/lib/time";
import { AppPagination } from "@/components/app-pagination";
import { AGE_RATING_VALUES, BOOK_STATUS_VALUES, BookStatus, type AgeRating, type IconKey } from "@readory/shared";
import { useParams } from "next/navigation";
import Image from "next/image";
import { MediaPicker } from "@/components/admin/media-picker";
import Link from "next/link";
import { AppIcon } from "@/components/AppIcon";
import { useToast } from "@/providers/toast-provider";
import { useTranslations } from "next-intl";

type BookDetails = {
    id: number;
    title: string;
    originalTitle?: string | null;
    alternativeTitles: string[];
    author?: string | null;
    description?: string | null;
    coverImage: string;
    isFeatured: boolean;
    isPublished: boolean;
    status: BookStatus;
    ageRating?: AgeRating | null;
    publicationYear?: number | null;
    translators: string[];
    chapterCount: number;
    lastContentUpdate?: string | null;
    ratingAvg: number;
    ratingCount: number;
    updatedAt: string;
    createdAt: string;
    type: { id: number; name: string; slug: string; iconKey: IconKey };
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

const CHAPTERS_PER_PAGE = 36;

type OptionItem = { id: number; name: string };

function LoadingSkeleton() {
    return (
        <div className="min-h-screen bg-background">
            <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-10">
                <div className="h-10 w-40 animate-pulse rounded-md bg-muted" />
                <Card className="overflow-hidden border-border/60">
                    <CardContent className="p-6 sm:p-8">
                        <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
                            <div className="aspect-2/3 w-full animate-pulse rounded-xl bg-muted" />
                            <div className="space-y-4">
                                <div className="h-5 w-20 rounded-full bg-muted" />
                                <div className="h-8 w-3/4 animate-pulse rounded-md bg-muted" />
                                <div className="h-5 w-1/3 animate-pulse rounded-md bg-muted" />
                                <div className="space-y-2 pt-4">
                                    <div className="h-4 w-full animate-pulse rounded bg-muted" />
                                    <div className="h-4 w-full animate-pulse rounded bg-muted" />
                                    <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                                </div>
                                <div className="grid gap-3 pt-4 sm:grid-cols-3">
                                    <div className="h-20 animate-pulse rounded-xl bg-muted" />
                                    <div className="h-20 animate-pulse rounded-xl bg-muted" />
                                    <div className="h-20 animate-pulse rounded-xl bg-muted" />
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

export default function AdminBookDetail() {
    const t = useTranslations('Books');
    const g = useTranslations('General');
    const ti = useTranslations('Time');
    const toast = useToast();
    const params = useParams<{ id: string }>();
    const idParam = Array.isArray(params.id) ? params.id[0] : params.id;
    const bookId = Number(idParam);

    const [book, setBook] = useState<BookDetails | null>(null);
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
    const [editedBook, setEditedBook] = useState<Partial<BookDetails> & { typeId?: number; genreIds?: number[] }>({});

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
            const data = await apiClient.get<BookDetails>(`/books/admin/${bookId}`);
            setBook(data);
            setEditedBook({
                ...data,
                typeId: data.type?.id,
                genreIds: data.genres?.map(g => g.id) || []
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
        return <LoadingSkeleton />;
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
                                            genreIds: book.genres?.map(g => g.id) || [],
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
                {/* Hero card */}
                <Card className="relative border-border/60 shadow-sm">
                    {/* Ambient cover backdrop */}
                    <div className="absolute inset-x-0 top-0 h-56 overflow-hidden sm:h-72">
                        <Image
                            src={coverUrl}
                            alt=""
                            fill
                            aria-hidden
                            className="scale-110 object-cover opacity-40 blur-2xl"
                            sizes="100vw"
                            priority
                        />
                        <div className="absolute inset-0 bg-linear-to-b from-background/30 via-background/70 to-card" />
                    </div>

                    <CardContent className="p-5 z-10 sm:p-8">
                        <div className="grid gap-6 sm:gap-8 lg:grid-cols-[240px_1fr]">
                            {/* Cover */}
                            <div className="mx-auto w-40 self-start sm:w-52 lg:sticky lg:top-20 lg:w-full">
                                <div className="group relative overflow-hidden rounded-xl border border-border/60 bg-muted shadow-xl ring-1 ring-black/5 dark:ring-white/5">
                                    <div className="aspect-2/3 w-full">
                                        <Image
                                            src={coverUrl}
                                            alt={book.title}
                                            width={480}
                                            height={720}
                                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                            sizes="(max-width: 640px) 70vw, 240px"
                                            priority
                                        />
                                    </div>
                                </div>
                                {editMode && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="mt-3 w-full"
                                        onClick={() => setNewCoverPickerOpen(true)}
                                    >
                                        <ImageIcon className="me-2 h-4 w-4" />
                                        {t("BookSelectCover")}
                                    </Button>
                                )}
                            </div>

                            {/* Meta */}
                            <div className="min-w-0 space-y-5">
                                {/* Status pills */}
                                {!editMode && (
                                    <div className="flex flex-wrap items-center gap-2">
                                        {book.isPublished ? (
                                            <Badge className="gap-1.5 border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300">
                                                <Eye className="h-3.5 w-3.5" />
                                                {t("Published")}
                                            </Badge>
                                        ) : (
                                            <Badge variant="secondary" className="gap-1.5">
                                                <EyeOff className="h-3.5 w-3.5" />
                                                {t("Drafts")}
                                            </Badge>
                                        )}
                                        {book.isFeatured && (
                                            <Badge className="gap-1.5 border border-amber-500/30 bg-amber-500/10 text-amber-700 hover:bg-amber-500/15 dark:text-amber-300">
                                                <Sparkles className="h-3.5 w-3.5" />
                                                {t("Featured")}
                                            </Badge>
                                        )}
                                    </div>
                                )}

                                {/* Title */}
                                {editMode ? (
                                    <div className="space-y-2">
                                        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                                            {t("BookTitlePlaceholder")}
                                        </Label>
                                        <Input
                                            value={editedBook.title || ''}
                                            onChange={(e) => setEditedBook({ ...editedBook, title: e.target.value })}
                                            className="h-12 text-lg font-semibold"
                                            placeholder={t("BookTitlePlaceholder")}
                                        />
                                    </div>
                                ) : (
                                    <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
                                        {book.title}
                                    </h1>
                                )}

                                {editMode && (
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                                                {t("OriginalTitle")}
                                            </Label>
                                            <Input
                                                value={editedBook.originalTitle || ''}
                                                onChange={(e) => setEditedBook({ ...editedBook, originalTitle: e.target.value })}
                                                placeholder={t("OriginalTitlePlaceholder")}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                                                {t("PublicationYear")}
                                            </Label>
                                            <Input
                                                value={editedBook.publicationYear ?? ''}
                                                onChange={(e) => setEditedBook({ ...editedBook, publicationYear: e.target.value ? Number(e.target.value) : null })}
                                                placeholder={t("PublicationYearPlaceholder")}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                                                {t("AlternativeTitles")}
                                            </Label>
                                            <Input
                                                value={(editedBook.alternativeTitles || []).join(', ')}
                                                onChange={(e) => setEditedBook({ ...editedBook, alternativeTitles: e.target.value.split(',').map((item) => item.trim()).filter(Boolean) })}
                                                placeholder={t("AlternativeTitlesPlaceholder")}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                                                {t("Translators")}
                                            </Label>
                                            <Input
                                                value={(editedBook.translators || []).join(', ')}
                                                onChange={(e) => setEditedBook({ ...editedBook, translators: e.target.value.split(',').map((item) => item.trim()).filter(Boolean) })}
                                                placeholder={t("TranslatorsPlaceholder")}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Author */}
                                {editMode ? (
                                    <div className="space-y-2">
                                        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                                            {t("BookAuthorPlaceholder")}
                                        </Label>
                                        <Input
                                            value={editedBook.author || ''}
                                            onChange={(e) => setEditedBook({ ...editedBook, author: e.target.value })}
                                            placeholder={t("BookAuthorPlaceholder")}
                                        />
                                    </div>
                                ) : (
                                    <div className="inline-flex items-center gap-2 text-muted-foreground">
                                        <User className="h-4 w-4" />
                                        <span className="text-sm font-medium">{book.author || t("Unknown")}</span>
                                    </div>
                                )}


                                    {!editMode && (
                                        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                                            <Badge variant="outline">{t(`BookStatus_${book.status}`)}</Badge>
                                            {book.ageRating && <Badge variant="outline">{t(`AgeRating_${book.ageRating}`)}</Badge>}
                                            {book.publicationYear && <Badge variant="outline">{book.publicationYear}</Badge>}
                                            {book.originalTitle && <Badge variant="outline">{book.originalTitle}</Badge>}
                                        </div>
                                    )}

                                {/* Type + genres (view) */}
                                {!editMode && (
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Badge variant="outline" className="gap-1.5 border-primary/30 bg-primary/5 text-foreground">
                                            <AppIcon name={book.type.iconKey} className="h-3.5 w-3.5" />
                                            {book.type.name}
                                        </Badge>
                                        {book.genres.map((genre) => (
                                            <Badge key={genre.id} variant="outline" className="gap-1.5">
                                                <AppIcon name={genre.iconKey} className="h-3.5 w-3.5" />
                                                {genre.name}
                                            </Badge>
                                        ))}
                                    </div>
                                )}

                                {/* Edit: type/genres/flags */}
                                {editMode && (
                                    <div className="space-y-4 rounded-xl border border-border/60 bg-card/50 p-4">
                                        <div className="grid gap-4 sm:grid-cols-2">
                                            <div className="space-y-2">
                                                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                                                    {t("BookType")}
                                                </Label>
                                                <select
                                                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                                    value={editedBook.typeId || ''}
                                                    onChange={(e) => setEditedBook({ ...editedBook, typeId: Number(e.target.value) })}
                                                >
                                                    {types.map((tp) => (
                                                        <option key={tp.id} value={tp.id}>{tp.name}</option>
                                                    ))}
                                                </select>
                                            </div>


                                            <div className="space-y-2">
                                                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                                                    {t("BookStatus")}
                                                </Label>
                                                <select
                                                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                                    value={editedBook.status || BookStatus.Upcoming}
                                                    onChange={(e) => setEditedBook({ ...editedBook, status: e.target.value as BookStatus })}
                                                >
                                                    {BOOK_STATUS_VALUES.map((value) => (
                                                        <option key={value} value={value}>{t(`BookStatus_${value}`)}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                                                    {t("AgeRating")}
                                                </Label>
                                                <select
                                                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                                    value={editedBook.ageRating || ''}
                                                    onChange={(e) => setEditedBook({ ...editedBook, ageRating: e.target.value ? e.target.value as AgeRating : null })}
                                                >
                                                    <option value="">{t("None")}</option>
                                                    {AGE_RATING_VALUES.map((value) => (
                                                        <option key={value} value={value}>{t(`AgeRating_${value}`)}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="grid grid-cols-1 gap-3">
                                                <label className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background px-3 py-2">
                                                    <span className="flex items-center gap-2 text-sm">
                                                        <Eye className="h-4 w-4 text-muted-foreground" />
                                                        {t("Published")}
                                                    </span>
                                                    <Switch
                                                        id="isPublished"
                                                        checked={editedBook.isPublished ?? false}
                                                        onCheckedChange={(checked) =>
                                                            setEditedBook({ ...editedBook, isPublished: checked })
                                                        }
                                                    />
                                                </label>
                                                <label className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background px-3 py-2">
                                                    <span className="flex items-center gap-2 text-sm">
                                                        <Sparkles className="h-4 w-4 text-muted-foreground" />
                                                        {t("MarkFeatured")}
                                                    </span>
                                                    <Switch
                                                        id="isFeatured"
                                                        checked={editedBook.isFeatured ?? false}
                                                        onCheckedChange={(checked) =>
                                                            setEditedBook({ ...editedBook, isFeatured: checked })
                                                        }
                                                    />
                                                </label>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                                                {t("BookGenres")}
                                            </Label>
                                            <div className="flex flex-wrap gap-2">
                                                {genres.map((gn) => {
                                                    const isSelected = editedBook.genreIds?.includes(gn.id);
                                                    return (
                                                        <Badge
                                                            key={gn.id}
                                                            variant={isSelected ? "default" : "outline"}
                                                            className="cursor-pointer transition-colors"
                                                            onClick={() => {
                                                                const current = editedBook.genreIds || [];
                                                                const next = isSelected
                                                                    ? current.filter(id => id !== gn.id)
                                                                    : [...current, gn.id];
                                                                setEditedBook({ ...editedBook, genreIds: next });
                                                            }}
                                                        >
                                                            {gn.name}
                                                        </Badge>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Description */}
                                {editMode ? (
                                    <div className="space-y-2">
                                        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                                            {t("BookDescription")}
                                        </Label>
                                        <Textarea
                                            value={editedBook.description || ''}
                                            onChange={(e) =>
                                                setEditedBook({ ...editedBook, description: e.target.value })
                                            }
                                            placeholder={t("BookDescriptionPlaceholder")}
                                            rows={5}
                                        />
                                    </div>
                                ) : (
                                    <p className="text-pretty text-justify text-[15px] leading-relaxed text-muted-foreground">
                                        {book.description || t("NoDescriptionAvailable")}
                                    </p>
                                )}

                                {/* Stats */}
                                <div className="grid gap-3 pt-2 sm:grid-cols-3">
                                    <StatTile
                                        icon={<Star className="h-4 w-4" />}
                                        label={t("Rating")}
                                        value={Number(book.ratingAvg ?? 0).toFixed(1)}
                                        hint={t("NReviews", { count: book.ratingCount })}
                                    />
                                    <StatTile
                                        icon={<BookOpen className="h-4 w-4" />}
                                        label={t("Chapters")}
                                        value={String(book.chapterCount)}
                                    />
                                    <StatTile
                                        icon={<Clock className="h-4 w-4" />}
                                        label={t("Updated")}
                                        value={formatUpdateTime(book.lastContentUpdate || book.updatedAt, ti)}
                                        small
                                    />
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

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
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setDeleteBookDialog(false)}>
                            {g("Cancel")}
                        </Button>
                        <Button variant="destructive" onClick={handleDeleteBook}>
                            <Trash className="me-2 h-4 w-4" />
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
                onSelectAction={(item) => {
                    setEditedBook((prev) => ({
                        ...prev,
                        coverImage: item?.code ?? "",
                    }));
                }}
            />
        </div>
    );
}

function StatTile({icon, label, value, hint, small,}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    hint?: string;
    small?: boolean;
}) {
    return (
        <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/60 p-3 backdrop-blur-sm">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background text-foreground">
                {icon}
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    {label}
                </p>
                <p className={small ? "truncate text-sm font-semibold" : "text-xl font-semibold tabular-nums"}>
                    {value}
                </p>
                {hint && <p className="truncate text-[11px] text-muted-foreground">{hint}</p>}
            </div>
        </div>
    );
}