"use client"

import type React from "react"
import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
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
  Copy,
  Check,
  Search,
  HardDrive,
  FileImage,
  Trash2,
  Loader2,
  Pencil,
  X,
  CheckCircle2,
  AlertCircle,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

type MediaItem = {
  code: string
  filename: string
  createdAt?: string
  size: number
}

export default function AdminMedia() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [files, setFiles] = useState<MediaItem[]>([])
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
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

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)

    const t = setTimeout(async () => {
      try {
        const q = searchQuery.trim()
        const qs = q ? `?q=${encodeURIComponent(q)}` : ""
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/media${qs}`, {
          credentials: "include",
          signal: controller.signal,
        })

        const data = await res.json().catch(() => [])
        const list = Array.isArray(data) ? data : Array.isArray(data.data) ? data.data : []
        setFiles(list)
      } catch (e: any) {
        if (e?.name !== "AbortError") {
          // ignore
        }
      } finally {
        setLoading(false)
      }
    }, 250)

    return () => {
      controller.abort()
      clearTimeout(t)
    }
  }, [searchQuery])

  const handleUpload = async () => {
    if (!selectedFile) return

    setIsUploading(true)
    setUploadSuccess(false)
    setUploadError(null)

    try {
      const formData = new FormData()
      formData.append("file", selectedFile)
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/media`, {
        method: "POST",
        credentials: "include",
        body: formData,
      })
      const data = await res.json().catch(() => ({}))

      if (res.ok) {
        const created: MediaItem = { code: data.code, filename: data.filename, size: data.size }
        setFiles((prev) => [created, ...prev])
        setUploadSuccess(true)
        toast({ title: "Success", description: "Image uploaded successfully" })
        setTimeout(() => {
          setSelectedFile(null)
          setUploadSuccess(false)
        }, 2000)
      } else {
        setUploadError(data.message || "Upload failed")
        toast({ title: "Error", description: data.message || "Upload failed", variant: "destructive" })
      }
    } catch (error) {
      setUploadError("Network error occurred")
      toast({ title: "Error", description: "Network error", variant: "destructive" })
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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/media/${fileToRename.code}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: next }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.message || "Rename failed")
      }

      setFiles((prev) => prev.map((f) => (f.code === fileToRename.code ? { ...f, filename: data.filename } : f)))
      setRenameDialogOpen(false)
      setFileToRename(null)
      toast({ title: "Success", description: "File renamed successfully" })
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
      setRenamingCode(null)
    }
  }

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && (file.type === "image/jpeg" || file.type === "image/webp")) {
      setSelectedFile(file)
      setUploadError(null)
    } else {
      setUploadError("Please upload a JPG, JPEG, or WebP image")
    }
  }

  const handleDeleteClick = (code: string) => {
    setFileToDelete(code)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!fileToDelete) return

    setDeletingCode(fileToDelete)

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/media/${fileToDelete}`, {
        method: "DELETE",
        credentials: "include",
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data.message || "Delete failed")
      }

      setFiles((prev) => prev.filter((f) => f.code !== fileToDelete))
      toast({ title: "Deleted", description: "File deleted successfully" })
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
      setDeletingCode(null)
      setDeleteDialogOpen(false)
      setFileToDelete(null)
    }
  }

  const filteredFiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return files
    return files.filter((file) => (file.filename || "").toLowerCase().includes(q))
  }, [files, searchQuery])

  const totalSize = useMemo(() => {
    return files.reduce((acc, item) => {
      const size = Number(item.size) || 0
      return acc + size
    }, 0)
  }, [files])


  if (loading) {
    return (
        <div className="p-4 sm:p-6 space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight bg-linear-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Media Library
            </h1>
            <p className="text-muted-foreground">Upload and manage your media assets</p>
          </div>
          <div className="animate-pulse space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="h-32 bg-muted rounded-xl" />
              <div className="h-32 bg-muted rounded-xl" />
            </div>
            <div className="h-120 bg-muted rounded-xl" />
            <div className="h-100 bg-muted rounded-xl" />
          </div>
        </div>
    )
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

          {/* Stats Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card className="border-border/50 bg-linear-to-br from-blue-500/5 to-blue-500/10">
              <CardContent className="flex items-center gap-4 py-4">
                <div className="flex size-12 items-center justify-center rounded-xl bg-blue-500/10 ring-1 ring-blue-500/20">
                  <FileImage className="size-6 text-blue-600 dark:text-blue-500" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground font-medium">Total Images</p>
                  <p className="text-xl sm:text-2xl font-bold">{files.length}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-linear-to-br from-purple-500/5 to-purple-500/10">
              <CardContent className="flex items-center gap-4 py-4">
                <div className="flex size-12 items-center justify-center rounded-xl bg-purple-500/10 ring-1 ring-purple-500/20">
                  <HardDrive className="size-6 text-purple-600 dark:text-purple-500" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground font-medium">Storage Used</p>
                  <p className="text-xl sm:text-2xl font-bold">~{(totalSize / (1024 * 1024)).toFixed(1)} MB</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-primary/20 overflow-hidden">
            <CardHeader className="">
              <CardTitle className="flex items-center gap-2">
                <Upload className="size-5" />
                Upload New Image
              </CardTitle>
              <CardDescription>Drag & drop or click to browse. Supports JPG, JPEG, WebP</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {!selectedFile && (
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
                        <Upload
                            className={`size-8 md:size-10 transition-colors ${isDragging ? "text-primary" : "text-muted-foreground"}`}
                        />
                      </div>
                      <div className="space-y-2">
                        <p className="text-base md:text-lg font-semibold">
                          {isDragging ? "Drop your image here" : "Drag & drop your image"}
                        </p>
                        <p className="text-sm text-muted-foreground">or</p>
                      </div>
                      <input
                          type="file"
                          accept=".jpg,.jpeg,.webp"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) {
                              setSelectedFile(file)
                              setUploadError(null)
                            }
                          }}
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

              {selectedFile && (
                  <div className="space-y-4">
                    <div
                        className={`
                  relative overflow-hidden rounded-xl border-2 transition-all duration-300
                  ${uploadSuccess ? "border-green-500 bg-green-50 dark:bg-green-950/20" : "border-border bg-muted/30"}
                  ${isUploading ? "animate-pulse" : ""}
                `}
                    >
                      <div className="flex items-center gap-4 p-4">
                        <div
                            className={`
                      relative flex size-16 items-center justify-center rounded-lg ring-2 transition-all
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
                          <p className="text-sm font-semibold truncate">{selectedFile.name}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {(selectedFile.size / 1024).toFixed(1)} KB
                            {isUploading && " • Uploading..."}
                            {uploadSuccess && " • Upload complete!"}
                          </p>
                        </div>
                        {!isUploading && !uploadSuccess && (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setSelectedFile(null)
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
                                  Upload Image
                                </>
                            )}
                          </Button>
                          <Button
                              variant="outline"
                              onClick={() => {
                                setSelectedFile(null)
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

          {/* Search and Gallery */}
          <Card className="border-primary/20">
            <CardHeader className="">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle>Media Gallery</CardTitle>
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
              {filteredFiles.length === 0 ? (
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
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
                    {filteredFiles.map((file) => (
                        <div
                            key={file.code}
                            className="group relative overflow-hidden rounded-xl border-2 border-border bg-card hover:shadow-xl hover:border-primary/30 hover:scale-[1.02] transition-all duration-300"
                        >
                          <div className="aspect-square relative bg-muted">
                            <Image
                                src={`${process.env.NEXT_PUBLIC_API_BASE}/media/${file.code}/thumbnail`}
                                alt={file.filename || "Image"}
                                fill
                                className="object-cover"
                                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                                unoptimized
                            />
                            <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/0 to-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                            <div className="absolute top-2 right-2 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
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
                                  variant="secondary"
                                  className="size-8 bg-background/95 hover:bg-background shadow-lg backdrop-blur-sm"
                                  onClick={() => handleCopy(file.code)}
                              >
                                {copiedCode === file.code ? (
                                    <Check className="size-3.5 text-green-600" />
                                ) : (
                                    <Copy className="size-3.5" />
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
                            <code className="text-[9px] font-mono bg-background/80 px-1.5 py-0.5 rounded block truncate text-center text-muted-foreground">
                              {file.code}
                            </code>
                          </div>
                        </div>
                    ))}
                  </div>
              )}
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
                <Input
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    placeholder="e.g. home banner"
                />
                {fileToRename?.code && (
                    <p className="text-xs text-muted-foreground">
                      Code: <span className="font-mono">{fileToRename.code}</span>
                    </p>
                )}
              </div>

              <AlertDialogFooter>
                <AlertDialogCancel disabled={!!renamingCode}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleRenameConfirm} disabled={!!renamingCode}>
                  {renamingCode ? "Saving..." : "Save"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Delete Confirmation Dialog */}
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
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteConfirm}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
  )
}
