"use client"

import React, { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { AdminPagination } from "@/components/admin-pagination"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
    BookOpen,
    Plus,
    Edit,
    Eye,
    Calendar,
    Trash2,
    Layers,
    Search,
    CheckCircle2,
    Clock,
    Star,
    ImageIcon,
} from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { apiClient, getApiErrorMessage } from "@/lib/api-client"
import { MediaPicker } from "@/components/media-picker"

// Added type alias for StatusFilter
type StatusFilter = "all" | "published" | "draft" | "featured"

// Added type alias for Genre
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

interface Book {
    id: number
    title: string
    author?: string | null
    description?: string | null
    coverImage?: string | null
    isPublished: boolean
    isFeatured: boolean
    type?: BookType
    updatedAt: string
    genres?: { genre: Genre }[]
    _count?: {
        chapters: number
    }
}

interface Chapter {
    id: number
    title: string
    index: number
    price?: number
    isFree: boolean
    contentPath?: string
}

interface BookStats{
    total: number,
    Published: number,
    Drafts: number,
}

export default function AdminBooks() {
    const { toast } = useToast()
    const [books, setBooks] = useState<Book[]>([])
    const [stats, setStats] = useState<BookStats>({
        total: 0,
        Published: 0,
        Drafts: 0,
    })
    const [newCoverPickerOpen, setNewCoverPickerOpen] = useState(false)
    const [editCoverPickerOpen, setEditCoverPickerOpen] = useState(false)
    const [newCoverLabel, setNewCoverLabel] = useState<string>("")
    const [editCoverLabel, setEditCoverLabel] = useState<string>("")
    const [genres, setGenres] = useState<Genre[]>([])
    const [bookTypes, setBookTypes] = useState<BookType[]>([])
    const [isLoadingTypes, setIsLoadingTypes] = useState(true)
    const [loading, setLoading] = useState(true)
    const [selectedBook, setSelectedBook] = useState<Book | null>(null)
    const [chapters, setChapters] = useState<Chapter[]>([])
    const [page, setPage] = useState(1)
    const ITEMS_PER_PAGE = 20
    const totalPages = Math.ceil(stats.total / ITEMS_PER_PAGE)
    const [searchQuery, setSearchQuery] = useState("")
    const [debouncedQ, setDebouncedQ] = useState("")

    // Dialog states
    const [isDetailsOpen, setIsDetailsOpen] = useState(false)
    const [isEditOpen, setIsEditOpen] = useState(false)
    const [isAddOpen, setIsAddOpen] = useState(false)
    const [isChapterDialogOpen, setIsChapterDialogOpen] = useState(false)
    const [isEditChapterOpen, setIsEditChapterOpen] = useState(false)
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
    const [deleteBookDialogOpen, setDeleteBookDialogOpen] = useState(false)
    const [bookToDelete, setBookToDelete] = useState<number | null>(null)
    const [deleteChapterDialogOpen, setDeleteChapterDialogOpen] = useState(false)
    const [chapterToDelete, setChapterToDelete] = useState<number | null>(null)
    const [chapterEditing, setChapterEditing] = useState<Chapter | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Add book form state
    const [newBook, setNewBook] = useState({
        title: "",
        author: "",
        type: "",
        description: "",
        coverImage: "",
        genreIds: [] as number[],
        isPublished: false,
        isFeatured: false,
    })

    // Edit book form state
    const [editBook, setEditBook] = useState({
        title: "",
        author: "",
        type: "",
        description: "",
        coverImage: "",
        genreIds: [] as number[],
        isPublished: false,
        isFeatured: false,
    })

    // Add chapter form state
    const [newChapter, setNewChapter] = useState({
        title: "",
        index: 0,
        price: 0,
        isFree: true,
        contentPath: "",
    })

    // Edit chapter form state
    const [editChapter, setEditChapter] = useState({
        title: "",
        index: 0,
        price: 0,
        isFree: true,
        contentPath: "",
    })

    // Load books
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

            const data = await apiClient.get<{ books: Book[]; stats?: BookStats }>(`/books/allBooks?${qs.toString()}`)

            setBooks(Array.isArray(data.books) ? data.books : [])
            if (data.stats) setStats(data.stats)
        } catch (err: any) {
            toast({ title: "Error fetching books", description: getApiErrorMessage(err), variant: "destructive" })
            setBooks([])
        }
    }

    useEffect(() => { setPage(1) }, [statusFilter, debouncedQ])

    const fetchGenres = async () => {
        try {
            const data = await apiClient.get<Genre[]>("/genres").catch(() => [])
            setGenres(Array.isArray(data) ? data : [])
        } catch (err: any) {
            toast({ title: "Error fetching genres", description: getApiErrorMessage(err), variant: "destructive" })
            setGenres([])
        }
    }

    const fetchTypes = async () => {
        try {
            const data = await apiClient.get<BookType[]>("/book-types").catch(() => [])
            const list = Array.isArray(data) ? data : []
            setBookTypes(list)
            if (list.length > 0) {
                setNewBook((prev) => ({ ...prev, type: prev.type || list[0].slug }))
                setEditBook((prev) => ({ ...prev, type: prev.type || list[0].slug }))
            }
        } catch (err: any) {
            toast({ title: "Error fetching book types", description: getApiErrorMessage(err), variant: "destructive" })
            setBookTypes([])
        } finally {
            setIsLoadingTypes(false)
        }
    }

    const handleDeleteBookClick = (bookId: number) => {
        setBookToDelete(bookId)
        setDeleteBookDialogOpen(true)
    }

    const handleDeleteBookConfirm = async () => {
        if (!bookToDelete) return
        setIsSubmitting(true)
        try {
            const book = books.find(b => b.id === bookToDelete);
            if (!book) {
                toast({
                    title: "Error",
                    description: "Book not found. It might have been deleted already.",
                    variant: "destructive",
                });
                return;
            }
            if (book._count?.chapters && book._count.chapters > 0) {
                toast({
                    title: "Cannot Delete Book",
                    description: "This book has chapters and cannot be deleted. Please delete all chapters first.",
                    variant: "destructive",
                });
                return;
            }

            await apiClient.delete(`/books/${bookToDelete}`)
            setBooks((prevBooks) => prevBooks.filter((b) => b.id !== bookToDelete))
            if (selectedBook?.id === bookToDelete) {
                setIsDetailsOpen(false)
                setIsEditOpen(false)
                setSelectedBook(null)
            }
            toast({ title: "Deleted", description: "Book deleted successfully" })
        } catch (err: any) {
            toast({ title: "Error", description: getApiErrorMessage(err), variant: "destructive" })
        } finally {
            setDeleteBookDialogOpen(false)
            setBookToDelete(null)
            setIsSubmitting(false)
        }
    }

    const handleAddChapter = async () => {
        if (!selectedBook) return
        setIsSubmitting(true)
        try {
            const data = await apiClient.post<Chapter>(`/books/${selectedBook.id}/chapters`, {
                ...newChapter,
                price: newChapter.isFree ? undefined : (Number(newChapter.price) || 0).toFixed(2),
            })

            setChapters([...chapters, data])
            setIsChapterDialogOpen(false)
            setNewChapter({
                title: "",
                index: chapters.length + 1,
                price: 0,
                isFree: true,
                contentPath: "",
            })
            toast({ title: "Success", description: "Chapter added successfully" })
        } catch (err: any) {
            toast({ title: "Error", description: getApiErrorMessage(err), variant: "destructive" })
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDeleteChapterClick = (chapterId: number) => {
        setChapterToDelete(chapterId)
        setDeleteChapterDialogOpen(true)
    }

    const handleDeleteChapterConfirm = async () => {
        if (!chapterToDelete || !selectedBook) return
        setIsSubmitting(true)
        try {
            await apiClient.delete(`/books/${selectedBook.id}/chapters/${chapterToDelete}`)
            setChapters((prevChapters) => prevChapters.filter((c) => c.id !== chapterToDelete))
            toast({ title: "Deleted", description: "Chapter deleted successfully" })
        } catch (err: any) {
            toast({ title: "Error", description: getApiErrorMessage(err), variant: "destructive" })
        } finally {
            setDeleteChapterDialogOpen(false)
            setChapterToDelete(null)
            setIsSubmitting(false)
        }
    }

    if (loading) {
        return (
            <div className="p-4 sm:p-6 space-y-6">
                <div className="space-y-1">
                    <h1 className="text-3xl sm:text-4xl font-bold tracking-tight bg-linear-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                        Books
                    </h1>
                    <p className="text-sm sm:text-base text-muted-foreground">Manage your book catalog and chapters</p>
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
        )
    }

    const handleAddBook = async () => {
        if (newBook.genreIds.length === 0) {
            return toast({ title: "Validation Error", description: "Select at least one genre", variant: "destructive" })
        }
        setIsSubmitting(true)
        try {
            const data = await apiClient.post<Book>("/books", {
                ...newBook,
                genreIds: newBook.genreIds,
            })

            setBooks([...books, data])
            setIsAddOpen(false)
            setNewBook({
                title: "",
                author: "",
                type: bookTypes[0]?.slug ?? "",
                description: "",
                coverImage: "",
                genreIds: [],
                isPublished: false,
                isFeatured: false,
            })
            toast({ title: "Success", description: "Book created successfully" })
        } catch (err: any) {
            toast({ title: "Error", description: getApiErrorMessage(err), variant: "destructive" })
        } finally {
            setIsSubmitting(false)
        }
    }

    const loadBookDetails = async (book: Book) => {
        setSelectedBook(book)
        try {
            const data = await apiClient.get<Chapter[]>(`/books/${book.id}/chapters`).catch(() => [])
            setChapters(Array.isArray(data) ? data : [])
        } catch (err: any) {
            toast({ title: "Error fetching chapters", description: getApiErrorMessage(err), variant: "destructive" })
            setChapters([])
        }
    }

    const handleUpdateBook = async () => {
        if (!selectedBook) return
        if (!editBook.title.trim()) {
            return toast({ title: "Validation Error", description: "Title is required", variant: "destructive" })
        }
        setIsSubmitting(true)
        try {
            const data = await apiClient.patch<Book>(`/books/${selectedBook.id}`, {
                ...editBook,
                genreIds: editBook.genreIds.length > 0 ? editBook.genreIds : undefined,
            })

            setBooks((prev) => prev.map((b) => (b.id === selectedBook.id ? { ...b, ...data } : b)))
            setSelectedBook({ ...selectedBook, ...data })
            setIsEditOpen(false)
            toast({ title: "Updated", description: "Book updated successfully" })
        } catch (err: any) {
            toast({ title: "Error", description: getApiErrorMessage(err), variant: "destructive" })
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="min-h-screen bg-linear-to-br from-muted/30 via-background to-muted/20">
            <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight bg-linear-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                            Books
                        </h1>
                        <p className="text-sm sm:text-base text-muted-foreground">Manage your book catalog and chapters</p>
                    </div>
                    {/* Add Book Dialog */}
                    <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                        <DialogTrigger asChild>
                            <Button size="lg" className="shadow-lg hover:shadow-xl transition-shadow w-full sm:w-auto">
                                <Plus className="w-4 h-4 mr-2" />
                                Add Book
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="w-[calc(100vw-2rem)] sm:w-full sm:max-w-137.5 max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>Add New Book</DialogTitle>
                                <DialogDescription>Create a new book in your catalog</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2 col-span-2">
                                        <Label htmlFor="add-title">Title *</Label>
                                        <Input
                                            id="add-title"
                                            value={newBook.title}
                                            onChange={(e) => setNewBook({ ...newBook, title: e.target.value })}
                                            placeholder="Enter book title"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="add-author">Author</Label>
                                        <Input
                                            id="add-author"
                                            value={newBook.author}
                                            onChange={(e) => setNewBook({ ...newBook, author: e.target.value })}
                                            placeholder="Author name"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Type</Label>
                                        <Select
                                            value={newBook.type}
                                            onValueChange={(v) => setNewBook({ ...newBook, type: v })}
                                            disabled={isLoadingTypes || bookTypes.length === 0}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {bookTypes.map((t) => (
                                                    <SelectItem key={t.id} value={t.slug}>
                                                        {t.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="add-description">Description</Label>
                                    <Textarea
                                        id="add-description"
                                        value={newBook.description}
                                        onChange={(e) => setNewBook({ ...newBook, description: e.target.value })}
                                        placeholder="Enter book description"
                                        rows={3}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Cover Image</Label>

                                    <div className="flex items-center gap-3">
                                        <Button type="button" variant="outline" onClick={() => setNewCoverPickerOpen(true)}>
                                            <ImageIcon className="size-4 mr-2" />
                                            Select cover
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
                                                Remove
                                            </Button>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">No cover selected</span>
                                        )}
                                    </div>

                                    {newBook.coverImage && (
                                        <div className="flex items-center gap-3 rounded-lg border p-3 bg-muted/20">
                                            <img
                                                src={`${process.env.NEXT_PUBLIC_API_BASE}/media/${newBook.coverImage}/thumbnail`}
                                                alt={newCoverLabel || "image"}
                                                className="w-14 h-14 rounded-md object-cover border"
                                                loading="lazy"
                                            />
                                            <div className="min-w-0">
                                                <div className="text-sm font-medium truncate">{newCoverLabel || "Selected cover"}</div>
                                                <code className="text-[11px] text-muted-foreground font-mono truncate block">{newBook.coverImage}</code>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label>Genres *</Label>
                                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-auto border rounded-lg p-3 bg-muted/20">
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
                                                                genreIds: checked ? prev.genreIds.filter((x) => x !== g.id) : [...prev.genreIds, g.id],
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
                                        <p className="text-xs text-muted-foreground">Create genres first in the Genres page.</p>
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
                                        Publish immediately
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
                                        Mark as featured
                                    </Label>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                                <Button onClick={handleAddBook} disabled={isSubmitting}>
                                    {isSubmitting ? "Creating..." : "Create Book"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>

                <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                    <Card className="border-border/50 bg-linear-to-br from-blue-500/5 to-blue-500/10">
                        <CardContent className="flex items-center gap-4 py-4">
                            <div className="flex size-12 items-center justify-center rounded-xl bg-blue-500/10 ring-1 ring-blue-500/20">
                                <BookOpen className="size-6 text-blue-600 dark:text-blue-500" />
                            </div>
                            <div>
                                <p className="text-xs sm:text-sm text-muted-foreground font-medium">Total Books</p>
                                <p className="text-xl sm:text-2xl font-bold">{stats.total.toLocaleString()}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-border/50 bg-linear-to-br from-emerald-500/5 to-emerald-500/10">
                        <CardContent className="flex items-center gap-4 py-4">
                            <div className="flex size-12 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
                                <CheckCircle2 className="size-6 text-emerald-600 dark:text-emerald-500" />
                            </div>
                            <div>
                                <p className="text-xs sm:text-sm text-muted-foreground font-medium">Published</p>
                                <p className="text-xl sm:text-2xl font-bold">{stats.Published.toLocaleString()}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-border/50 bg-linear-to-br from-amber-500/5 to-amber-500/10">
                        <CardContent className="flex items-center gap-4 py-4">
                            <div className="flex size-12 items-center justify-center rounded-xl bg-amber-500/10 ring-1 ring-amber-500/20">
                                <Clock className="size-6 text-amber-600 dark:text-amber-500" />
                            </div>
                            <div>
                                <p className="text-xs sm:text-sm text-muted-foreground font-medium">Drafts</p>
                                <p className="text-xl sm:text-2xl font-bold">{stats.Drafts.toLocaleString()}</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <Input
                            placeholder="Search books by title..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 h-11 shadow-sm"
                        />
                    </div>
                    <Select value={statusFilter} onValueChange={(value: StatusFilter) => setStatusFilter(value)}>
                        <SelectTrigger className="w-full sm:w-50 h-11 shadow-sm">
                            <SelectValue placeholder="Filter by status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Books</SelectItem>
                            <SelectItem value="published">Published Only</SelectItem>
                            <SelectItem value="draft">Drafts Only</SelectItem>
                            <SelectItem value="featured">Featured Only</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {books.length === 0 ? (
                    <Card className="py-16 sm:py-20 border-none shadow-lg bg-linear-to-br from-card to-muted/20">
                        <CardContent className="flex flex-col items-center justify-center text-center px-4">
                            <div className="size-16 sm:size-20 rounded-2xl bg-muted/50 flex items-center justify-center mb-4 sm:mb-6">
                                <BookOpen className="w-8 h-8 sm:w-10 sm:h-10 text-muted-foreground" />
                            </div>
                            <h3 className="text-lg sm:text-xl font-semibold mb-2">
                                {books.length === 0 ? "No books yet" : "No books found"}
                            </h3>
                            <p className="text-sm sm:text-base text-muted-foreground mb-6 max-w-md">
                                {books.length === 0 ? "Get started by creating your first book" : "Try adjusting your search or filter"}
                            </p>
                            {books.length === 0 && (
                                <Button size="lg" onClick={() => setIsAddOpen(true)} className="shadow-lg">
                                    <Plus className="w-4 h-4 mr-2" />
                                    Add Your First Book
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                        {books.map((book) => (
                            <Card
                                key={book.id}
                                className="group overflow-hidden border-none shadow-md hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 bg-card"
                            >
                                <div className="relative aspect-2/3 bg-linear-to-br from-muted/50 to-muted overflow-hidden">
                                    {book.coverImage ? (
                                        <img
                                            src={`${process.env.NEXT_PUBLIC_API_BASE}/media/${book.coverImage}/thumbnail`}
                                            alt={book.title || "Book cover"}
                                            className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
                                            loading="lazy"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <BookOpen className="w-16 h-16 text-muted-foreground/30" />
                                        </div>
                                    )}
                                    <div className="absolute top-3 space-x-2 right-3">
                                        <Badge
                                            variant={book.isPublished ? "default" : "secondary"}
                                            className={
                                                book.isPublished ? "bg-emerald-500 hover:bg-emerald-600 shadow-lg" : "bg-muted shadow-lg"
                                            }
                                        >
                                            {book.isPublished ? "Published" : "Draft"}
                                        </Badge>
                                        {book.isFeatured && (
                                            <Badge variant="default" className="bg-amber-500 shadow-lg px-1 text-xs">
                                                <Star />
                                            </Badge>
                                        )}
                                    </div>
                                    {book.type && (
                                        <div className="absolute top-3 left-3">
                                            <Badge variant="secondary" className="bg-background/90 backdrop-blur-sm shadow-lg text-xs">
                                                {book.type.name}
                                            </Badge>
                                        </div>
                                    )}
                                </div>

                                <CardHeader className="p-4 pb-3 space-y-2">
                                    <CardTitle className="line-clamp-2 text-base sm:text-lg leading-tight group-hover:text-primary transition-colors">
                                        {book.title}
                                    </CardTitle>
                                    {book.author && <CardDescription className="text-xs line-clamp-1">by {book.author}</CardDescription>}
                                </CardHeader>

                                <CardContent className="p-4 pt-0 space-y-4">
                                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                        <div className="flex items-center gap-1 bg-muted/50 rounded-full px-2 py-1">
                                            <Layers className="w-3 h-3" />
                                            <span>{book._count?.chapters || 0} ch</span>
                                        </div>
                                        <div className="flex items-center gap-1 bg-muted/50 rounded-full px-2 py-1">
                                            <Calendar className="w-3 h-3" />
                                            <span>
                        {new Date(book.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                                        </div>
                                    </div>

                                    {(book.genres ?? []).length > 0 && (
                                        <div className="flex flex-wrap gap-1.5">
                                            {(book.genres ?? []).slice(0, 2).map((g) => (
                                                <Badge key={g.genre.id} variant="outline" className="text-xs px-2 py-0.5">
                                                    {g.genre.name}
                                                </Badge>
                                            ))}
                                            {(book.genres ?? []).length > 2 && (
                                                <Badge variant="outline" className="text-xs px-2 py-0.5">
                                                    +{(book.genres ?? []).length - 2}
                                                </Badge>
                                            )}
                                        </div>
                                    )}

                                    <div className="flex gap-2 pt-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="flex-1 h-9 bg-transparent"
                                            onClick={() => {
                                                loadBookDetails(book)
                                                setIsDetailsOpen(true)
                                            }}
                                        >
                                            <Eye className="w-3.5 h-3.5 sm:mr-1" />
                                            <span className="hidden sm:inline">View</span>
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="flex-1 h-9 bg-transparent"
                                            onClick={() => {
                                                setEditBook({
                                                    title: book.title,
                                                    author: book.author ?? "",
                                                    type: book.type?.slug ?? bookTypes[0]?.slug ?? "",
                                                    description: book.description ?? "",
                                                    coverImage: book.coverImage ?? "",
                                                    genreIds: book.genres?.map((g) => g.genre.id) ?? [],
                                                    isPublished: book.isPublished,
                                                    isFeatured: book.isFeatured,
                                                })
                                                loadBookDetails(book)
                                                setIsEditOpen(true)
                                            }}
                                        >
                                            <Edit className="w-3.5 h-3.5 sm:mr-1" />
                                            <span className="hidden sm:inline">Edit</span>
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="px-3 h-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                                            onClick={() => handleDeleteBookClick(book.id)}
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
                <AdminPagination
                    currentPage={page}
                    totalPages={totalPages}
                    totalItems={stats.total}
                    pageSize={ITEMS_PER_PAGE}
                    itemLabel="books"
                    onPageChange={setPage}
                    canGoPrevious={page > 1}
                    canGoNext={page < totalPages}
                />
                <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                    <DialogContent className="w-[calc(100vw-2rem)] sm:w-full sm:max-w-3xl md:max-w-4xl lg:max-w-5xl max-h-[90vh] overflow-y-auto">
                        {selectedBook && (
                            <>
                                <DialogHeader className="text-left pr-8 sm:pr-0 space-y-2">
                                    <DialogTitle className="text-xl sm:text-2xl font-bold leading-snug">{selectedBook.title}</DialogTitle>
                                    {selectedBook.author && (
                                        <DialogDescription className="text-base">by {selectedBook.author}</DialogDescription>
                                    )}
                                </DialogHeader>
                                <div className="space-y-6 py-4">
                                    <div className="grid md:grid-cols-[auto_1fr] gap-6">
                                        {selectedBook.coverImage && (
                                            <div className="space-y-2">
                                                <h3 className="font-semibold text-sm text-muted-foreground">Cover Image</h3>
                                                <img
                                                    src={`${process.env.NEXT_PUBLIC_API_BASE}/media/${selectedBook.coverImage}`}
                                                    alt={selectedBook.title || "Book cover"}
                                                    className="w-full max-w-50 sm:max-w-62.5 aspect-2/3 object-cover rounded-lg border shadow-lg mx-auto md:mx-0"
                                                />
                                            </div>
                                        )}
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <h3 className="font-semibold text-sm text-muted-foreground mb-2">Status</h3>
                                                    <Badge variant={selectedBook.isPublished ? "default" : "outline"} className="text-sm mr-2 mb-2">
                                                        {selectedBook.isPublished ? "Published" : "Draft"}
                                                    </Badge>
                                                    {selectedBook.isFeatured && (
                                                        <Badge variant="default" className="bg-amber-500 shadow-lg text-sm">
                                                            Featured
                                                        </Badge>
                                                    )}
                                                </div>
                                                <div>
                                                    <h3 className="font-semibold text-sm text-muted-foreground mb-2">Type</h3>
                                                    <Badge variant="secondary" className="text-sm">
                                                        {selectedBook.type?.name ?? "N/A"}
                                                    </Badge>
                                                </div>
                                                <div>
                                                    <h3 className="font-semibold text-sm text-muted-foreground mb-2">Chapters</h3>
                                                    <p className="text-sm font-medium">{chapters.length}</p>
                                                </div>
                                            </div>

                                            <div>
                                                <h3 className="font-semibold text-sm text-muted-foreground mb-2">Genres</h3>
                                                <div className="flex flex-wrap gap-2">
                                                    {(selectedBook.genres ?? []).map((g) => (
                                                        <Badge key={g.genre.id} variant="secondary">
                                                            {g.genre.name}
                                                        </Badge>
                                                    ))}
                                                    {(selectedBook.genres ?? []).length === 0 && (
                                                        <span className="text-sm text-muted-foreground">No genres</span>
                                                    )}
                                                </div>
                                            </div>

                                            <div>
                                                <h3 className="font-semibold text-sm text-muted-foreground mb-2">Last Updated</h3>
                                                <p className="text-sm">{new Date(selectedBook.updatedAt).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {selectedBook.description && (
                                        <div>
                                            <h3 className="font-semibold text-sm text-muted-foreground mb-2">Description</h3>
                                            <p className="text-sm leading-relaxed whitespace-pre-wrap bg-muted/30 p-4 rounded-lg">
                                                {selectedBook.description}
                                            </p>
                                        </div>
                                    )}

                                    <div className="border-t pt-6">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                                            <h3 className="font-semibold text-lg">Chapters ({chapters.length})</h3>
                                            <Button
                                                size="sm"
                                                onClick={() => {
                                                    setNewChapter((prev) => ({ ...prev, index: chapters.length + 1 }))
                                                    setIsChapterDialogOpen(true)
                                                }}
                                            >
                                                <Plus className="w-4 h-4 mr-1" />
                                                Add Chapter
                                            </Button>
                                        </div>
                                        {chapters.length === 0 ? (
                                            <div className="text-center py-12 border-2 border-dashed rounded-lg bg-muted/20">
                                                <Layers className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
                                                <p className="text-sm text-muted-foreground">
                                                    No chapters yet. Add your first chapter to get started.
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                                {chapters.map((chapter) => (
                                                    <Card key={chapter.id} className="hover:shadow-md transition-shadow border">
                                                        <CardContent className="p-4">
                                                            <div className="flex items-start justify-between gap-3 mb-3">
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center gap-2 mb-2">
                                                                        <Badge variant="outline" className="text-xs font-mono">
                                                                            #{chapter.index}
                                                                        </Badge>
                                                                        <Badge
                                                                            variant={chapter.isFree ? "secondary" : "default"}
                                                                            className={chapter.isFree ? "" : "bg-emerald-500 hover:bg-emerald-600"}
                                                                        >
                                                                            {chapter.isFree ? "Free" : `$${chapter.price ?? 0}`}
                                                                        </Badge>
                                                                    </div>
                                                                    <h4 className="font-medium text-sm line-clamp-2 leading-snug mb-2">
                                                                        {chapter.title}
                                                                    </h4>
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-2 pt-2 border-t">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="flex-1 h-8 text-xs"
                                                                    onClick={() => {
                                                                        setChapterEditing(chapter)
                                                                        setEditChapter({
                                                                            title: chapter.title,
                                                                            index: chapter.index,
                                                                            price: chapter.price ?? 0,
                                                                            isFree: chapter.isFree,
                                                                            contentPath: chapter.contentPath ?? "",
                                                                        })
                                                                        setIsEditChapterOpen(true)
                                                                    }}
                                                                >
                                                                    <Edit className="w-3 h-3 mr-1" />
                                                                    Edit
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="px-3 h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                                    onClick={() => handleDeleteChapterClick(chapter.id)}
                                                                >
                                                                    <Trash2 className="w-3 h-3" />
                                                                </Button>
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </DialogContent>
                </Dialog>

                {/* Edit Book Dialog */}
                <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                    <DialogContent className="sm:max-w-137.5 max-h-[90vh] overflow-y-auto">
                        {selectedBook && (
                            <>
                                <DialogHeader>
                                    <DialogTitle>Edit Book</DialogTitle>
                                    <DialogDescription>Update book details</DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2 col-span-2">
                                            <Label htmlFor="edit-title">Title *</Label>
                                            <Input
                                                id="edit-title"
                                                value={editBook.title}
                                                onChange={(e) => setEditBook({ ...editBook, title: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="edit-author">Author</Label>
                                            <Input
                                                id="edit-author"
                                                value={editBook.author}
                                                onChange={(e) => setEditBook({ ...editBook, author: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Type</Label>
                                            <Select
                                                value={editBook.type}
                                                onValueChange={(v) => setEditBook({ ...editBook, type: v })}
                                                disabled={isLoadingTypes || bookTypes.length === 0}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {bookTypes.map((t) => (
                                                        <SelectItem key={t.id} value={t.slug}>
                                                            {t.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="edit-description">Description</Label>
                                        <Textarea
                                            id="edit-description"
                                            value={editBook.description}
                                            onChange={(e) => setEditBook({ ...editBook, description: e.target.value })}
                                            rows={3}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Cover Image</Label>

                                        <div className="flex items-center gap-3">
                                            <Button type="button" variant="outline" onClick={() => setEditCoverPickerOpen(true)}>
                                                <ImageIcon className="size-4 mr-2" />
                                                Select cover
                                            </Button>

                                            {editBook.coverImage ? (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    onClick={() => {
                                                        setEditBook((p) => ({ ...p, coverImage: "" }))
                                                        setEditCoverLabel(selectedBook.coverImage ?? "")
                                                    }}
                                                >
                                                    Remove
                                                </Button>
                                            ) : (
                                                <span className="text-xs text-muted-foreground">No cover selected</span>
                                            )}
                                        </div>

                                        {editBook.coverImage && (
                                            <div className="flex items-center gap-3 rounded-lg border p-3 bg-muted/20">
                                                <img
                                                    src={`${process.env.NEXT_PUBLIC_API_BASE}/media/${editBook.coverImage}/thumbnail`}
                                                    alt={editCoverLabel || "image"}
                                                    className="w-14 h-14 rounded-md object-cover border"
                                                    loading="lazy"
                                                />
                                                <div className="min-w-0">
                                                    <div className="text-sm font-medium truncate">{editCoverLabel || "Selected cover"}</div>
                                                    <code className="text-[11px] text-muted-foreground font-mono truncate block">{editBook.coverImage}</code>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Genres *</Label>
                                        <div className="grid grid-cols-2 gap-2 max-h-40 overflow-auto border rounded-lg p-3 bg-muted/20">
                                            {genres.map((g) => {
                                                const checked = editBook.genreIds.includes(g.id)
                                                return (
                                                    <label
                                                        key={g.id}
                                                        className="flex items-center gap-2 text-sm cursor-pointer hover:bg-accent/50 p-2 rounded"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            onChange={() => {
                                                                setEditBook((prev) => ({
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
                                    </div>
                                    <div className="flex items-center space-x-2 p-3 bg-muted/30 rounded-lg">
                                        <input
                                            type="checkbox"
                                            id="edit-published"
                                            checked={editBook.isPublished}
                                            onChange={(e) => setEditBook({ ...editBook, isPublished: e.target.checked })}
                                            className="w-4 h-4"
                                        />
                                        <Label htmlFor="edit-published" className="cursor-pointer">
                                            Published
                                        </Label>
                                    </div>
                                    <div className="flex items-center space-x-2 p-3 bg-muted/30 rounded-lg">
                                        <input
                                            type="checkbox"
                                            id="is-featured"
                                            checked={editBook.isFeatured}
                                            onChange={(e) => setEditBook({ ...editBook, isFeatured: e.target.checked })}
                                            className="w-4 h-4"
                                        />
                                        <Label htmlFor="is-featured" className="cursor-pointer">
                                            Mark as featured
                                        </Label>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                                        Cancel
                                    </Button>
                                    <Button onClick={handleUpdateBook}>Save Changes</Button>
                                </DialogFooter>
                            </>
                        )}
                    </DialogContent>
                </Dialog>

                {/* Add Chapter Dialog */}
                <Dialog open={isChapterDialogOpen} onOpenChange={setIsChapterDialogOpen}>
                    <DialogContent className="sm:max-w-150 max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Add New Chapter</DialogTitle>
                            <DialogDescription>Create a new chapter for this book</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-6 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2 col-span-2">
                                    <Label htmlFor="chapter-title">Chapter Title *</Label>
                                    <Input
                                        id="chapter-title"
                                        value={newChapter.title}
                                        onChange={(e) => setNewChapter({ ...newChapter, title: e.target.value })}
                                        placeholder="Enter chapter title"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="chapter-index">Chapter Number *</Label>
                                    <Input
                                        id="chapter-index"
                                        type="number"
                                        value={newChapter.index}
                                        onChange={(e) => setNewChapter({ ...newChapter, index: Number.parseInt(e.target.value) || 0 })}
                                    />
                                </div>

                                {!newChapter.isFree && (
                                    <div className="space-y-2">
                                        <Label htmlFor="chapter-price">Price ($)</Label>
                                        <Input
                                            id="chapter-price"
                                            type="number"
                                            step="0.01"
                                            value={newChapter.price}
                                            onChange={(e) => setNewChapter({ ...newChapter, price: Number(e.target.value) })}
                                            placeholder="0.99"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="chapter-content">Content Path *</Label>
                                <Input
                                    id="chapter-content"
                                    value={newChapter.contentPath}
                                    onChange={(e) => setNewChapter({ ...newChapter, contentPath: e.target.value })}
                                    placeholder="path/to/chapter-content.md"
                                />
                            </div>

                            <div className="space-y-3 p-4 bg-muted/30 rounded-lg border">
                                <h4 className="text-sm font-semibold">Pricing Options</h4>
                                <div className="flex items-start gap-3">
                                    <input
                                        type="checkbox"
                                        id="chapter-free"
                                        checked={newChapter.isFree}
                                        onChange={(e) => setNewChapter({ ...newChapter, isFree: e.target.checked })}
                                        className="w-4 h-4 mt-0.5"
                                    />
                                    <div className="flex-1">
                                        <Label htmlFor="chapter-free" className="cursor-pointer">
                                            Free Chapter
                                        </Label>
                                        <p className="text-xs text-muted-foreground mt-1">This chapter can be read without payment</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsChapterDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleAddChapter}>Add Chapter</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Edit Chapter Dialog */}
                <Dialog open={isEditChapterOpen} onOpenChange={setIsEditChapterOpen}>
                    <DialogContent className="sm:max-w-150 max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Edit Chapter</DialogTitle>
                            <DialogDescription>Update chapter details and pricing</DialogDescription>
                        </DialogHeader>

                        <div className="space-y-6 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2 col-span-2">
                                    <Label htmlFor="edit-chapter-title">Chapter Title *</Label>
                                    <Input
                                        id="edit-chapter-title"
                                        value={editChapter.title}
                                        onChange={(e) => setEditChapter({ ...editChapter, title: e.target.value })}
                                        placeholder="Enter chapter title"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="edit-chapter-index">Chapter Number *</Label>
                                    <Input
                                        id="edit-chapter-index"
                                        type="number"
                                        value={editChapter.index}
                                        onChange={(e) =>
                                            setEditChapter({ ...editChapter, index: Number.parseInt(e.target.value, 10) || 1 })
                                        }
                                    />
                                </div>

                                {!editChapter.isFree && (
                                    <div className="space-y-2">
                                        <Label htmlFor="edit-chapter-price">Price ($)</Label>
                                        <Input
                                            id="edit-chapter-price"
                                            type="number"
                                            step="0.01"
                                            value={editChapter.price}
                                            onChange={(e) => setEditChapter({ ...editChapter, price: Number(e.target.value) })}
                                            placeholder="0.99"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="edit-chapter-content">Content Path</Label>
                                <Input
                                    id="edit-chapter-content"
                                    value={editChapter.contentPath}
                                    onChange={(e) => setEditChapter({ ...editChapter, contentPath: e.target.value })}
                                    placeholder="path/to/chapter-content.md"
                                />
                            </div>

                            <div className="space-y-3 p-4 bg-muted/30 rounded-lg border">
                                <h4 className="text-sm font-semibold">Pricing Options</h4>
                                <div className="flex items-start gap-3">
                                    <input
                                        type="checkbox"
                                        id="edit-chapter-free"
                                        checked={editChapter.isFree}
                                        onChange={(e) => setEditChapter({ ...editChapter, isFree: e.target.checked })}
                                        className="w-4 h-4 mt-0.5"
                                    />
                                    <div className="flex-1">
                                        <Label htmlFor="edit-chapter-free" className="cursor-pointer">
                                            Free Chapter
                                        </Label>
                                        <p className="text-xs text-muted-foreground mt-1">This chapter can be read without payment</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsEditChapterOpen(false)}>
                                Cancel
                            </Button>
                            <Button
                                onClick={async () => {
                                    if (!selectedBook || !chapterEditing) return
                                    const t = editChapter.title.trim()
                                    if (!t) return toast({ title: "Error", description: "Title is required", variant: "destructive" })

                                    const payload: any = {
                                        title: t,
                                        index: editChapter.index,
                                        isFree: editChapter.isFree,
                                        contentPath: editChapter.contentPath.trim() || undefined,
                                    }

                                    if (!editChapter.isFree) payload.price = Number(editChapter.price || 0).toFixed(2)

                                    try {
                                        const data = await apiClient.patch<Chapter>(
                                            `/books/${selectedBook.id}/chapters/${chapterEditing.id}`,
                                            payload,
                                        )

                                        setChapters((prev) => prev.map((c) => (c.id === chapterEditing.id ? { ...c, ...data } : c)))
                                        setIsEditChapterOpen(false)
                                        setChapterEditing(null)
                                    } catch (error) {
                                        toast({
                                            title: "Error",
                                            description: getApiErrorMessage(error, "Failed to update chapter"),
                                            variant: "destructive",
                                        })
                                    }
                                }}
                            >
                                Save Changes
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <AlertDialog open={deleteBookDialogOpen} onOpenChange={setDeleteBookDialogOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete Book</AlertDialogTitle>
                            <AlertDialogDescription>
                                Are you sure you want to delete this book? This action cannot be undone and will permanently remove the
                                book and all its chapters.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    if (isSubmitting) return false;
                                    setBookToDelete(null);
                                    setDeleteBookDialogOpen(false)
                                }}
                                disabled={isSubmitting}
                                className={`${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleDeleteBookConfirm}
                                disabled={isSubmitting}
                                className={`bg-destructive text-destructive-foreground hover:bg-destructive/90 ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
                            >
                                {isSubmitting ? "Deleting..." : "Delete"}
                            </Button>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <AlertDialog open={deleteChapterDialogOpen} onOpenChange={setDeleteChapterDialogOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete Chapter</AlertDialogTitle>
                            <AlertDialogDescription>
                                Are you sure you want to delete this chapter? This action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    if (isSubmitting) return false;
                                    setChapterToDelete(null);
                                    setDeleteChapterDialogOpen(false)
                                }}
                                disabled={isSubmitting}
                                className={`${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleDeleteChapterConfirm}
                                disabled={isSubmitting}
                                className={`bg-destructive text-destructive-foreground hover:bg-destructive/90 ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
                            >
                                {isSubmitting ? "Deleting..." : "Delete"}
                            </Button>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
                <MediaPicker
                    open={newCoverPickerOpen}
                    onOpenChangeAction={setNewCoverPickerOpen}
                    value={newBook.coverImage || null}
                    onSelectAction={(item) => {
                        setNewBook((p) => ({ ...p, coverImage: item?.code ?? "" }))
                        setNewCoverLabel(item?.filename ?? "")
                    }}
                />

                <MediaPicker
                    open={editCoverPickerOpen}
                    onOpenChangeAction={setEditCoverPickerOpen}
                    value={editBook.coverImage || null}
                    onSelectAction={(item) => {
                        setEditBook((p) => ({ ...p, coverImage: item?.code ?? "" }))
                        setEditCoverLabel(item?.filename ?? "")
                    }}
                />
            </div>
        </div>
    )
}
