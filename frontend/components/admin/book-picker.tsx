import * as React from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, Check, X, Loader2, Star } from "lucide-react"
import { useTranslations } from "next-intl"
import { getBookCoverThumbnailUrl } from "@/lib/media"
import type { BookCardData } from "@/lib/types"
import { AppPagination } from "@/components/app-pagination"

export type BookPickerProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    books: BookCardData[]
    value?: number | null
    onSelect: (book: BookCardData | null) => void
    isLoading?: boolean
    title?: string
    description?: string
    allowClear?: boolean
    searchQuery: string
    onSearchChange: (query: string) => void
    page: number
    onPageChange: (page: number) => void
    totalItems: number
    totalPages: number
    limit?: number
}

export function BookPicker({
                               open,
                               onOpenChange,
                               books,
                               value,
                               onSelect,
                               isLoading = false,
                               title,
                               description,
                               allowClear = true,
                               searchQuery,
                               onSearchChange,
                               page,
                               onPageChange,
                               totalItems,
                               totalPages,
                               limit = 12,
                           }: BookPickerProps) {
    const t = useTranslations('AdminPage.BookPicker')
    const paginationScrollRef = React.useRef<HTMLDivElement>(null)

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[calc(100vw-2rem)] sm:w-full sm:max-w-5xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-center">{title || t("SelectBook")}</DialogTitle>
                    {description && (
                        <DialogDescription className="text-center">{description}</DialogDescription>
                    )}
                </DialogHeader>

                <div className="relative mt-2">
                    <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder={t("SearchBookPlaceholder")}
                        className="ps-9 h-11"
                    />
                </div>

                <div ref={paginationScrollRef} className="relative mt-4 min-h-75">
                    {isLoading ? (
                        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/60 backdrop-blur-sm">
                            <Loader2 className="size-6 animate-spin text-primary" />
                        </div>
                    ) : books.length === 0 ? (
                        <div className="py-16 text-center text-sm text-muted-foreground flex flex-col items-center justify-center h-full">
                            {searchQuery.trim() ? t("NoBooksFoundMatch") : t("NoBooksProvided")}
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {books.map((book) => {
                                const isSelected = value === book.id

                                return (
                                    <button
                                        key={book.id}
                                        type="button"
                                        onClick={() => {
                                            onSelect(book)
                                            onOpenChange(false)
                                        }}
                                        className={[
                                            "group text-left relative flex flex-col overflow-hidden rounded-xl border bg-card hover:shadow-md transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                            isSelected ? "ring-2 ring-primary border-primary" : "border-border",
                                        ].join(" ")}
                                    >
                                        <div className="aspect-2/3 w-full bg-muted relative overflow-hidden">
                                            <img
                                                src={book.coverImage ? getBookCoverThumbnailUrl(book.coverImage) : "/placeholder.svg"}
                                                alt={book.title}
                                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                                loading="lazy"
                                            />

                                            <div className="absolute inset-0 bg-linear-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                                            {book.type && (
                                                <div className="absolute left-2 top-2 z-10">
                                                    <Badge variant="secondary" className="bg-background/80 text-[10px] px-1.5 py-0.5 shadow-sm">
                                                        {book.type.name}
                                                    </Badge>
                                                </div>
                                            )}

                                            {isSelected && (
                                                <div className="absolute top-2 right-2 z-10 rounded-full bg-primary text-primary-foreground p-1 shadow-md animate-in zoom-in">
                                                    <Check className="size-4" />
                                                </div>
                                            )}
                                        </div>

                                        <div className="p-3 flex flex-col gap-1 border-t bg-card/50">
                                            <h3 className="line-clamp-2 text-sm font-semibold leading-snug group-hover:text-primary transition-colors">
                                                {book.title}
                                            </h3>

                                            {book.contributors && (
                                                <p className="line-clamp-1 text-xs text-muted-foreground">
                                                    {book.contributors}
                                                </p>
                                            )}

                                            {book.ratingAvg !== undefined && book.ratingAvg > 0 && (
                                                <div className="flex items-center gap-1 mt-1">
                                                    <Star className="size-3 fill-amber-500 text-amber-500" />
                                                    <span className="text-xs font-medium">{book.ratingAvg}</span>
                                                </div>
                                            )}
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </div>

                <div className="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t pt-4">
                    <div className="flex items-center gap-2">
                        {allowClear && (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    onSelect(null)
                                    onOpenChange(false)
                                }}
                            >
                                <X className="size-4 me-2" />
                                {t("ClearSelection")}
                            </Button>
                        )}
                    </div>

                    {totalPages > 1 && (
                        <AppPagination
                            currentPage={page}
                            totalPages={totalPages}
                            totalItems={totalItems}
                            pageSize={limit}
                            itemLabel={t("BooksLabel") || "Book"}
                            onPageChange={onPageChange}
                            canGoPrevious={page > 1}
                            canGoNext={page < totalPages}
                            scrollTarget={paginationScrollRef}
                        />
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}