"use client"
import { useCallback, useEffect, useState } from 'react';
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
    Sparkles, ImageIcon, EyeIcon
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from "@/components/ui/label"
import { formatUpdateTime } from "@/lib/time";
import {AppPagination} from "@/components/app-pagination";
import type { IconKey } from "@readory/shared";
import {useParams} from "next/navigation";
import Image from "next/image";
import {MediaPicker} from "@/components/admin/media-picker";
import Link from "next/link";
import {AppIcon} from "@/components/AppIcon";
import { useToast } from "@/providers/toast-provider";

type BookDetails = {
    id: number;
    title: string;
    author?: string | null;
    description?: string | null;
    coverImage: string;
    isFeatured: boolean;
    isPublished: boolean;
    ratingAvg: number;
    ratingCount: number;
    updatedAt: string;
    createdAt: string;
    type: { id: number; name: string; slug: string; iconKey: IconKey };
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

const CHAPTERS_PER_PAGE = 60;

type OptionItem = { id: number; name: string };

function LoadingSkeleton() {
    return (
        <div className="min-h-screen bg-linear-to-br from-muted/30 via-background to-muted/20">
            <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-400 mx-auto">
                <div className="p-3 md:p-0 mb-6 h-10 w-32 animate-pulse rounded-lg bg-slate-300 dark:bg-slate-700" />
                <div className="space-y-6">
                    <Card className="overflow-hidden">
                        <CardContent className="p-6 sm:p-8">
                            <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
                                <div className="h-96 w-full animate-pulse rounded-2xl bg-slate-300 dark:bg-slate-700" />
                                <div className="space-y-4">
                                    <div className="h-8 w-3/4 animate-pulse rounded-lg bg-slate-300 dark:bg-slate-700" />
                                    <div className="h-5 w-1/3 animate-pulse rounded-lg bg-slate-300 dark:bg-slate-700" />
                                    <div className="space-y-2">
                                        <div className="h-4 w-full animate-pulse rounded bg-slate-300 dark:bg-slate-700" />
                                        <div className="h-4 w-full animate-pulse rounded bg-slate-300 dark:bg-slate-700" />
                                        <div className="h-4 w-2/3 animate-pulse rounded bg-slate-300 dark:bg-slate-700" />
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

export default function AdminBookDetail() {
    const toast = useToast();
    const params = useParams<{ id: string }>();
    const idParam = Array.isArray(params.id) ? params.id[0] : params.id;
    const bookId = Number(idParam);

    const [book, setBook] = useState<BookDetails | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [newCoverPickerOpen, setNewCoverPickerOpen] = useState(false)

    // Load available types and genres for edit mode
    const [types, setTypes] = useState<OptionItem[]>([]);
    const [genres, setGenres] = useState<OptionItem[]>([]);

    const [chapters, setChapters] = useState<ChapterItem[]>([]);
    const [chaptersPage, setChaptersPage] = useState(1);
    const [chaptersTotal, setChaptersTotal] = useState(0);
    const [chaptersTotalPages, setChaptersTotalPages] = useState(1);
    const [chaptersLoading, setChaptersLoading] = useState(false);

    const [editMode, setEditMode] = useState(false);
    const [editedBook, setEditedBook] = useState<Partial<BookDetails>& { typeId?: number; genreIds?: number[] }>({});

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
            // Adjust endpoints based on your API structure
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
            toast.error("Invalid book link.")
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
                genreIds: data.genres?.map(g => g.genre.id) || []
            });
        } catch (error) {
            toast.error(getApiErrorMessage(error, 'Failed to load book details.'))
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
            toast.error(getApiErrorMessage(error, 'Failed to load chapters.'))
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
                isPublished: editedBook.isPublished,
                isFeatured: editedBook.isFeatured,
                coverImage: editedBook.coverImage,
                typeId: editedBook.typeId,
                genreIds: editedBook.genreIds,
            });
            toast.success('Book updated successfully!')
            setEditMode(false);
            await loadBook();
        } catch (error) {
            toast.error(getApiErrorMessage(error, 'Failed to update book.'))
        }
    };

    const handleDeleteBook = async () => {
        if (!book) return;

        try {
            await apiClient.delete(`/books/${book.id}`);
            toast.success('Book deleted successfully!')
            setTimeout(() => {
                window.history.back();
            }, 1500);
        } catch (error) {
            toast.error(getApiErrorMessage(error, 'Failed to delete book.'))
        }
        setDeleteBookDialog(false);
    };

    const handleDeleteChapter = async (chapterId: number) => {
        if (!book) return;

        try {
            await apiClient.delete(`/books/${book.id}/chapters/${chapterId}`);
            toast.success('Chapter deleted successfully!')
            await loadChapters();
        } catch (error) {
            toast.error(getApiErrorMessage(error, 'Failed to delete chapter.'))
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
                toast.success('Chapter added successfully!')
            } else if (chapterDialog?.mode === 'edit' && chapterDialog.chapter) {
                await apiClient.patch(`/books/${book.id}/chapters/${chapterDialog.chapter.id}`, {
                    ...chapterForm,
                    price: chapterForm.isFree ? undefined : (Number(chapterForm.price) || 0).toFixed(2),
                });
                toast.success('Chapter updated successfully!')
            }
            setChapterDialog(null);
            await loadChapters();
        } catch (error) {
            toast.error(getApiErrorMessage(error, 'Failed to save chapter.'))
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
            <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-muted/30 via-background to-muted/20">
                <div className="text-center">
                    <div className="mb-4 flex justify-center">
                        <div className="rounded-full bg-red-100 p-4 dark:bg-red-950">
                            <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
                        </div>
                    </div>
                    <h2 className="mb-2 text-2xl font-bold">Book Not Found</h2>
                    <p className="text-slate-600 dark:text-slate-400">
                        The book you're looking for doesn't exist or has been removed.
                    </p>
                    <Button onClick={() => window.history.back()} className="mt-6">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Go Back
                    </Button>
                </div>
            </div>
        );
    }

    const coverCodeForDisplay =
        editMode
            ? (typeof editedBook.coverImage === "string" ? editedBook.coverImage : book.coverImage)
            : book.coverImage;

    return (
        <div className="min-h-screen bg-linear-to-br from-muted/30 via-background to-muted/20">
            <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-400 mx-auto">
                <Link
                    href="/admin/books"
                    className="p-3 md:p-0 group mb-6 flex items-center gap-2 text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                >
                    <div className="rounded-lg bg-white p-2 shadow-sm transition-all group-hover:shadow-md dark:bg-slate-900">
                        <ArrowLeft className="h-5 w-5" />
                    </div>
                    <span className="font-medium">Back to Books</span>
                </Link>

                <div className="space-y-6">
                    <Card className="overflow-hidden border-0 shadow-xl">
                        <CardContent className="p-6 sm:p-8">
                            <div className="grid gap-8 lg:grid-cols-[300px_1fr]">
                                <div className="relative mx-auto w-full max-w-75">
                                    <div className="group relative overflow-hidden rounded-2xl shadow-2xl transition-transform duration-300 hover:scale-[1.02]">
                                        <Image
                                            src={coverCodeForDisplay ? `/media/${coverCodeForDisplay}/thumbnail` : '/placeholder.svg'}
                                            alt={book.title}
                                            width={280}
                                            height={420}
                                            className="h-auto w-full object-cover"
                                            sizes="(max-width: 640px) 100vw, 280px"
                                            priority
                                        />
                                        <div className="absolute inset-0 bg-linear-to-t from-black/30 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                                    </div>
                                    {editMode && (
                                        <div className="mt-4">
                                            <div className="flex items-center gap-3">
                                                <Button type="button" variant="outline" onClick={() => setNewCoverPickerOpen(true)}>
                                                    <ImageIcon className="size-4 mr-2" />
                                                    Select cover
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-6">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 space-y-3">
                                            {editMode ? (
                                                <Input
                                                    value={editedBook.title || ''}
                                                    onChange={(e) => setEditedBook({ ...editedBook, title: e.target.value })}
                                                    className="text-2xl font-bold sm:text-3xl"
                                                    placeholder="Book title"
                                                />
                                            ) : (
                                                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                                                    {book.title}
                                                </h1>
                                            )}

                                            {editMode ? (
                                                <Input
                                                    value={editedBook.author || ''}
                                                    onChange={(e) => setEditedBook({ ...editedBook, author: e.target.value })}
                                                    placeholder="Author name"
                                                />
                                            ) : (
                                                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                                                    <User className="h-4 w-4" />
                                                    <span className="text-sm font-medium">
                                                        {book.author || 'Unknown Author'}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex shrink-0 gap-2">
                                            {!editMode ? (
                                                <>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => setEditMode(true)}
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="destructive"
                                                        size="sm"
                                                        onClick={() => setDeleteBookDialog(true)}
                                                    >
                                                        <Trash className="h-4 w-4" />
                                                    </Button>
                                                </>
                                            ) : (
                                                <>
                                                    <Button size="sm" onClick={handleSaveBook}>
                                                        <Check className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => {
                                                            setEditMode(false);
                                                            setEditedBook(book);
                                                        }}
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2 w-full">
                                        {editMode ? (
                                            <div className="flex w-full flex-col gap-4 mb-4 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                                                <div>
                                                    <Label className="mb-2 block">Book Type</Label>
                                                    <select
                                                        className="flex h-10 w-full md:w-1/2 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                                        value={editedBook.typeId || ''}
                                                        onChange={(e) => setEditedBook({ ...editedBook, typeId: Number(e.target.value) })}
                                                    >
                                                        {types.map(t => (
                                                            <option key={t.id} value={t.id}>{t.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <Label className="mb-2 block">Genres</Label>
                                                    <div className="flex flex-wrap gap-2">
                                                        {genres.map(g => {
                                                            const isSelected = editedBook.genreIds?.includes(g.id);
                                                            return (
                                                                <Badge
                                                                    key={g.id}
                                                                    variant={isSelected ? "default" : "outline"}
                                                                    className={`cursor-pointer transition-colors ${isSelected ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                                                                    onClick={() => {
                                                                        const current = editedBook.genreIds || [];
                                                                        const next = isSelected
                                                                            ? current.filter(id => id !== g.id)
                                                                            : [...current, g.id];
                                                                        setEditedBook({ ...editedBook, genreIds: next });
                                                                    }}
                                                                >
                                                                    {g.name}
                                                                </Badge>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
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
                                            </>
                                        )}
                                        {editMode ? (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="flex flex-wrap gap-3">
                                                    <Switch
                                                        id="isPublished"
                                                        checked={editedBook.isPublished ?? false}
                                                        onCheckedChange={(checked) =>
                                                            setEditedBook({ ...editedBook, isPublished: checked })
                                                        }
                                                    />
                                                    <Label htmlFor="isPublished">Published</Label>
                                                </div>
                                                <div className="flex flex-wrap gap-3">
                                                    <Switch
                                                        id="isFeatured"
                                                        checked={editedBook.isFeatured ?? false}
                                                        onCheckedChange={(checked) =>
                                                            setEditedBook({ ...editedBook, isFeatured: checked })
                                                        }
                                                    />
                                                    <Label htmlFor="isFeatured">Mark as featured</Label>
                                                </div>
                                            </div>
                                        ) :  (
                                            <>
                                                {book.isPublished ? (
                                                    <Badge className="gap-1.5 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                                        <Eye className="h-3.5 w-3.5" />
                                                        Published
                                                    </Badge>
                                                ) : (
                                                    <Badge className="gap-1.5 border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                                        <EyeOff className="h-3.5 w-3.5" />
                                                        Draft
                                                    </Badge>
                                                )}
                                                {book.isFeatured && (
                                                    <Badge className="gap-1.5 border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                                        <Sparkles className="h-3.5 w-3.5" />
                                                        Featured
                                                    </Badge>
                                                )}
                                            </>
                                        )}
                                    </div>

                                    {editMode ? (
                                        <div className="space-y-4">
                                            <div>
                                                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                                    Description
                                                </label>
                                                <Textarea
                                                    value={editedBook.description || ''}
                                                    onChange={(e) =>
                                                        setEditedBook({ ...editedBook, description: e.target.value })
                                                    }
                                                    placeholder="Book description"
                                                    rows={4}
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="leading-relaxed text-slate-700 dark:text-slate-300">
                                            {book.description || 'No description available.'}
                                        </p>
                                    )}

                                    <div className="grid gap-4 sm:grid-cols-3">
                                        <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-linear-to-br from-amber-50 to-orange-50 p-4 dark:border-slate-700 dark:from-amber-950/30 dark:to-orange-950/30">
                                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-amber-400 to-orange-500 text-white shadow-lg">
                                                <Star className="h-6 w-6" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs font-medium uppercase tracking-wide text-slate-600 dark:text-slate-400">
                                                    Rating
                                                </p>
                                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                                    {Number(book.ratingAvg ?? 0).toFixed(1)}
                                                </p>
                                                <p className="text-xs text-slate-600 dark:text-slate-400">
                                                    {book.ratingCount} {book.ratingCount === 1 ? 'review' : 'reviews'}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-linear-to-br from-blue-50 to-cyan-50 p-4 dark:border-slate-700 dark:from-blue-950/30 dark:to-cyan-950/30">
                                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-blue-400 to-cyan-500 text-white shadow-lg">
                                                <Clock className="h-6 w-6" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs font-medium uppercase tracking-wide text-slate-600 dark:text-slate-400">
                                                    Updated
                                                </p>
                                                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                                    {formatUpdateTime(book.updatedAt)}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-linear-to-br from-emerald-50 to-teal-50 p-4 dark:border-slate-700 dark:from-emerald-950/30 dark:to-teal-950/30">
                                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-emerald-400 to-teal-500 text-white shadow-lg">
                                                <BookOpen className="h-6 w-6" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs font-medium uppercase tracking-wide text-slate-600 dark:text-slate-400">
                                                    Chapters
                                                </p>
                                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                                    {chaptersTotal}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-slate-200 dark:border-slate-800">
                        <CardHeader className="border-b border-slate-200 dark:border-slate-800">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <CardTitle className="text-2xl font-bold">Chapters</CardTitle>
                                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                                        Manage all book chapters
                                    </p>
                                </div>
                                <Button onClick={openAddChapter} className="bg-linear-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700">
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add Chapter
                                </Button>
                            </div>
                        </CardHeader>

                        <CardContent className="space-y-6 p-6">
                            {chaptersLoading ? (
                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                    {Array.from({ length: 8 }).map((_, i) => (
                                        <div
                                            key={i}
                                            className="animate-pulse rounded-xl border bg-card p-4"
                                        >
                                            <div className="mb-3 flex items-start gap-3">
                                                <div className="h-10 w-10 rounded-lg bg-slate-300 dark:bg-slate-700" />
                                                <div className="flex-1 space-y-2">
                                                    <div className="h-4 w-full rounded bg-slate-300 dark:bg-slate-700" />
                                                    <div className="h-3 w-2/3 rounded bg-slate-300 dark:bg-slate-700" />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : chapters.length === 0 ? (
                                <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 py-16 dark:border-slate-700">
                                    <BookOpen className="mb-3 h-12 w-12 text-slate-400" />
                                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                        No chapters yet
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-slate-500">
                                        Click "Add Chapter" to create the first chapter
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                        {chapters.map((chapter) => {
                                            const isFree = chapter.isFree || chapter.price == null;
                                            const priceLabel = isFree
                                                ? 'Free'
                                                : `$${Number(chapter.price).toFixed(2)}`;

                                            return (
                                                <div
                                                    key={chapter.id}
                                                    className="group relative overflow-hidden rounded-xl border bg-white p-4 transition-all duration-300 hover:border-blue-300 hover:shadow-xl dark:bg-slate-900 dark:hover:border-blue-700"
                                                >
                                                    <div className="absolute right-2 top-2">
                                                        <Badge
                                                            variant={isFree ? 'secondary' : 'outline'}
                                                            className="border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300"
                                                        >
                                                            {priceLabel}
                                                        </Badge>
                                                    </div>

                                                    <div className="mb-3 flex items-start gap-3 pr-20">
                                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-blue-500 to-cyan-500 text-sm font-bold text-white shadow-lg">
                                                            {chapter.index}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900 dark:text-white">
                                                                {chapter.title}
                                                            </h3>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                                                        <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                                                            <Clock className="h-3 w-3" />
                                                            {formatUpdateTime(chapter.updatedAt)}
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <Link href={`/admin/books/${bookId}/c/${chapter.index}`} >
                                                                <button
                                                                    className="rounded-lg p-1.5 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                                                                >
                                                                    <EyeIcon className="h-4 w-4" />
                                                                </button>
                                                            </Link>
                                                            <button
                                                                onClick={() => openEditChapter(chapter)}
                                                                className="rounded-lg p-1.5 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                                                            >
                                                                <Edit className="h-4 w-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => setDeleteChapterDialog(chapter.id)}
                                                                className="rounded-lg p-1.5 text-slate-600 transition-colors hover:bg-red-100 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-950 dark:hover:text-red-400"
                                                            >
                                                                <Trash className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <div className="absolute inset-0 -z-10 bg-linear-to-br from-blue-500/5 to-cyan-500/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {chaptersTotalPages > 1 && (
                                        <div className="border-t border-slate-200 pt-6 dark:border-slate-800">
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
                </div>
            </div>

            <Dialog open={deleteBookDialog} onOpenChange={() => setDeleteBookDialog(false)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Book</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete "{book.title}"? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteBookDialog(false)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleDeleteBook}>
                            Delete Book
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={deleteChapterDialog !== null} onOpenChange={() => setDeleteChapterDialog(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Chapter</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this chapter? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteChapterDialog(null)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => deleteChapterDialog && handleDeleteChapter(deleteChapterDialog)}
                        >
                            Delete Chapter
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={chapterDialog !== null} onOpenChange={() => setChapterDialog(null)}>
                <DialogContent className="max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {chapterDialog?.mode === 'add' ? 'Add New Chapter' : 'Edit Chapter'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                Chapter Title
                            </label>
                            <Input
                                value={chapterForm.title}
                                onChange={(e) => setChapterForm({ ...chapterForm, title: e.target.value })}
                                placeholder="Enter chapter title"
                            />
                        </div>
                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                Chapter Index
                            </label>
                            <Input
                                type="number"
                                min="1"
                                value={chapterForm.index}
                                onChange={(e) =>
                                    setChapterForm({ ...chapterForm, index: parseInt(e.target.value) || 1 })
                                }
                                placeholder="Chapter number"
                            />
                        </div>
                        <div className="flex items-center gap-4">
                            <Switch
                                id="isFree"
                                checked={chapterForm.isFree}
                                onCheckedChange={(checked) => setChapterForm({ ...chapterForm, isFree: checked })}
                            />
                            <Label htmlFor="isFree">Free Chapter</Label>
                        </div>
                        {!chapterForm.isFree && (
                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Price (USD)
                                </label>
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
                            Cancel
                        </Button>
                        <Button onClick={handleSaveChapter}>
                            {chapterDialog?.mode === 'add' ? 'Add Chapter' : 'Save Changes'}
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
