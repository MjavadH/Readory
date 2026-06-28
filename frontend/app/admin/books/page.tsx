"use client"
import { getBookCoverThumbnailUrl } from "@/lib/media"
import React, { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { AppPagination } from "@/components/app-pagination"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
    BookOpen,
    Plus,
    Search,
    CheckCircle2,
    Clock,
    ImageIcon,
    X,
} from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/providers/toast-provider";
import { apiClient, getApiErrorMessage } from "@/lib/api-client"
import { MediaPicker } from "@/components/admin/media-picker"
import { StatCard } from "@/components/admin/stat-card"
import { BookCard } from "@/components/book-card"
import type { BookCardData } from "@/lib/types"
import { AGE_RATING_VALUES, BOOK_STATUS_VALUES, BookStatus, type AgeRating } from "@readory/shared"
import { motion } from "framer-motion"
import {useTranslations} from "next-intl";

type StatusFilter = "all" | "published" | "draft" | "featured"

type Genre = {
    id: number
    name: string
    slug: string
}

type BookType = {
    id: number
    name: string
    slug: string
}

interface BookStats {
    total: number
    Published: number
    Drafts: number
}

const ITEMS_PER_PAGE = 24

export default function AdminBooks() {
    const t = useTranslations('Books');
    const g = useTranslations('General');
    const toast = useToast();
    const [books, setBooks] = useState<BookCardData[]>([])
    const [stats, setStats] = useState<BookStats>({
        total: 0,
        Published: 0,
        Drafts: 0,
    })
    const [newCoverPickerOpen, setNewCoverPickerOpen] = useState(false)
    const [newCoverLabel, setNewCoverLabel] = useState<string>("")
    const [genres, setGenres] = useState<Genre[]>([])
    const [bookTypes, setBookTypes] = useState<BookType[]>([])
    const [isLoadingTypes, setIsLoadingTypes] = useState(true)
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState(1)
    const paginationScrollRef = useRef<HTMLDivElement>(null)
    const totalPages = Math.ceil(stats.total / ITEMS_PER_PAGE)
    const [searchQuery, setSearchQuery] = useState("")
    const [debouncedQ, setDebouncedQ] = useState("")
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [showAddCard, setShowAddCard] = useState(false)

    const [newBook, setNewBook] = useState({
        title: "",
        originalTitle: "",
        alternativeTitles: "",
        author: "",
        typeId: undefined as number | undefined,
        description: "",
        coverImage: "",
        genreIds: [] as number[],
        isPublished: false,
        isFeatured: false,
        status: BookStatus.Upcoming,
        ageRating: undefined as AgeRating | undefined,
        publicationYear: "",
        translators: "",
    })

    useEffect(() => {
        void bootstrap()
    }, [])

    const bootstrap = async () => {
        setLoading(true)
        try {
            await Promise.all([fetchBooks(), fetchGenres(), fetchTypes()])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        const t = setTimeout(() => setDebouncedQ(searchQuery.trim()), 300)
        return () => clearTimeout(t)
    }, [searchQuery])

    useEffect(() => {
        void fetchBooks()
    }, [page, statusFilter, debouncedQ])

    const fetchBooks = async () => {
        try {
            const qs = new URLSearchParams({
                page: String(page),
                limit: String(ITEMS_PER_PAGE),
                status: statusFilter,
            })
            if (debouncedQ) qs.set("q", debouncedQ)

            const data = await apiClient.get<{ books: any[]; stats?: BookStats }>(`/books/allBooks?${qs.toString()}`)

            const transformedBooks: BookCardData[] = (data.books || []).map((book) => ({
                id: book.id,
                title: book.title,
                coverImage: book.coverImage || "",
                type: book.type,
                author: book.author,
                description: book.description,
                ratingAvg: book.ratingAvg,
                ratingCount: book.ratingCount,
                genres: (book.genres || []).map((g: any) => g.genre),
                isFeatured: book.isFeatured,
                isPublished: book.isPublished,
                chapterCount: book.chapterCount || 0,
                updatedAt: book.lastContentUpdate || book.updatedAt,
            }))

            setBooks(transformedBooks)
            if (data.stats) setStats(data.stats)
        } catch (err: any) {
            toast.error(t("ErrorFetchingBooks"))
            setBooks([])
        }
    }

    useEffect(() => {
        setPage(1)
    }, [statusFilter, debouncedQ])

    const fetchGenres = async () => {
        try {
            const data = await apiClient.get<Genre[]>("/genres").catch(() => [])
            setGenres(Array.isArray(data) ? data : [])
        } catch (err: any) {
            toast.error(t("ErrorFetchingGenres"))
            setGenres([])
        }
    }

    const fetchTypes = async () => {
        try {
            const data = await apiClient.get<BookType[]>("/book-types").catch(() => [])
            const list = Array.isArray(data) ? data : []
            setBookTypes(list)
            if (list.length > 0) {
                setNewBook((prev) => ({ ...prev, typeId: prev.typeId ?? list[0].id }))
            }
        } catch (err: any) {
            toast.error(t("ErrorFetchingTypes"))
            setBookTypes([])
        } finally {
            setIsLoadingTypes(false)
        }
    }

    const handleAddBook = async () => {
        if (!newBook.title.trim()) {
            return toast.error(t("TitleRequired"), t("Validation Error"))
        }
        if (newBook.genreIds.length === 0) {
            return toast.error(t("SelectOneGenre"), t("Validation Error"))
        }
        if (newBook.typeId == null) {
            return toast.error(t("BookTypeRequired"), t("Validation Error"))
        }
        setIsSubmitting(true)
        try {
            await apiClient.post("/books", {
                ...newBook,
                alternativeTitles: newBook.alternativeTitles.split(",").map((item) => item.trim()).filter(Boolean),
                translators: newBook.translators.split(",").map((item) => item.trim()).filter(Boolean),
                publicationYear: newBook.publicationYear ? Number(newBook.publicationYear) : undefined,
                genreIds: newBook.genreIds,
            })

            await fetchBooks()
            setShowAddCard(false)
            setNewBook({
                title: "",
                originalTitle: "",
                alternativeTitles: "",
                author: "",
                typeId: bookTypes[0]?.id,
                description: "",
                coverImage: "",
                genreIds: [],
                isPublished: false,
                isFeatured: false,
                status: BookStatus.Upcoming,
                ageRating: undefined,
                publicationYear: "",
                translators: "",
            })
            setNewCoverLabel("")
            toast.success(t("BookCreatedSuccessfully"))
        } catch (err: any) {
            toast.error(getApiErrorMessage(err))
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleCancelAdd = () => {
        setShowAddCard(false)
        setNewBook({
            title: "",
            originalTitle: "",
            alternativeTitles: "",
            author: "",
            typeId: bookTypes[0]?.id,
            description: "",
            coverImage: "",
            genreIds: [],
            isPublished: false,
            isFeatured: false,
            status: BookStatus.Upcoming,
            ageRating: undefined,
            publicationYear: "",
            translators: "",
        })
        setNewCoverLabel("")
    }

    const handleBookClick = (bookId: number) => {
        window.location.href = `/admin/books/${bookId}`
    }

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
        )
    }

    return (
        <div className="min-h-screen bg-linear-to-br from-muted/30 via-background to-muted/20">
            <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-400 mx-auto">
                <motion.div
                    className="space-y-1 p-3 md:p-0"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.55 }}
                >
                    <h1 className="text-3xl sm:text-4xl font-bold tracking-tight bg-linear-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                        {t("Title")}
                    </h1>
                    <p className="text-sm sm:text-base text-muted-foreground">{t("Description")}</p>
                </motion.div>

                <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                    <StatCard
                        title={t("TotalBooks")}
                        value={stats.total.toLocaleString()}
                        icon={BookOpen}
                        color="blue"
                        animationDelay={0}
                    />
                    <StatCard
                        title={t("Published")}
                        value={stats.Published.toLocaleString()}
                        icon={CheckCircle2}
                        color="emerald"
                        animationDelay={0.2}
                    />
                    <StatCard
                        title={t("Drafts")}
                        value={stats.Drafts.toLocaleString()}
                        icon={Clock}
                        color="amber"
                        animationDelay={0.4}
                    />
                </div>

                {showAddCard ? (
                    <Card className="border-2 border-primary/20 shadow-lg">
                        <CardHeader className="flex flex-row items-center justify-between pb-4">
                            <CardTitle className="text-xl">{t("AddNewBook")}</CardTitle>
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
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2 md:col-span-2">
                                    <Label htmlFor="add-title">{t("BookTitle")} *</Label>
                                    <Input
                                        id="add-title"
                                        value={newBook.title}
                                        onChange={(e) => setNewBook({ ...newBook, title: e.target.value })}
                                        placeholder={t("BookTitlePlaceholder")}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="add-author">{t("BookAuthor")}</Label>
                                    <Input
                                        id="add-author"
                                        value={newBook.author}
                                        onChange={(e) => setNewBook({ ...newBook, author: e.target.value })}
                                        placeholder={t("BookAuthorPlaceholder")}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="add-original-title">{t("OriginalTitle")}</Label>
                                    <Input
                                        id="add-original-title"
                                        value={newBook.originalTitle}
                                        onChange={(e) => setNewBook({ ...newBook, originalTitle: e.target.value })}
                                        placeholder={t("OriginalTitlePlaceholder")}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="add-publication-year">{t("PublicationYear")}</Label>
                                    <Input
                                        id="add-publication-year"
                                        value={newBook.publicationYear}
                                        onChange={(e) => setNewBook({ ...newBook, publicationYear: e.target.value })}
                                        placeholder={t("PublicationYearPlaceholder")}
                                    />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <Label htmlFor="add-alternative-titles">{t("AlternativeTitles")}</Label>
                                    <Input
                                        id="add-alternative-titles"
                                        value={newBook.alternativeTitles}
                                        onChange={(e) => setNewBook({ ...newBook, alternativeTitles: e.target.value })}
                                        placeholder={t("AlternativeTitlesPlaceholder")}
                                    />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <Label htmlFor="add-translators">{t("Translators")}</Label>
                                    <Input
                                        id="add-translators"
                                        value={newBook.translators}
                                        onChange={(e) => setNewBook({ ...newBook, translators: e.target.value })}
                                        placeholder={t("TranslatorsPlaceholder")}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>{t("BookType")}</Label>
                                    <Select
                                        value={newBook.typeId != null ? String(newBook.typeId) : undefined}
                                        onValueChange={(v) => setNewBook({ ...newBook, typeId: Number(v) })}
                                        disabled={isLoadingTypes || bookTypes.length === 0}
                                        required
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {bookTypes.map((t) => (
                                                <SelectItem key={t.id} value={String(t.id)}>
                                                    {t.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>{t("BookStatus")}</Label>
                                    <Select value={newBook.status} onValueChange={(v: BookStatus) => setNewBook({ ...newBook, status: v })}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>{BOOK_STATUS_VALUES.map((value) => <SelectItem key={value} value={value}>{t(`BookStatus_${value}`)}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>{t("AgeRating")}</Label>
                                    <Select value={newBook.ageRating} onValueChange={(v: AgeRating) => setNewBook({ ...newBook, ageRating: v })}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>{AGE_RATING_VALUES.map((value) => <SelectItem key={value} value={value}>{t(`AgeRating_${value}`)}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="add-description">{t("BookDescription")}</Label>
                                <Textarea
                                    id="add-description"
                                    value={newBook.description}
                                    onChange={(e) => setNewBook({ ...newBook, description: e.target.value })}
                                    placeholder={t("BookDescriptionPlaceholder")}
                                    rows={3}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>{t("BookCover")} *</Label>
                                <div className="flex items-center gap-3">
                                    <Button type="button" variant="outline" onClick={() => setNewCoverPickerOpen(true)}>
                                        <ImageIcon className="size-4 me-2" />
                                        {t("BookSelectCover")}
                                    </Button>
                                    {newBook.coverImage ? (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            onClick={() => {
                                                setNewBook((p) => ({ ...p, coverImage: "" }))
                                                setNewCoverLabel("")
                                            }}
                                        >
                                            {g("Remove")}
                                        </Button>
                                    ) : (
                                        <span className="text-xs text-muted-foreground">{t("NoCover")}</span>
                                    )}
                                </div>
                                {newBook.coverImage && (
                                    <div className="flex items-center gap-3 rounded-lg border p-3 bg-muted/20">
                                        <img
                                            src={`${getBookCoverThumbnailUrl(newBook.coverImage)}`}
                                            alt={newCoverLabel || "image"}
                                            className="w-14 aspect-3/4 rounded-md object-cover border"
                                            loading="lazy"
                                        />
                                        <div className="min-w-0">
                                            <div className="text-sm font-medium truncate">{newCoverLabel || "Selected cover"}</div>
                                            <code className="text-[11px] text-muted-foreground font-mono truncate block">
                                                {newBook.coverImage}
                                            </code>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label>{t("BookGenres")} *</Label>
                                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 max-h-40 overflow-auto border rounded-lg p-3 bg-muted/20">
                                    {genres.map((g) => {
                                        const checked = newBook.genreIds.includes(g.id)
                                        return (
                                            <label
                                                key={g.id}
                                                className="flex items-center gap-2 text-sm cursor-pointer hover:bg-accent/50 p-2 rounded"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() => {
                                                        setNewBook((prev) => ({
                                                            ...prev,
                                                            genreIds: checked
                                                                ? prev.genreIds.filter((x) => x !== g.id)
                                                                : [...prev.genreIds, g.id],
                                                        }))
                                                    }}
                                                    className="w-4 h-4"
                                                />
                                                <span>{g.name}</span>
                                            </label>
                                        )
                                    })}
                                </div>
                                {genres.length === 0 && (
                                    <p className="text-xs text-muted-foreground">{t("CreateGenresFirst")}</p>
                                )}
                            </div>
                            <div className="flex items-center space-x-2 p-3 bg-muted/30 rounded-lg">
                                <input
                                    type="checkbox"
                                    id="add-published"
                                    checked={newBook.isPublished}
                                    onChange={(e) => setNewBook({ ...newBook, isPublished: e.target.checked })}
                                    className="w-4 h-4"
                                />
                                <Label htmlFor="add-published" className="cursor-pointer">
                                    {t("PublishImmediately")}
                                </Label>
                            </div>
                            <div className="flex items-center space-x-2 p-3 bg-muted/30 rounded-lg">
                                <input
                                    type="checkbox"
                                    id="is-featured"
                                    checked={newBook.isFeatured}
                                    onChange={(e) => setNewBook({ ...newBook, isFeatured: e.target.checked })}
                                    className="w-4 h-4"
                                />
                                <Label htmlFor="is-featured" className="cursor-pointer">
                                    {t("MarkFeatured")}
                                </Label>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <Button variant="outline" onClick={handleCancelAdd} disabled={isSubmitting} className="flex-1">
                                    {g("Cancel")}
                                </Button>
                                <Button onClick={handleAddBook} disabled={isSubmitting || bookTypes.length === 0 || newBook.typeId == null} className="flex-1">
                                    {isSubmitting ? t("CreatingBook") : t("CreateBook")}
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
                            <h3 className="text-lg font-semibold mb-1">{t("AddNewBook")}</h3>
                            <p className="text-sm text-muted-foreground">{t("ClickToCreate")}</p>
                        </CardContent>
                    </Card>
                )}

                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <Input
                            placeholder={t("SearchByTitle")}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="ps-10 h-11 shadow-sm"
                        />
                    </div>
                    <Select value={statusFilter} onValueChange={(value: StatusFilter) => setStatusFilter(value)}>
                        <SelectTrigger className="w-full sm:w-50 h-11 shadow-sm">
                            <SelectValue placeholder={t("FilterByStatus")} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">{t("AllBooks")}</SelectItem>
                            <SelectItem value="published">{t("PublishedOnly")}</SelectItem>
                            <SelectItem value="draft">{t("DraftsOnly")}</SelectItem>
                            <SelectItem value="featured">{t("FeaturedOnly")}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {books.length === 0 ? (
                    <Card className="py-16 sm:py-20 border-none shadow-lg bg-linear-to-br from-card to-muted/20">
                        <CardContent className="flex flex-col items-center justify-center text-center px-4">
                            <div className="size-16 sm:size-20 rounded-2xl bg-muted/50 flex items-center justify-center mb-4 sm:mb-6">
                                <BookOpen className="w-8 h-8 sm:w-10 sm:h-10 text-muted-foreground" />
                            </div>
                            <h3 className="text-lg sm:text-xl font-semibold mb-2">{t("NoBooksFound")}</h3>
                            <p className="text-sm sm:text-base text-muted-foreground mb-6 max-w-md">
                                {stats.total === 0
                                    ? t("GetStarted")
                                    : t("AdjustingFilter")}
                            </p>
                            {stats.total === 0 && (
                                <Button size="lg" onClick={() => setShowAddCard(true)} className="shadow-lg">
                                    <Plus className="w-4 h-4 me-2" />
                                    {t("AddFirstBook")}
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                ) : (
                    <div ref={paginationScrollRef} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                        {books.map((book) => (
                            <div key={book.id} onClick={() => handleBookClick(book.id)} className="cursor-pointer">
                                <BookCard book={book} link={`/admin/books/${book.id}`} />
                            </div>
                        ))}
                    </div>
                )}

                {books.length > 0 && (
                    <AppPagination
                        currentPage={page}
                        totalPages={totalPages}
                        totalItems={stats.total}
                        pageSize={ITEMS_PER_PAGE}
                        itemLabel={t("Title")}
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
                        setNewBook((p) => ({ ...p, coverImage: item?.code ?? "" }))
                        setNewCoverLabel(item?.filename ?? "")
                    }}
                />
            </div>
        </div>
    )
}
