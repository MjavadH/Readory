"use client"

import * as React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { apiClient, getApiErrorMessage } from "@/lib/api-client"
import { Search, Loader2, ChevronLeft, ChevronRight, Check, X } from "lucide-react"
import { useToast } from "@/providers/toast-provider";

export type MediaItem = {
    code: string
    filename: string
    createdAt?: string
    size?: number
}

type PagedMediaResponse = {
    items: MediaItem[]
    page: number
    limit: number
    total: number
    totalPages: number
}

type MediaPickerProps = {
    open: boolean
    onOpenChangeAction: (open: boolean) => void
    value?: string | null // selected media code
    onSelectAction: (item: MediaItem | null) => void
    title?: string
    description?: string
    itemsPerPage?: number
    allowClear?: boolean
}

export function MediaPicker({
                                open,
                                onOpenChangeAction,
                                value,
                                onSelectAction,
                                title = "Select cover",
                                description = "Choose an image from your media library",
                                itemsPerPage = 30,
                                allowClear = true,
                            }: MediaPickerProps) {
    const toast = useToast()
    const [q, setQ] = useState("")
    const [page, setPage] = useState(1)

    const [items, setItems] = useState<MediaItem[]>([])
    const [total, setTotal] = useState(0)
    const [totalPages, setTotalPages] = useState(1)

    const [isLoading, setIsLoading] = useState(false)
    const [hasLoadedOnce, setHasLoadedOnce] = useState(false)

    // tiny in-memory cache to reduce pressure when navigating pages back/forth
    const cacheRef = useRef(new Map<string, PagedMediaResponse>())

    useEffect(() => {
        if (!open) return
        setPage(1)
    }, [open])

    useEffect(() => {
        setPage(1)
    }, [q])

    useEffect(() => {
        if (!open) return

        const controller = new AbortController()

        const run = async () => {
            setIsLoading(true)
            try {
                const qs = new URLSearchParams()
                const query = q.trim()
                if (query) qs.set("q", query)
                qs.set("page", String(page))
                qs.set("limit", String(itemsPerPage))

                const cacheKey = qs.toString()
                const cached = cacheRef.current.get(cacheKey)
                if (cached) {
                    setItems(cached.items)
                    setTotal(cached.total)
                    setTotalPages(Math.max(1, cached.totalPages))
                    setHasLoadedOnce(true)
                    return
                }

                const data = await apiClient.get<MediaItem[] | PagedMediaResponse>(`/media?${qs.toString()}`, {
                    signal: controller.signal,
                })

                const normalized: PagedMediaResponse = Array.isArray(data)
                    ? { items: data, page: 1, limit: itemsPerPage, total: data.length, totalPages: 1 }
                    : {
                        items: Array.isArray(data.items) ? data.items : [],
                        page: Number(data.page) || page,
                        limit: Number(data.limit) || itemsPerPage,
                        total: Number(data.total) || 0,
                        totalPages: Number(data.totalPages) || 1,
                    }

                cacheRef.current.set(cacheKey, normalized)
                setItems(normalized.items)
                setTotal(normalized.total)
                setTotalPages(Math.max(1, normalized.totalPages))
                setHasLoadedOnce(true)
            } catch (e: any) {
                if (e?.name !== "AbortError") {
                    toast.error(getApiErrorMessage(e))
                }
            } finally {
                setIsLoading(false)
            }
        }

        void run()
        return () => controller.abort()
    }, [open, q, page, itemsPerPage, toast])

    const pageNumbers = useMemo(() => {
        const tp = totalPages
        const p = page
        const len = Math.min(5, tp)
        const nums: number[] = []

        if (tp <= 5) {
            for (let i = 1; i <= tp; i++) nums.push(i)
            return nums
        }
        if (p <= 3) {
            for (let i = 1; i <= len; i++) nums.push(i)
            return nums
        }
        if (p >= tp - 2) {
            for (let i = tp - 4; i <= tp; i++) nums.push(i)
            return nums
        }
        for (let i = p - 2; i <= p + 2; i++) nums.push(i)
        return nums
    }, [page, totalPages])

    const apiBase = process.env.NEXT_PUBLIC_API_BASE

    return (
        <Dialog open={open} onOpenChange={onOpenChangeAction}>
            <DialogContent className="w-[calc(100vw-2rem)] sm:w-full sm:max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>

                {/* Search */}
                <div className="relative mt-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by filename..." className="pl-9 h-11" />
                </div>

                {/* Grid */}
                <div className="relative mt-4">
                    {isLoading && hasLoadedOnce && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/60 backdrop-blur-sm">
                            <Loader2 className="size-6 animate-spin" />
                        </div>
                    )}

                    {/* First load skeleton */}
                    {isLoading && !hasLoadedOnce ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                            {Array.from({ length: 10 }).map((_, i) => (
                                <div key={i} className="overflow-hidden rounded-xl border bg-card">
                                    <div className="aspect-square bg-muted animate-pulse" />
                                    <div className="p-2.5 space-y-2">
                                        <div className="h-3 bg-muted animate-pulse rounded" />
                                        <div className="h-3 bg-muted animate-pulse rounded w-2/3 mx-auto" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : items.length === 0 ? (
                        <div className="py-16 text-center text-sm text-muted-foreground">
                            {q.trim() ? "No media found for this search." : "No media uploaded yet."}
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                            {items.map((m) => {
                                const selected = (value ?? "") === m.code
                                return (
                                    <button
                                        key={m.code}
                                        type="button"
                                        onClick={() => {
                                            onSelectAction(m)
                                            onOpenChangeAction(false)
                                        }}
                                        className={[
                                            "group text-left overflow-hidden rounded-xl border bg-card hover:shadow-lg transition",
                                            selected ? "ring-2 ring-primary border-primary/40" : "border-border",
                                        ].join(" ")}
                                    >
                                        <div className="aspect-2/3 bg-muted relative">
                                            <img
                                                src={`${apiBase}/media/${m.code}/thumbnail`}
                                                alt={m.filename || "image"}
                                                className="w-full h-full object-cover"
                                                loading="lazy"
                                            />
                                            {selected && (
                                                <div className="absolute top-2 right-2 rounded-full bg-primary text-primary-foreground p-1 shadow">
                                                    <Check className="size-4" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-2.5 border-t bg-muted/20 space-y-1">
                                            <div className="text-xs font-medium truncate text-center">{m.filename}</div>
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Footer: clear + pagination */}
                <div className="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-2">
                        {allowClear && (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    onSelectAction(null)
                                    onOpenChangeAction(false)
                                }}
                            >
                                <X className="size-4 mr-2" />
                                No cover
                            </Button>
                        )}
                        <p className="text-xs text-muted-foreground">
                            {totalPages > 1 ? (
                                <>
                                    Page <span className="font-semibold text-foreground">{page}</span> /{" "}
                                    <span className="font-semibold text-foreground">{totalPages}</span> • Total{" "}
                                    <span className="font-semibold text-foreground">{total}</span>
                                </>
                            ) : (
                                <>
                                    Total <span className="font-semibold text-foreground">{total || items.length}</span>
                                </>
                            )}
                        </p>
                    </div>

                    {totalPages > 1 && (
                        <div className="flex items-center justify-end gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={isLoading || page === 1}
                            >
                                <ChevronLeft className="size-4 mr-1" />
                                Prev
                            </Button>

                            <div className="hidden sm:flex items-center gap-1">
                                {pageNumbers.map((n) => (
                                    <Button
                                        key={n}
                                        type="button"
                                        variant={n === page ? "default" : "outline"}
                                        size="sm"
                                        className="w-9"
                                        onClick={() => setPage(n)}
                                        disabled={isLoading}
                                    >
                                        {n}
                                    </Button>
                                ))}
                            </div>

                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                disabled={isLoading || page >= totalPages}
                            >
                                Next
                                <ChevronRight className="size-4 ml-1" />
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
