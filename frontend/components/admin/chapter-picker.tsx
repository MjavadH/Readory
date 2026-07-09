import * as React from "react"
import { useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, Check, X, Loader2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { AppPagination } from "@/components/app-pagination"

// Based on the response of chapters.service.ts -> listChapters
export type ChapterItemData = {
    id: number
    title: string | null
    index: number
    price?: number | null
    isFree?: boolean
    publishStatus?: string
    updatedAt?: string
}

export type ChapterPickerProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    chapters: ChapterItemData[]
    value?: number | null
    onSelect: (chapter: ChapterItemData | null) => void
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

export function ChapterPicker({
                                  open,
                                  onOpenChange,
                                  chapters,
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
                                  limit = 50, // Chapters usually have larger limits
                              }: ChapterPickerProps) {
    const t = useTranslations('AdminPage.ChapterPicker')
    const paginationScrollRef = React.useRef<HTMLDivElement>(null)

    // Clear search when closed
    useEffect(() => {
        if (!open) {
            onSearchChange("")
            onPageChange(1)
        }
    }, [open, onSearchChange, onPageChange])

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[calc(100vw-2rem)] sm:w-full sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-center">{title || t("SelectChapter")}</DialogTitle>
                    {description && (
                        <DialogDescription className="text-center">{description}</DialogDescription>
                    )}
                </DialogHeader>

                <div className="relative mt-2">
                    <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder={t("SearchChapterPlaceholder")}
                        className="ps-9 h-11"
                    />
                </div>

                <div ref={paginationScrollRef} className="relative mt-4 min-h-75">
                    {isLoading ? (
                        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/60 backdrop-blur-sm">
                            <Loader2 className="size-6 animate-spin text-primary" />
                        </div>
                    ) : chapters.length === 0 ? (
                        <div className="py-16 text-center text-sm text-muted-foreground flex flex-col items-center justify-center h-full">
                            {searchQuery.trim() ? t("NoChaptersFoundMatch") : t("NoChaptersProvided")}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {chapters.map((chapter) => {
                                const isSelected = value === chapter.id

                                return (
                                    <button
                                        key={chapter.id}
                                        type="button"
                                        onClick={() => {
                                            onSelect(chapter)
                                            onOpenChange(false)
                                        }}
                                        className={[
                                            "group relative flex items-center gap-3 p-3 text-left overflow-hidden rounded-xl border bg-card hover:shadow-sm transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                            isSelected ? "ring-2 ring-primary border-primary bg-primary/5" : "border-border",
                                        ].join(" ")}
                                    >
                                        {/* Chapter Index Badge */}
                                        <div className={[
                                            "flex flex-col items-center justify-center min-w-12 h-12 rounded-lg font-bold text-lg",
                                            isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors"
                                        ].join(" ")}>
                                            <span className="text-[10px] uppercase font-medium opacity-80 -mb-1">{t("Ch")}</span>
                                            {chapter.index}
                                        </div>

                                        {/* Chapter Details */}
                                        <div className="flex-1 flex flex-col overflow-hidden">
                                            <span className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
                                                {chapter.title || `${t("Chapter")} ${chapter.index}`}
                                            </span>

                                            <div className="flex items-center gap-1.5 mt-1">
                                                {chapter.publishStatus && (
                                                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
                                                        {chapter.publishStatus}
                                                    </Badge>
                                                )}
                                                {chapter.isFree && (
                                                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                                                        {t("Free")}
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>

                                        {/* Selection Indicator */}
                                        {isSelected && (
                                            <div className="shrink-0 text-primary animate-in zoom-in">
                                                <Check className="size-5" />
                                            </div>
                                        )}
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
                            itemLabel={t("ChaptersLabel") || "Chapter"}
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