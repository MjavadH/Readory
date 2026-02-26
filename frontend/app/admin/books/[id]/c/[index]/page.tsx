"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle, ArrowLeft,
  BookOpen,
  Check,
  FileStack,
  FileText,
  FolderOpen,
  GitBranch,
  Hash,
  ImageIcon,
  Layers,
  Loader2,
  RefreshCcw,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { useToast } from "@/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { UploadProgressBar } from "@/components/admin/upload-progress-bar";
import { useParams } from "next/navigation";
import { AppPagination } from "@/components/app-pagination";
import { cn } from "@/lib/utils";
import Link from "next/link";

type ChapterMeta = {
  id: number;
  title: string;
  index: number;
  contentPath: string | null;
  contentType: "images" | "text" | null;
  pageCount: number;
  contentVersion: number;
  updatedAt: string;
};

type Manifest = {
  version: 1;
  format: "images" | "text";
  pageCount: number;
  pages: Array<{ key: string; w?: number; h?: number; sha256?: string }>;
};

type ChapterContentResponse = {
  chapter: ChapterMeta;
  manifest: Manifest | null;
  textPreviewHtml?: string | null;
};

type AdminPreviewSessionResponse = {
  sessionToken: string;
  pageCount: number;
  contentType: "images" | "text" | null;
  contentVersion: number;
  adminPreview: true;
};

// Skeleton
function PageSkeleton() {
  return (
      <div className="min-h-screen bg-background p-6 lg:p-10 space-y-6 max-w-6xl mx-auto">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-4 w-80" />
          </div>
          <div className="flex gap-2 pt-1">
            <Skeleton className="h-9 w-24 rounded-lg" />
            <Skeleton className="h-9 w-36 rounded-lg" />
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
  );
}

// Stat card
function StatCard({icon, label, value, mono = false, delay = 0,}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  delay?: number;
}) {
  return (
      <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay, duration: 0.38, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="group relative rounded-xl border border-border bg-card p-4 overflow-hidden hover:border-primary/30 transition-colors duration-200"
      >
        <div className="absolute inset-0 bg-linear-to-br from-primary/3 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
          <span className="text-primary/70">{icon}</span>
          {label}
        </div>
        <div className={cn("text-sm font-semibold truncate", mono && "font-mono text-xs")}>{value}</div>
      </motion.div>
  );
}

// Upload zone
function DropZone({label, hint, accept, multiple, disabled, fileName, fileCount, onChange,}: {
  label: string;
  hint: string;
  accept: string;
  multiple?: boolean;
  disabled?: boolean;
  fileName?: string;
  fileCount?: number;
  onChange: (files: FileList | null) => void;
}) {
  return (
      <label
          className={cn(
              "relative flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 px-6 py-8 text-center cursor-pointer transition-all duration-200",
              !disabled && "hover:border-primary/50 hover:bg-primary/3",
              disabled && "opacity-50 cursor-not-allowed"
          )}
      >
        <input
            type="file"
            accept={accept}
            multiple={multiple}
            disabled={disabled}
            className="sr-only"
            onChange={(e) => onChange(e.target.files)}
        />
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Upload className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>
        </div>
        {(fileName || fileCount !== undefined) && (
            <div className="flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs text-primary">
              <Check className="h-3 w-3" />
              {fileName ?? `${fileCount} file${fileCount !== 1 ? "s" : ""} selected`}
            </div>
        )}
      </label>
  );
}

// Section wrapper
function Section({title, subtitle, children, action,}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
      <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="rounded-2xl border border-border bg-card overflow-hidden"
      >
        <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          {action}
        </div>
        <div className="p-6">{children}</div>
      </motion.section>
  );
}

// Tab button
function TabBtn({active, icon, label, onClick,}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
      <button
          type="button"
          onClick={onClick}
          className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-150",
              active
                  ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
          )}
      >
        {icon}
        {label}
      </button>
  );
}

export default function ChapterContentManager() {
  const params = useParams<{ id: string; index: string }>();
  const toast = useToast();

  const bookId = Number(Array.isArray(params.id) ? params.id[0] : params.id);
  const chapterIndex = Number(Array.isArray(params.index) ? params.index[0] : params.index);

  const [data, setData] = useState<ChapterContentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeTab, setActiveTab] = useState<"images" | "text">("images");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [textFile, setTextFile] = useState<File | null>(null);
  const [imagePage, setImagePage] = useState(1);
  const [adminPreviewToken, setAdminPreviewToken] = useState<string | null>(null);
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedImagePages, setSelectedImagePages] = useState<number[]>([]);
  const [deletingImages, setDeletingImages] = useState(false);

  const canLoad =
      Number.isInteger(bookId) &&
      bookId > 0 &&
      Number.isInteger(chapterIndex) &&
      chapterIndex > 0;

  const loadContent = useCallback(async () => {
    if (!canLoad) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await apiClient.get<ChapterContentResponse>(
          `/admin/books/${bookId}/chapters/${chapterIndex}/content`
      );
      setData(response);
      setDeleteMode(false);
      setSelectedImagePages([]);

      if (response.manifest?.format === "images" && response.manifest.pageCount > 0) {
        try {
          const preview = await apiClient.post<AdminPreviewSessionResponse>(
              "/reader/admin/session",
              { bookId, chapterIndex }
          );
          setAdminPreviewToken(preview.sessionToken);
        } catch (error) {
          setAdminPreviewToken(null);
          toast.error(
              getApiErrorMessage(error, "Unable to create admin preview session."),
              "Preview unavailable"
          );
        }
      } else {
        setAdminPreviewToken(null);
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to fetch chapter content."));
    } finally {
      setLoading(false);
    }
  }, [bookId, chapterIndex, canLoad, toast]);

  useEffect(() => {
    void loadContent();
  }, [loadContent]);

  const pageSize = 24;
  const imagePages = data?.manifest?.format === "images" ? data.manifest.pages : [];
  const pagedImages = imagePages.slice((imagePage - 1) * pageSize, imagePage * pageSize);
  const totalImagePages = Math.max(1, Math.ceil(imagePages.length / pageSize));

  const uploadWithXhr = async (url: string, formData: FormData): Promise<void> =>
      new Promise((resolve, reject) => {
        const request = new XMLHttpRequest();
        const base = process.env.NEXT_PUBLIC_API_BASE ?? "";
        request.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            setProgress(Math.round((event.loaded / event.total) * 100));
          }
        };
        request.onerror = () => reject(new Error("Network upload error"));
        request.onload = () => {
          if (request.status >= 200 && request.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${request.status}`));
          }
        };
        request.open("POST", `${base}${url}`);
        request.withCredentials = true;
        request.send(formData);
      });

  const handleUploadImages = async (mode: "replace" | "append") => {
    if (imageFiles.length === 0) {
      toast.error("Select one or more image files.", "No files selected");
      return;
    }
    setUploading(true);
    setProgress(0);
    try {
      const formData = new FormData();
      imageFiles.forEach((file) => formData.append("files", file));
      const url =
          mode === "append"
              ? `/admin/books/${bookId}/chapters/${chapterIndex}/content/images/append`
              : `/admin/books/${bookId}/chapters/${chapterIndex}/content/images`;
      await uploadWithXhr(url, formData);
      toast.success(
          mode === "append"
              ? "Images appended successfully."
              : "Image content replaced successfully."
      );
      setImageFiles([]);
      await loadContent();
    } catch (error) {
      toast.error(
          getApiErrorMessage(error, "Please verify file count/size/type and try again."),
          mode === "append" ? "Append failed" : "Image upload failed"
      );
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const handleUploadText = async () => {
    if (!textFile) {
      toast.error("Select a .md or .txt file.", "No file selected");
      return;
    }
    setUploading(true);
    setProgress(0);
    try {
      const formData = new FormData();
      formData.append("file", textFile);
      await uploadWithXhr(
          `/admin/books/${bookId}/chapters/${chapterIndex}/content/text`,
          formData
      );
      toast.success("Text content uploaded");
      setTextFile(null);
      await loadContent();
    } catch (error) {
      toast.error(
          getApiErrorMessage(error, "Unable to upload text content."),
          "Text upload failed"
      );
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const handleDeleteAll = async () => {
    setDeleting(true);
    try {
      await apiClient.delete(
          `/admin/books/${bookId}/chapters/${chapterIndex}/content`
      );
      toast.success("All chapter content has been removed.");
      await loadContent();
    } catch (error) {
      toast.error(
          getApiErrorMessage(error, "Could not delete chapter content."),
          "Delete failed"
      );
    } finally {
      setDeleting(false);
    }
  };

  const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? "";
  const buildAdminPreviewImageUrl = (pageNumber: number) =>
      `${apiBase}/reader/page?token=${encodeURIComponent(adminPreviewToken ?? "")}&p=${pageNumber}`;

  const absolutePageNumber = (pageIndexInCurrentPage: number) =>
      (imagePage - 1) * pageSize + pageIndexInCurrentPage + 1;

  const selectedImagePageSet = useMemo(
      () => new Set(selectedImagePages),
      [selectedImagePages]
  );

  const toggleImageSelection = (pageNumber: number) => {
    setSelectedImagePages((prev) =>
        prev.includes(pageNumber)
            ? prev.filter((p) => p !== pageNumber)
            : [...prev, pageNumber].sort((a, b) => a - b)
    );
  };

  const currentPagedPageNumbers = useMemo(
      () => pagedImages.map((_, idx) => absolutePageNumber(idx)),
      [pagedImages, imagePage]
  );

  const selectedCountOnCurrentPage = useMemo(
      () => currentPagedPageNumbers.filter((p) => selectedImagePageSet.has(p)).length,
      [currentPagedPageNumbers, selectedImagePageSet]
  );

  const toggleSelectCurrentPage = () => {
    const allSelected =
        currentPagedPageNumbers.length > 0 &&
        currentPagedPageNumbers.every((p) => selectedImagePageSet.has(p));
    if (allSelected) {
      setSelectedImagePages((prev) =>
          prev.filter((p) => !currentPagedPageNumbers.includes(p))
      );
      return;
    }
    setSelectedImagePages((prev) =>
        Array.from(new Set([...prev, ...currentPagedPageNumbers])).sort(
            (a, b) => a - b
        )
    );
  };

  const handleDeleteSelectedImages = async () => {
    if (selectedImagePages.length === 0) {
      toast.error("No images selected.", "Nothing to delete");
      return;
    }
    setDeletingImages(true);
    try {
      await apiClient.delete(
          `/admin/books/${bookId}/chapters/${chapterIndex}/content/images`,
          { body: { pageNumbers: selectedImagePages } }
      );
      toast.success(`${selectedImagePages.length} image(s) deleted.`);
      setDeleteMode(false);
      setSelectedImagePages([]);
      await loadContent();
    } catch (error) {
      toast.error(
          getApiErrorMessage(error, "Could not delete selected images."),
          "Delete failed"
      );
    } finally {
      setDeletingImages(false);
    }
  };

  useEffect(() => {
    if (imagePage > totalImagePages) setImagePage(totalImagePages);
  }, [imagePage, totalImagePages]);

  const metadataRows = useMemo(() => {
    if (!data) return [];
    return [
      {
        icon: <BookOpen className="h-3.5 w-3.5" />,
        label: "Chapter",
        value: `${data.chapter.index} — ${data.chapter.title}`,
      },
      {
        icon: <Layers className="h-3.5 w-3.5" />,
        label: "Content Type",
        value: data.chapter.contentType ?? "none",
      },
      {
        icon: <Hash className="h-3.5 w-3.5" />,
        label: "Page Count",
        value: String(data.chapter.pageCount ?? 0),
      },
      {
        icon: <GitBranch className="h-3.5 w-3.5" />,
        label: "Content Version",
        value: `v${data.chapter.contentVersion ?? 0}`,
      },
      {
        icon: <FolderOpen className="h-3.5 w-3.5" />,
        label: "Storage Prefix",
        value: data.chapter.contentPath ?? `b${bookId}/c${chapterIndex}`,
        mono: true,
      },
      {
        icon: <FileStack className="h-3.5 w-3.5" />,
        label: "Manifest",
        value: data.manifest ? (
            <span className="flex items-center gap-1.5">
            <Badge
                variant="outline"
                className="font-mono text-xs px-1.5 py-0 h-5"
            >
              v{data.manifest.version}
            </Badge>
            <Badge className="text-xs px-1.5 py-0 h-5 bg-primary/15 text-primary border-primary/20">
              {data.manifest.format}
            </Badge>
            <span>{data.manifest.pageCount}p</span>
          </span>
        ) : (
            <span className="text-muted-foreground text-xs">No manifest</span>
        ),
      },
    ];
  }, [data, bookId, chapterIndex]);

  const isBusy = loading || uploading || deleting || deletingImages;

  // Guard: invalid params
  if (!canLoad) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-8">
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-8 max-w-sm text-center space-y-3">
            <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
            <p className="font-semibold text-foreground">Invalid route</p>
            <p className="text-sm text-muted-foreground">
              The book or chapter path is invalid.
            </p>
          </div>
        </div>
    );
  }

  if (loading) return <PageSkeleton />;

  return (
      <div className="min-h-screen bg-background">
        <div className="relative max-w-6xl mx-auto px-6 py-10 space-y-8">

          {/* Header */}
          <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="flex flex-wrap items-start justify-between gap-4"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1 hover:text-blue-500">
                <ArrowLeft className="h-3.5 w-3.5" />
                <Link href={`/admin/books/${bookId}`}>Go Back</Link>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                Chapter Content Manager
              </h1>
              <p className="text-sm text-muted-foreground">
                Manage uploads, manifests, and page previews for this chapter.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 border-border/60"
                  onClick={loadContent}
                  disabled={isBusy}
              >
                <RefreshCcw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
                Refresh
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                      variant="destructive"
                      size="sm"
                      className="gap-2"
                      disabled={isBusy}
                  >
                    {deleting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                    )}
                    Delete all
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete all chapter content?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This removes every object under the chapter prefix and resets the manifest. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteAll}>Confirm delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </motion.div>

          {/* Metadata grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {metadataRows.map((row, i) => (
                <StatCard
                    key={row.label}
                    icon={row.icon}
                    label={row.label}
                    value={row.value}
                    mono={row.mono}
                    delay={i * 0.05}
                />
            ))}
          </div>

          {/* Upload */}
          <Section title="Upload Content" subtitle="Replace or append chapter content">
            {/* Tab switcher */}
            <div className="flex items-center gap-1 rounded-lg bg-muted/60 border border-border p-1 w-fit mb-6">
              <TabBtn
                  active={activeTab === "images"}
                  icon={<ImageIcon className="h-3.5 w-3.5" />}
                  label="Images"
                  onClick={() => setActiveTab("images")}
              />
              <TabBtn
                  active={activeTab === "text"}
                  icon={<FileText className="h-3.5 w-3.5" />}
                  label="Text"
                  onClick={() => setActiveTab("text")}
              />
            </div>

            <AnimatePresence mode="wait">
              {activeTab === "images" && (
                  <motion.div
                      key="images"
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 6 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-4"
                  >
                    <p className="text-xs text-muted-foreground">
                      Upload JPG / PNG / WebP files. The server normalises them to WebP.
                      You can replace all content or append new pages to the end.
                    </p>

                    <DropZone
                        label="Select image files"
                        hint="JPG, PNG or WebP — multiple allowed"
                        accept="image/png,image/jpeg,image/webp"
                        multiple
                        disabled={uploading}
                        fileCount={imageFiles.length || undefined}
                        onChange={(files) => setImageFiles(Array.from(files ?? []))}
                    />

                    {uploading && <UploadProgressBar value={progress} />}

                    <div className="flex flex-wrap gap-2">
                      <Button
                          size="sm"
                          className="gap-2"
                          onClick={() => handleUploadImages("append")}
                          disabled={
                              isBusy ||
                              data?.chapter.contentType === "text"
                          }
                      >
                        {uploading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <Upload className="h-3.5 w-3.5" />
                        )}
                        Append images
                      </Button>
                      <Button
                          size="sm"
                          variant="outline"
                          className="gap-2"
                          onClick={() => handleUploadImages("replace")}
                          disabled={isBusy}
                      >
                        {uploading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <RefreshCcw className="h-3.5 w-3.5" />
                        )}
                        Replace all
                      </Button>
                    </div>

                    {data?.chapter.contentType === "text" && (
                        <p className="flex items-center gap-1.5 text-xs text-amber-400">
                          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                          Append disabled — chapter has text content. Use &quot;Replace all&quot; to switch type.
                        </p>
                    )}
                  </motion.div>
              )}

              {activeTab === "text" && (
                  <motion.div
                      key="text"
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 6 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-4"
                  >
                    <p className="text-xs text-muted-foreground">
                      Upload chapter text as Markdown or plain text (.md / .txt).
                    </p>

                    <DropZone
                        label="Select text file"
                        hint=".md or .txt"
                        accept=".md,.txt,text/plain,text/markdown"
                        disabled={uploading}
                        fileName={textFile?.name}
                        onChange={(files) => setTextFile(files?.[0] ?? null)}
                    />

                    {uploading && <UploadProgressBar value={progress} />}

                    <Button
                        size="sm"
                        className="gap-2"
                        onClick={handleUploadText}
                        disabled={isBusy}
                    >
                      {uploading ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                          <Upload className="h-3.5 w-3.5" />
                      )}
                      Upload text
                    </Button>
                  </motion.div>
              )}
            </AnimatePresence>
          </Section>

          {/* Current Content */}
          <Section title="Current Content"
              subtitle={
                data?.manifest
                    ? `${data.manifest.format} · ${data.manifest.pageCount} page${data.manifest.pageCount !== 1 ? "s" : ""}`
                    : "No content uploaded yet"
              }
              action={data?.manifest?.format === "images" && imagePages.length > 0 ? (
                  <div className="flex items-center gap-2">
                    {deleteMode ? (
                        <>
                          <span className="text-xs text-muted-foreground">
                            {selectedImagePages.length} selected
                          </span>
                          <Button
                              size="sm"
                              variant="ghost"
                              className="gap-1.5 h-7 px-2 text-xs"
                              onClick={toggleSelectCurrentPage}
                              disabled={deletingImages}
                          >
                            {selectedCountOnCurrentPage === currentPagedPageNumbers.length &&
                            currentPagedPageNumbers.length > 0
                                ? "Deselect page"
                                : "Select page"}
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                  size="sm"
                                  variant="destructive"
                                  className="gap-1.5 h-7 px-2.5 text-xs"
                                  disabled={deletingImages || selectedImagePages.length === 0}
                              >
                                {deletingImages ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                    <Trash2 className="h-3 w-3" />
                                )}
                                Delete ({selectedImagePages.length})
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete selected images?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {selectedImagePages.length} page(s) will be permanently removed.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel disabled={deletingImages}>
                                  Cancel
                                </AlertDialogCancel>
                                <AlertDialogAction onClick={handleDeleteSelectedImages}>
                                  Confirm delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          <Button
                              size="sm"
                              variant="ghost"
                              className="gap-1.5 h-7 px-2 text-xs text-muted-foreground"
                              onClick={() => {
                                setDeleteMode(false);
                                setSelectedImagePages([]);
                              }}
                              disabled={deletingImages}
                          >
                            <X className="h-3 w-3" />
                            Cancel
                          </Button>
                        </>
                    ) : (
                        <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 h-7 px-2.5 text-xs border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => {
                              setDeleteMode(true);
                              setSelectedImagePages([]);
                            }}
                            disabled={isBusy}
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete images
                        </Button>
                    )}
                  </div>
              ) : undefined
          }
          >
            {!data?.manifest && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-16 text-muted-foreground"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <AlertCircle className="h-5 w-5" />
                  </div>
                  <p className="text-sm">No manifest or content uploaded yet.</p>
                </motion.div>
            )}

            {data?.manifest?.format === "text" && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-3"
                >
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="h-4 w-4 text-primary" />
                    <span>Text chapter uploaded</span>
                    <Badge variant="outline" className="text-xs font-mono px-1.5 py-0 h-5">
                      {data.manifest.format}
                    </Badge>
                  </div>
                  {data.textPreviewHtml && (
                      <div
                          className="rounded-xl border border-border bg-muted/30 px-6 py-5 text-sm leading-relaxed prose prose-invert max-w-none overflow-auto max-h-96"
                          dangerouslySetInnerHTML={{ __html: data.textPreviewHtml }}
                      />
                  )}
                </motion.div>
            )}

            {data?.manifest?.format === "images" && (
                <div className="space-y-5">
                  {/* Image grid */}
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                    {pagedImages.map((page, idx) => {
                      const pageNumber = absolutePageNumber(idx);
                      const isSelected = selectedImagePageSet.has(pageNumber);

                      return (
                          <motion.button
                              type="button"
                              key={page.key}
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: idx * 0.015, duration: 0.22 }}
                              onClick={() => {
                                if (!deleteMode) return;
                                toggleImageSelection(pageNumber);
                              }}
                              disabled={deletingImages}
                              className={cn(
                                  "group relative text-left rounded-xl border overflow-hidden transition-all duration-150",
                                  deleteMode ? "cursor-pointer" : "cursor-default",
                                  isSelected
                                      ? "border-destructive ring-2 ring-destructive/40"
                                      : "border-border hover:border-primary/40"
                              )}
                          >
                            {/* Thumbnail */}
                            <div className="relative aspect-3/4 bg-muted/40 overflow-hidden">
                              {adminPreviewToken ? (
                                  <img
                                      src={buildAdminPreviewImageUrl(pageNumber)}
                                      alt={`Page ${pageNumber}`}
                                      loading="lazy"
                                      crossOrigin="use-credentials"
                                      className="h-full w-full object-cover"
                                  />
                              ) : (
                                  <div className="flex h-full w-full items-center justify-center">
                                    <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
                                  </div>
                              )}

                              {/* Delete overlay */}
                              {deleteMode && (
                                  <div className="absolute inset-0 bg-black/20 pointer-events-none" />
                              )}

                              {/* Selection checkbox */}
                              {deleteMode && (
                                  <div
                                      className={cn(
                                          "absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full border transition-colors",
                                          isSelected
                                              ? "bg-destructive border-destructive text-white"
                                              : "bg-background/80 border-border"
                                      )}
                                  >
                                    {isSelected && <Check className="h-3 w-3" />}
                                  </div>
                              )}
                            </div>

                            {/* Page label */}
                            <div className="px-2 py-1.5 flex items-center justify-between">
                              <span className="text-xs text-muted-foreground tabular-nums">
                                p.{pageNumber}
                              </span>
                              {(page.w && page.h) ? (
                                  <span className="text-[10px] text-muted-foreground/60 font-mono">
                                    {page.w}×{page.h}
                                  </span>
                              ) : null}
                            </div>
                          </motion.button>
                      );
                    })}
                  </div>

                  {totalImagePages > 1 && (
                      <AppPagination
                          currentPage={imagePage}
                          pageSize={pageSize}
                          totalItems={imagePages.length}
                          itemLabel="images"
                          totalPages={totalImagePages}
                          onPageChange={setImagePage}
                      />
                  )}
                </div>
            )}
          </Section>
        </div>
      </div>
  );
}
