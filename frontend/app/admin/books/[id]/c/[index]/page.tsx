"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AlertCircle, FileText, ImageIcon, Loader2, RefreshCcw, Trash2, Upload } from "lucide-react";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

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

function UploadProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 w-full rounded-full bg-muted">
      <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export default function AdminChapterContentPage() {
  const params = useParams<{ id: string; index: string }>();
  const { toast } = useToast();

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
      toast({
        title: "Failed to load chapter content",
        description: getApiErrorMessage(error, "Unable to fetch chapter content."),
        variant: "destructive",
      });
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
      toast({ title: "No files selected", description: "Select multiple images or one ZIP file.", variant: "destructive" });
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

      toast({ title: "Image content uploaded", description: "Manifest and chapter metadata were updated." });
      setImageFiles([]);
      setZipFile(null);
      await loadContent();
    } catch (error) {
      toast({
        title: "Image upload failed",
        description: getApiErrorMessage(error, "Please verify file count/size/type and try again."),
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const handleUploadText = async () => {
    if (!textFile) {
      toast({ title: "No file selected", description: "Select a .md or .txt file.", variant: "destructive" });
      return;
    }

    setUploading(true);
    setProgress(0);
    try {
      const formData = new FormData();
      formData.append("file", textFile);
      await uploadWithXhr(`/admin/books/${bookId}/chapters/${chapterIndex}/content/text`, formData);
      toast({ title: "Text content uploaded", description: "Text content saved and manifest was regenerated." });
      setTextFile(null);
      await loadContent();
    } catch (error) {
      toast({
        title: "Text upload failed",
        description: getApiErrorMessage(error, "Unable to upload text content."),
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const handleDeleteAll = async () => {
    setDeleting(true);
    try {
      await apiClient.delete(`/admin/books/${bookId}/chapters/${chapterIndex}/content`);
      toast({ title: "Content deleted", description: "All chapter content has been removed." });
      await loadContent();
    } catch (error) {
      toast({
        title: "Delete failed",
        description: getApiErrorMessage(error, "Could not delete chapter content."),
        variant: "destructive",
      });
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
      { label: "Storage Prefix", value: data.chapter.contentPath ?? `readory-book/b${bookId}/c${chapterIndex}` },
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
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Chapter Content Manager</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => void loadContent()} disabled={loading || uploading || deleting}>
            <RefreshCcw className="mr-2 h-4 w-4" /> Refresh
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={deleting || uploading}>
                {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                Delete all content
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete chapter content?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes every object under the chapter prefix and resets manifest-backed content.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => void handleDeleteAll()}>Confirm delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Chapter Metadata</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {metadataRows.map((row) => (
            <div key={row.label} className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">{row.label}</p>
              <p className="truncate text-sm font-medium">{row.value}</p>
            </div>
          ))}
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Manifest</p>
            {data?.manifest ? (
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="secondary">v{data.manifest.version}</Badge>
                <Badge>{data.manifest.format}</Badge>
                <span>{data.manifest.pageCount} pages</span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No manifest available</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upload Content</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "images" | "text")}> 
            <TabsList>
              <TabsTrigger value="images"><ImageIcon className="mr-2 h-4 w-4" /> Images</TabsTrigger>
              <TabsTrigger value="text"><FileText className="mr-2 h-4 w-4" /> Text</TabsTrigger>
            </TabsList>
            <TabsContent value="images" className="space-y-4 pt-4">
              <p className="text-sm text-muted-foreground">
                Upload either multiple image files (jpg/png/webp) or one ZIP archive. Files are normalized server-side to WebP and manifest order.
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 rounded-lg border p-3">
                  <label className="text-sm font-medium">Multiple image files</label>
                  <input
                    type="file"
                    multiple
                    accept="image/png,image/jpeg,image/webp"
                    disabled={uploading}
                    onChange={(event) => setImageFiles(Array.from(event.target.files ?? []))}
                  />
                  <p className="text-xs text-muted-foreground">Selected: {imageFiles.length} file(s)</p>
                </div>
                <div className="space-y-2 rounded-lg border p-3">
                  <label className="text-sm font-medium">ZIP upload</label>
                  <input
                    type="file"
                    accept=".zip,application/zip"
                    disabled={uploading}
                    onChange={(event) => setZipFile(event.target.files?.[0] ?? null)}
                  />
                  <p className="truncate text-xs text-muted-foreground">{zipFile?.name ?? "No ZIP selected"}</p>
                </div>
              </div>
              {uploading && <UploadProgressBar value={progress} />}
              <Button onClick={() => void handleUploadImages()} disabled={uploading || deleting}>
                {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Upload image content
              </Button>
            </TabsContent>
            <TabsContent value="text" className="space-y-4 pt-4">
              <p className="text-sm text-muted-foreground">Upload chapter text as markdown or plain text (MVP format support).</p>
              <div className="space-y-2 rounded-lg border p-3">
                <label className="text-sm font-medium">Text file (.md/.txt)</label>
                <input
                  type="file"
                  accept=".md,.txt,text/plain,text/markdown"
                  disabled={uploading}
                  onChange={(event) => setTextFile(event.target.files?.[0] ?? null)}
                />
                <p className="truncate text-xs text-muted-foreground">{textFile?.name ?? "No text file selected"}</p>
              </div>
              {uploading && <UploadProgressBar value={progress} />}
              <Button onClick={() => void handleUploadText()} disabled={uploading || deleting}>
                {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Upload text content
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current Content</CardTitle>
        </CardHeader>
        <CardContent>
          {!data?.manifest && (
            <div className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-muted-foreground">
              <AlertCircle className="h-4 w-4" /> No manifest/content uploaded yet.
            </div>
          )}

          {data?.manifest?.format === "images" && (
            <div className="space-y-4">
              <ScrollArea className="h-[520px] rounded-lg border p-3">
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {pagedImages.map((page, idx) => (
                    <div key={page.key} className="rounded-lg border bg-muted/20 p-3">
                      <div className="mb-2 flex aspect-[3/4] items-center justify-center rounded bg-muted text-muted-foreground">
                        <ImageIcon className="h-6 w-6" />
                      </div>
                      <p className="text-xs font-medium">Page {(imagePage - 1) * pageSize + idx + 1}</p>
                      <p className="truncate text-[11px] text-muted-foreground" title={page.key}>{page.key}</p>
                      <p className="text-[11px] text-muted-foreground">{page.w && page.h ? `${page.w}×${page.h}` : "size unknown"}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Showing {pagedImages.length} / {imagePages.length} pages</p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={imagePage <= 1} onClick={() => setImagePage((prev) => Math.max(1, prev - 1))}>Prev</Button>
                  <Badge variant="secondary">{imagePage}/{totalImagePages}</Badge>
                  <Button variant="outline" size="sm" disabled={imagePage >= totalImagePages} onClick={() => setImagePage((prev) => Math.min(totalImagePages, prev + 1))}>Next</Button>
                </div>
              </div>
            </div>
          )}

          {data?.manifest?.format === "text" && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Read-only preview of sanitized HTML content.</p>
              <iframe
                title="chapter-text-preview"
                className="h-[500px] w-full rounded-lg border bg-background"
                sandbox="allow-same-origin"
                srcDoc={`<!doctype html><html><head><meta charset=\"utf-8\" /><style>body{font-family:Inter,system-ui,sans-serif;padding:16px;line-height:1.6;}img{max-width:100%;}</style></head><body>${data.textPreviewHtml ?? "No text preview available."}</body></html>`}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
