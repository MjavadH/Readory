"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  FileText,
  ImageIcon,
  Loader2,
  RefreshCcw,
  Trash2,
  Upload,
  BookOpen,
  Layers,
  Hash,
  GitBranch,
  FolderOpen,
  FileStack,
} from "lucide-react";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { useToast } from "@/providers/toast-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { UploadProgressBar } from "@/components/admin/upload-progress-bar";
import {useParams} from "next/navigation";
import {AppPagination} from "@/components/app-pagination";

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

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] as const } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const } },
};

const metaIcons: Record<string, React.ReactNode> = {
  Chapter: <BookOpen className="h-4 w-4" />,
  "Content Type": <Layers className="h-4 w-4" />,
  "Page Count": <Hash className="h-4 w-4" />,
  "Content Version": <GitBranch className="h-4 w-4" />,
  "Storage Prefix": <FolderOpen className="h-4 w-4" />,
  Manifest: <FileStack className="h-4 w-4" />,
};

function ChapterContentSkeleton() {
  return (
      <div className="min-h-screen bg-linear-to-br from-muted/30 via-background to-muted/20">
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-400 mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-8 w-72 rounded-lg bg-muted animate-pulse" />
              <Skeleton className="h-4 w-48 rounded-md bg-muted animate-pulse" />
            </div>
            <div className="flex gap-3">
              <Skeleton className="h-10 w-28 rounded-lg bg-muted animate-pulse" />
              <Skeleton className="h-10 w-40 rounded-lg bg-muted animate-pulse" />
            </div>
          </div>

          {/* Metadata */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>

          {/* Upload */}
          <Skeleton className="h-64 rounded-xl bg-muted animate-pulse" />

          {/* Content */}
          <Skeleton className="h-96 rounded-xl bg-muted animate-pulse" />
        </div>
      </div>
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
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [textFile, setTextFile] = useState<File | null>(null);
  const [imagePage, setImagePage] = useState(1);

  const canLoad = Number.isInteger(bookId) && bookId > 0 && Number.isInteger(chapterIndex) && chapterIndex > 0;

  const loadContent = useCallback(async () => {
    if (!canLoad) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.get<ChapterContentResponse>(`/admin/books/${bookId}/chapters/${chapterIndex}/content`);
      setData(response);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to fetch chapter content."))
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

  const handleUploadImages = async () => {
    if (imageFiles.length === 0 && !zipFile) {
      toast.error("Select multiple images or one ZIP file.", "No files selected")
      return;
    }

    setUploading(true);
    setProgress(0);
    try {
      const formData = new FormData();
      imageFiles.forEach((file) => formData.append("files", file));
      if (zipFile) {
        formData.append("zip", zipFile);
      }

      await uploadWithXhr(`/admin/books/${bookId}/chapters/${chapterIndex}/content/images`, formData);
      toast.success("Image content uploaded")
      setImageFiles([]);
      setZipFile(null);
      await loadContent();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Please verify file count/size/type and try again."), "Image upload failed")
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const handleUploadText = async () => {
    if (!textFile) {
      toast.error("Select a .md or .txt file.", "No file selected")
      return;
    }

    setUploading(true);
    setProgress(0);
    try {
      const formData = new FormData();
      formData.append("file", textFile);
      await uploadWithXhr(`/admin/books/${bookId}/chapters/${chapterIndex}/content/text`, formData);
      toast.success("Text content uploaded")
      setTextFile(null);
      await loadContent();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to upload text content."), "Text upload failed")
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const handleDeleteAll = async () => {
    setDeleting(true);
    try {
      await apiClient.delete(`/admin/books/${bookId}/chapters/${chapterIndex}/content`);
      toast.success("All chapter content has been removed.")
      await loadContent();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not delete chapter content."), "Delete failed")
    } finally {
      setDeleting(false);
    }
  };

  const metadataRows = useMemo(() => {
    if (!data) return [];
    return [
      { label: "Chapter", value: `${data.chapter.index} • ${data.chapter.title}` },
      { label: "Content Type", value: data.chapter.contentType ?? "none" },
      { label: "Page Count", value: String(data.chapter.pageCount ?? 0) },
      { label: "Content Version", value: String(data.chapter.contentVersion ?? 0) },
      { label: "Storage Prefix", value: data.chapter.contentPath ?? `b${bookId}/c${chapterIndex}` },
    ];
  }, [data, bookId, chapterIndex]);

  if (!canLoad) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6 text-destructive">Invalid book/chapter path.</CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return <ChapterContentSkeleton />;
  }

  return (
      <div className="min-h-screen bg-linear-to-br from-muted/30 via-background to-muted/20">
        <motion.div
            className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-400 mx-auto"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
        >
          {/* Header */}
          <motion.div variants={itemVariants} className="flex p-3 md:p-0 flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight bg-linear-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                Chapter Content Manager
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground">
                Manage uploads, manifests, and preview content for your chapters.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                  variant="outline"
                  className="gap-2 border-border/60 hover:bg-secondary"
                  onClick={loadContent}
                  disabled={loading || uploading || deleting}
              >
                <RefreshCcw className="h-4 w-4" />
                Refresh
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                      variant="destructive"
                      className="gap-2"
                      disabled={deleting || uploading}
                  >
                    {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    Delete all content
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete chapter content?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This removes every object under the chapter prefix and resets manifest-backed content. This action cannot be undone.
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

          {/* Metadata Grid */}
          <motion.div variants={itemVariants}>
            <Card className="overflow-hidden">
              <CardHeader className="border-b border-border/40 pb-4">
                <CardTitle className="text-base font-semibold">Chapter Metadata</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
                {metadataRows.map((row, i) => (
                    <motion.div
                        key={row.label}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 + i * 0.06, duration: 0.35 }}
                        className="group rounded-xl border border-border/40 bg-secondary/30 p-4 transition-colors hover:bg-secondary/60"
                    >
                      <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                        {metaIcons[row.label]}
                        {row.label}
                      </div>
                      <p className="truncate text-sm font-semibold">{row.value}</p>
                    </motion.div>
                ))}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + 5 * 0.06, duration: 0.35 }}
                    className="group rounded-xl border border-border/40 bg-secondary/30 p-4 transition-colors hover:bg-secondary/60"
                >
                  <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                    {metaIcons.Manifest}
                    Manifest
                  </div>
                  {data?.manifest ? (
                      <div className="flex items-center gap-2 text-sm">
                        <Badge variant="secondary" className="font-mono text-xs">v{data.manifest.version}</Badge>
                        <Badge className="bg-primary/15 text-primary border-primary/20 font-mono text-xs">{data.manifest.format}</Badge>
                        <span className="font-semibold">{data.manifest.pageCount} pages</span>
                      </div>
                  ) : (
                      <p className="text-sm text-muted-foreground">No manifest</p>
                  )}
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Upload Card */}
          <motion.div variants={cardVariants}>
            <Card className="overflow-hidden">
              <CardHeader className="border-b border-border/40 pb-4">
                <CardTitle className="text-base font-semibold">Upload Content</CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "images" | "text")}>
                  <TabsList className="bg-secondary/50 mb-5">
                    <TabsTrigger value="images" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                      <ImageIcon className="h-4 w-4" /> Images
                    </TabsTrigger>
                    <TabsTrigger value="text" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                      <FileText className="h-4 w-4" /> Text
                    </TabsTrigger>
                  </TabsList>

                  <AnimatePresence mode="wait">
                    <TabsContent value="images" key="images" asChild>
                      <motion.div
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 8 }}
                          transition={{ duration: 0.25 }}
                          className="space-y-5"
                      >
                        <p className="text-sm text-muted-foreground">
                          Upload multiple image files (jpg/png/webp) or one ZIP archive. Files are normalized server-side to WebP.
                        </p>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-3 rounded-xl border border-dashed border-border/60 bg-secondary/20 p-4 transition-colors hover:border-primary/30 hover:bg-secondary/40">
                            <label className="text-sm font-medium">Multiple image files</label>
                            <input
                                type="file"
                                multiple
                                accept="image/png,image/jpeg,image/webp"
                                disabled={uploading}
                                className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary hover:file:bg-primary/20"
                                onChange={(e) => setImageFiles(Array.from(e.target.files ?? []))}
                            />
                            <p className="text-xs text-muted-foreground">Selected: {imageFiles.length} file(s)</p>
                          </div>
                          <div className="space-y-3 rounded-xl border border-dashed border-border/60 bg-secondary/20 p-4 transition-colors hover:border-primary/30 hover:bg-secondary/40">
                            <label className="text-sm font-medium">ZIP upload</label>
                            <input
                                type="file"
                                accept=".zip,application/zip"
                                disabled={uploading}
                                className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary hover:file:bg-primary/20"
                                onChange={(e) => setZipFile(e.target.files?.[0] ?? null)}
                            />
                            <p className="truncate text-xs text-muted-foreground">{zipFile?.name ?? "No ZIP selected"}</p>
                          </div>
                        </div>
                        {uploading && <UploadProgressBar value={progress} />}
                        <Button
                            className="gap-2 glow-primary"
                            onClick={handleUploadImages}
                            disabled={uploading || deleting}
                        >
                          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                          Upload image content
                        </Button>
                      </motion.div>
                    </TabsContent>

                    <TabsContent value="text" key="text" asChild>
                      <motion.div
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 8 }}
                          transition={{ duration: 0.25 }}
                          className="space-y-5"
                      >
                        <p className="text-sm text-muted-foreground">Upload chapter text as markdown or plain text.</p>
                        <div className="space-y-3 rounded-xl border border-dashed border-border/60 bg-secondary/20 p-4 transition-colors hover:border-primary/30 hover:bg-secondary/40">
                          <label className="text-sm font-medium">Text file (.md/.txt)</label>
                          <input
                              type="file"
                              accept=".md,.txt,text/plain,text/markdown"
                              disabled={uploading}
                              className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary hover:file:bg-primary/20"
                              onChange={(e) => setTextFile(e.target.files?.[0] ?? null)}
                          />
                          <p className="truncate text-xs text-muted-foreground">{textFile?.name ?? "No text file selected"}</p>
                        </div>
                        {uploading && <UploadProgressBar value={progress} />}
                        <Button
                            className="gap-2 glow-primary"
                            onClick={handleUploadText}
                            disabled={uploading || deleting}
                        >
                          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                          Upload text content
                        </Button>
                      </motion.div>
                    </TabsContent>
                  </AnimatePresence>
                </Tabs>
              </CardContent>
            </Card>
          </motion.div>

          {/* Current Content */}
          <motion.div variants={cardVariants}>
            <Card className="overflow-hidden">
              <CardHeader className="border-b border-border/40 pb-4">
                <CardTitle className="text-base font-semibold">Current Content</CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                {!data?.manifest && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-3 rounded-xl border border-dashed border-border/60 p-6 text-muted-foreground"
                    >
                      <AlertCircle className="h-5 w-5 text-warning" />
                      <span>No manifest or content uploaded yet.</span>
                    </motion.div>
                )}

                {data?.manifest?.format === "images" && (
                    <div className="space-y-5">
                      <ScrollArea className="h-130 rounded-xl border border-border/40 bg-secondary/10 p-4">
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
                          {pagedImages.map((page, idx) => (
                              <motion.div
                                  key={page.key}
                                  initial={{ opacity: 0, scale: 0.95 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  transition={{ delay: idx * 0.02, duration: 0.3 }}
                                  className="group rounded-xl border border-border/40 bg-secondary/20 p-3 transition-all hover:border-primary/30 hover:bg-secondary/40 hover:shadow-lg hover:shadow-primary/5"
                              >
                                <div className="mb-2.5 flex aspect-3/4 items-center justify-center rounded-lg bg-muted/40">
                                  <ImageIcon className="h-6 w-6 text-muted-foreground transition-colors group-hover:text-primary/60" />
                                </div>
                                <p className="text-xs font-semibold">Page {(imagePage - 1) * pageSize + idx + 1}</p>
                                <p className="truncate font-mono text-[11px] text-muted-foreground" title={page.key}>
                                  {page.key}
                                </p>
                                <p className="font-mono text-[11px] text-muted-foreground">
                                  {page.w && page.h ? `${page.w}×${page.h}` : "size unknown"}
                                </p>
                              </motion.div>
                          ))}
                        </div>
                      </ScrollArea>

                      {/* pagination */}
                      <AppPagination currentPage={imagePage} totalPages={totalImagePages} totalItems={imagePages.length} pageSize={pageSize} itemLabel="images" onPageChange={setImagePage} />
                    </div>
                )}

                {data?.manifest?.format === "text" && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="space-y-3"
                    >
                      <p className="text-xs text-muted-foreground">Read-only preview of sanitized HTML content.</p>
                      <iframe
                          title="chapter-text-preview"
                          className="h-125 w-full rounded-xl border border-border/40 bg-muted/20"
                          sandbox="allow-same-origin"
                          srcDoc={`<!doctype html><html lang="en"><head><meta charset="utf-8"><style>body{font-family:'Plus Jakarta Sans',system-ui,sans-serif;padding:24px;line-height:1.7;color:#c8d0dd;background:#0d1117;}img{max-width:100%;border-radius:8px;}</style></head><body>${data.textPreviewHtml ?? "No text preview available."}</body></html>`}
                      />
                    </motion.div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </div>
  );
}
