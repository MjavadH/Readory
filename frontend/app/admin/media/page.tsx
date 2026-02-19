"use client"

import type React from "react"
import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { AppPagination } from "@/components/app-pagination"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Upload,
  ImageIcon,
  Search,
  Trash2,
  Loader2,
  Pencil,
  X,
  CheckCircle2,
  AlertCircle,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { apiClient, getApiErrorMessage } from "@/lib/api-client"

type MediaItem = {
  code: string
  filename: string
  createdAt?: string
  size: number
}

type PagedMediaResponse = {
  items: MediaItem[]
  page: number
  limit: number
  total: number
  totalPages: number
}

const ITEMS_PER_PAGE = 30
const MAX_UPLOAD_FILES = 10

function isAllowedImage(file: File) {
  return file.type === "image/jpeg" || file.type === "image/webp"
}

export default function AdminMedia() {
  const { toast } = useToast()

  const [isGalleryLoading, setIsGalleryLoading] = useState(true)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)
  const [files, setFiles] = useState<MediaItem[]>([])
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [refreshNonce, setRefreshNonce] = useState(0)

  const [searchQuery, setSearchQuery] = useState("")
  const [isDragging, setIsDragging] = useState(false)

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [fileToDelete, setFileToDelete] = useState<string | null>(null)
  const [deletingCode, setDeletingCode] = useState<string | null>(null)

  const [renameDialogOpen, setRenameDialogOpen] = useState(false)
  const [fileToRename, setFileToRename] = useState<MediaItem | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [renamingCode, setRenamingCode] = useState<string | null>(null)

  const [isUploading, setIsUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // Reset pagination when search changes
  useEffect(() => {
    setPage(1)
  }, [searchQuery])

  // Fetch paged data
  useEffect(() => {
    const controller = new AbortController()
    setIsGalleryLoading(true)

    const t = setTimeout(async () => {
      try {
        const q = searchQuery.trim()
        const qs = new URLSearchParams()
        if (q) qs.set("q", q)
        qs.set("page", String(page))
        qs.set("limit", String(ITEMS_PER_PAGE))

        const data = await apiClient
            .get<MediaItem[] | PagedMediaResponse>(`/media?${qs.toString()}`, { signal: controller.signal })
            .catch(
                () =>
                    ({
                      items: [],
                      total: 0,
                      totalPages: 1,
                      page: 1,
                      limit: ITEMS_PER_PAGE,
                    }) as PagedMediaResponse,
            )

        if (Array.isArray(data)) {
          // fallback compatibility
          setFiles(data)
          setTotal(data.length)
          setTotalPages(1)
        } else {
          setFiles(Array.isArray(data.items) ? data.items : [])
          setTotal(Number(data.total) || 0)
          setTotalPages(Math.max(1, Number(data.totalPages) || 1))
        }
        if (!hasLoadedOnce) setHasLoadedOnce(true)
      } catch (e: any) {
        if (e?.name !== "AbortError") {
          toast({ title: "Error", description: getApiErrorMessage(e), variant: "destructive" })
        }
      } finally {
        setIsGalleryLoading(false)
      }
    }, 250)

    return () => {
      controller.abort()
      clearTimeout(t)
    }
  }, [searchQuery, page, refreshNonce, toast, hasLoadedOnce])

  const selectedSize = useMemo(() => {
    return selectedFiles.reduce((acc, f) => acc + (f.size || 0), 0)
  }, [selectedFiles])

  const handleUpload = async () => {
    if (!selectedFiles.length) return

    setIsUploading(true)
    setUploadSuccess(false)
    setUploadError(null)

    try {
      const formData = new FormData()
      for (const f of selectedFiles) formData.append("files", f)

      const data = await apiClient.post<{ items: MediaItem[]; failed?: { name: string; reason: string }[] }>(
          "/media",
          formData,
      )

      toast({ title: "Success", description: `Uploaded ${data.items.length} file(s)` })

      if (data.failed?.length) {
        toast({
          title: "Some files failed",
          description: data.failed.slice(0, 2).map((x) => `${x.name}: ${x.reason}`).join(" • "),
          variant: "destructive",
        })
      }

      setUploadSuccess(true)

      // Refresh list (even if already on page 1)
      setPage(1)
      setRefreshNonce((n) => n + 1)

      setTimeout(() => {
        setSelectedFiles([])
        setUploadSuccess(false)
      }, 1200)
    } catch (error) {
      const message = getApiErrorMessage(error, "Network error occurred")
      setUploadError(message)
      toast({ title: "Error", description: message, variant: "destructive" })
    } finally {
      setIsUploading(false)
    }
  }

  const handleRenameClick = (item: MediaItem) => {
    setFileToRename(item)
    setRenameValue(item.filename)
    setRenameDialogOpen(true)
  }

  const handleRenameConfirm = async () => {
    if (!fileToRename) return

    const next = renameValue.trim()
    if (!next) {
      return toast({ title: "Error", description: "Filename is required", variant: "destructive" })
    }

    setRenamingCode(fileToRename.code)
    try {
      const data = await apiClient.patch<{ filename: string }>(`/media/${fileToRename.code}`, { filename: next })

      setFiles((prev) => prev.map((f) => (f.code === fileToRename.code ? { ...f, filename: data.filename } : f)))
      setRenameDialogOpen(false)
      setFileToRename(null)
      toast({ title: "Success", description: "File renamed successfully" })
    } catch (err: any) {
      toast({ title: "Error", description: getApiErrorMessage(err), variant: "destructive" })
    } finally {
      setRenamingCode(null)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const applySelectedFiles = (incoming: File[]) => {
    const allowed = incoming.filter(isAllowedImage)
    const blockedCount = incoming.length - allowed.length

    let next = allowed
    let err: string | null = null

    if (blockedCount > 0) err = "Only JPG/JPEG/WebP are allowed"
    if (allowed.length > MAX_UPLOAD_FILES) {
      next = allowed.slice(0, MAX_UPLOAD_FILES)
      err = `Maximum ${MAX_UPLOAD_FILES} files per upload`
    }
    if (!next.length) err = err ?? "Please select valid images"

    setSelectedFiles(next)
    setUploadError(err)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    applySelectedFiles(Array.from(e.dataTransfer.files ?? []))
  }

  const handleDeleteClick = (code: string) => {
    setFileToDelete(code)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!fileToDelete) return
    setDeletingCode(fileToDelete)

    try {
      await apiClient.delete(`/media/${fileToDelete}`)
      toast({ title: "Deleted", description: "File deleted successfully" })

      // Optimistic removal + adjust pagination if page becomes empty
      setFiles((prev) => prev.filter((f) => f.code !== fileToDelete))
      setTotal((t) => Math.max(0, t - 1))

      // If we deleted the last item on this page, go back a page
      if (files.length === 1 && page > 1) {
        setPage((p) => Math.max(1, p - 1))
      } else {
        setRefreshNonce((n) => n + 1)
      }
    } catch (err: any) {
      toast({ title: "Error", description: getApiErrorMessage(err), variant: "destructive" })
    } finally {
      setDeletingCode(null)
      setDeleteDialogOpen(false)
      setFileToDelete(null)
    }
  }

  return (
      <div className="min-h-screen bg-linear-to-br from-background via-background to-muted/20">
        <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
          {/* Header */}
          <div className="space-y-2">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight bg-linear-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Media Library
            </h1>
            <p className="text-muted-foreground">Upload and manage your media assets</p>
          </div>

          {/* Upload */}
          <Card className="border-primary/20 overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="size-5" />
                Upload New Images
              </CardTitle>
              <CardDescription>Drag & drop or click to browse. Supports JPG, JPEG, WebP</CardDescription>
            </CardHeader>

            <CardContent className="p-6 space-y-4">
              {selectedFiles.length === 0 && (
                  <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      className={`
                  relative border-2 border-dashed rounded-xl p-8 md:p-12 text-center transition-all duration-300
                  ${
                          isDragging
                              ? "border-primary bg-primary/10 scale-[1.02] shadow-lg"
                              : "border-border hover:border-primary/50 hover:bg-muted/30"
                      }
                `}
                  >
                    <div className="flex flex-col items-center gap-4">
                      <div
                          className={`
                      flex size-16 md:size-20 items-center justify-center rounded-full transition-all duration-300
                      ${isDragging ? "bg-primary/20 ring-4 ring-primary/30 scale-110" : "bg-muted ring-2 ring-border"}
                    `}
                      >
                        <Upload className={`size-8 md:size-10 transition-colors ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
                      </div>

                      <div className="space-y-2">
                        <p className="text-base md:text-lg font-semibold">
                          {isDragging ? "Drop your images here" : "Drag & drop your images"}
                        </p>
                        <p className="text-sm text-muted-foreground">or</p>
                      </div>

                      <input
                          type="file"
                          multiple
                          accept=".jpg,.jpeg,.webp"
                          onChange={(e) => applySelectedFiles(Array.from(e.target.files ?? []))}
                          className="hidden"
                          id="file-upload"
                      />

                      <label htmlFor="file-upload">
                        <Button variant="default" size="lg" className="cursor-pointer" asChild>
                      <span>
                        <ImageIcon className="size-4 mr-2" />
                        Browse Files
                      </span>
                        </Button>
                      </label>
                    </div>

                    {uploadError && (
                        <div className="mt-4 flex items-center justify-center gap-2 text-sm text-destructive">
                          <AlertCircle className="size-4" />
                          {uploadError}
                        </div>
                    )}
                  </div>
              )}

              {selectedFiles.length > 0 && (
                  <div className="space-y-4">
                    <div
                        className={`
                    relative overflow-hidden rounded-xl border-2 transition-all duration-300
                    ${uploadSuccess ? "border-green-500 bg-green-50 dark:bg-green-950/20" : "border-border bg-muted/30"}
                    ${isUploading ? "animate-pulse" : ""}
                  `}
                    >
                      <div className="flex items-start gap-4 p-4">
                        <div
                            className={`
                        relative flex size-16 items-center justify-center rounded-lg ring-2 transition-all shrink-0
                        ${uploadSuccess ? "bg-green-100 dark:bg-green-900/30 ring-green-500" : "bg-primary/10 ring-primary/30"}
                      `}
                        >
                          {uploadSuccess ? (
                              <CheckCircle2 className="size-8 text-green-600 dark:text-green-400" />
                          ) : (
                              <ImageIcon className="size-8 text-primary" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold">{selectedFiles.length} file(s) selected</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            ~{(selectedSize / 1024).toFixed(1)} KB
                            {isUploading && " • Uploading..."}
                            {uploadSuccess && " • Upload complete!"}
                          </p>

                          <div className="mt-3 grid gap-2">
                            {selectedFiles.slice(0, 5).map((f) => (
                                <div key={f.name + f.size} className="flex items-center justify-between gap-2 text-xs">
                                  <span className="truncate">{f.name}</span>
                                  {!isUploading && !uploadSuccess && (
                                      <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7"
                                          onClick={() => setSelectedFiles((prev) => prev.filter((x) => x !== f))}
                                      >
                                        <X className="size-3.5" />
                                      </Button>
                                  )}
                                </div>
                            ))}
                            {selectedFiles.length > 5 && (
                                <p className="text-xs text-muted-foreground">+{selectedFiles.length - 5} more…</p>
                            )}
                          </div>
                        </div>

                        {!isUploading && !uploadSuccess && (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setSelectedFiles([])
                                  setUploadError(null)
                                }}
                                className="shrink-0"
                            >
                              <X className="size-4" />
                            </Button>
                        )}
                      </div>

                      {isUploading && (
                          <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary/20">
                            <div className="h-full bg-primary animate-pulse w-full" />
                          </div>
                      )}
                    </div>

                    {!uploadSuccess && (
                        <div className="flex gap-3">
                          <Button onClick={handleUpload} disabled={isUploading} className="flex-1" size="lg">
                            {isUploading ? (
                                <>
                                  <Loader2 className="size-4 mr-2 animate-spin" />
                                  Uploading...
                                </>
                            ) : (
                                <>
                                  <Upload className="size-4 mr-2" />
                                  Upload {selectedFiles.length} file(s)
                                </>
                            )}
                          </Button>

                          <Button
                              variant="outline"
                              onClick={() => {
                                setSelectedFiles([])
                                setUploadError(null)
                              }}
                              disabled={isUploading}
                              size="lg"
                          >
                            Cancel
                          </Button>
                        </div>
                    )}

                    {uploadError && (
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                          <AlertCircle className="size-4 shrink-0" />
                          <span>{uploadError}</span>
                        </div>
                    )}
                  </div>
              )}
            </CardContent>
          </Card>

          {/* Gallery */}
          <Card className="border-primary/20">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CardTitle>Media Gallery</CardTitle>
                    <span className="inline-flex items-center rounded-full border bg-muted/40 px-2.5 py-0.5 text-xs font-medium">
                    Total: {total.toLocaleString()}
                  </span>
                  </div>
                  <CardDescription className="mt-1">Browse and manage your uploaded images</CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4 md:p-6 space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search by filename..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-11"
                />
              </div>

              {/* Image Grid */}
              <div className="relative">
                {/* Overlay spinner only after first load */}
                {isGalleryLoading && hasLoadedOnce && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/60 backdrop-blur-sm">
                      <Loader2 className="size-6 animate-spin" />
                    </div>
                )}

                {/* First load: skeleton grid */}
                {isGalleryLoading && !hasLoadedOnce ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 md:gap-4">
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
                ) : files.length === 0 ? (
                    <div className="text-center py-16 md:py-20">
                      <div className="flex size-16 md:size-20 items-center justify-center mx-auto mb-4 rounded-full bg-muted">
                        <ImageIcon className="size-8 md:size-10 text-muted-foreground/50" />
                      </div>
                      <p className="text-sm md:text-base font-medium text-muted-foreground mb-1">
                        {searchQuery ? "No images found" : "No images uploaded yet"}
                      </p>
                      <p className="text-xs md:text-sm text-muted-foreground/70">
                        {searchQuery ? "Try a different search term" : "Upload your first image to get started"}
                      </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 md:gap-4">
                      {files.map((file) => (
                          <div
                              key={file.code}
                              className="group relative overflow-hidden rounded-xl border-2 border-border bg-card hover:shadow-xl hover:border-primary/30 hover:scale-[1.02] transition-all duration-300"
                          >
                            <div className="aspect-2/3 relative bg-muted">
                              <Image
                                  src={`${process.env.NEXT_PUBLIC_API_BASE}/media/${file.code}/thumbnail`}
                                  alt={file.filename || "Image"}
                                  fill
                                  className="object-cover"
                                  sizes="(max-width: 480px) 45vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 200px"
                                  unoptimized
                              />
                              <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/0 to-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                              <div
                                  className="absolute left-2 right-2 bottom-2
                                  sm:left-auto sm:right-2 sm:top-2 sm:bottom-auto
                                  flex flex-row sm:flex-col gap-1.5 opacity-100 sm:opacity-0
                                  sm:group-hover:opacity-100 sm:group-focus-within:opacity-100
                                  pointer-events-auto sm:pointer-events-none sm:group-hover:pointer-events-auto
                                  sm:group-focus-within:pointer-events-auto transition-opacity duration-300"
                              >
                                <Button
                                    size="icon"
                                    variant="secondary"
                                    className="size-8 bg-background/95 hover:bg-background shadow-lg backdrop-blur-sm"
                                    onClick={() => handleRenameClick(file)}
                                    disabled={renamingCode === file.code}
                                >
                                  {renamingCode === file.code ? (
                                      <Loader2 className="size-3.5 animate-spin" />
                                  ) : (
                                      <Pencil className="size-3.5" />
                                  )}
                                </Button>
                                <Button
                                    size="icon"
                                    variant="destructive"
                                    className="size-8 shadow-lg"
                                    onClick={() => handleDeleteClick(file.code)}
                                    disabled={deletingCode === file.code}
                                >
                                  {deletingCode === file.code ? (
                                      <Loader2 className="size-3.5 animate-spin" />
                                  ) : (
                                      <Trash2 className="size-3.5" />
                                  )}
                                </Button>
                              </div>
                            </div>
                            <div className="p-2.5 bg-linear-to-r from-muted/50 to-muted/30 border-t space-y-1">
                              <div className="text-xs font-medium truncate text-center">{file.filename}</div>
                            </div>
                          </div>
                      ))}
                    </div>
                )}
              </div>

              <AppPagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={total}
                pageSize={ITEMS_PER_PAGE}
                itemLabel="media items"
                onPageChange={setPage}
                canGoPrevious={!isGalleryLoading && page > 1}
                canGoNext={!isGalleryLoading && page < totalPages}
              />
            </CardContent>
          </Card>

          {/* Rename Dialog */}
          <AlertDialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Rename Media</AlertDialogTitle>
                <AlertDialogDescription>
                  Set a human-friendly unique filename (letters, numbers, space, dash, underscore).
                </AlertDialogDescription>
              </AlertDialogHeader>

              <div className="space-y-2">
                <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
              </div>

              <AlertDialogFooter>
                <AlertDialogCancel disabled={!!renamingCode}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleRenameConfirm} disabled={!!renamingCode}>
                  {renamingCode ? "Saving..." : "Save"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Delete Dialog */}
          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Media File</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this image? This action cannot be undone and will permanently remove the
                  file from your media library.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={!!deletingCode}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteConfirm} disabled={!!deletingCode}>
                  {deletingCode ? "Deleting..." : "Delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
  )
}
