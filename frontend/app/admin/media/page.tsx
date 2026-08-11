'use client';

import { getBookCoverThumbnailUrl } from '@/lib/media';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { AppPagination } from '@/components/app-pagination';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Upload, ImageIcon, Search, Trash2, Loader2, Pencil } from 'lucide-react';
import { useToast } from '@/providers/toast-provider';
import { apiClient, getApiErrorMessage } from '@/lib/api-client';
import { FileUploadPicker } from '@/components/admin/file-upload-picker';
import { useTranslations } from 'next-intl';
import AdminPageHeader from '@/components/admin/admin-page-header';

type MediaItem = {
  code: string;
  filename: string;
  createdAt?: string;
  size: number;
};

type PagedMediaResponse = {
  items: MediaItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

const ITEMS_PER_PAGE = 30;
const MAX_UPLOAD_FILES = 10;

function isAllowedImage(file: File) {
  return file.type === 'image/jpeg' || file.type === 'image/webp';
}

export default function AdminMedia() {
  const t = useTranslations('AdminPage.MediaLibrary');
  const g = useTranslations('General');
  const toast = useToast();

  const [isGalleryLoading, setIsGalleryLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [files, setFiles] = useState<MediaItem[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [page, setPage] = useState(1);
  const paginationScrollRef = useRef<HTMLDivElement>(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const [searchQuery, setSearchQuery] = useState('');

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);
  const [deletingCode, setDeletingCode] = useState<string | null>(null);

  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [fileToRename, setFileToRename] = useState<MediaItem | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renamingCode, setRenamingCode] = useState<string | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Reset pagination when search changes
  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  // Fetch paged data
  useEffect(() => {
    const controller = new AbortController();
    setIsGalleryLoading(true);

    const t = setTimeout(async () => {
      try {
        const q = searchQuery.trim();
        const qs = new URLSearchParams();
        if (q) qs.set('q', q);
        qs.set('page', String(page));
        qs.set('limit', String(ITEMS_PER_PAGE));

        const data = await apiClient
          .get<MediaItem[] | PagedMediaResponse>(`/media?${qs.toString()}`, {
            signal: controller.signal,
          })
          .catch(
            () =>
              ({
                items: [],
                total: 0,
                totalPages: 1,
                page: 1,
                limit: ITEMS_PER_PAGE,
              }) as PagedMediaResponse,
          );

        if (Array.isArray(data)) {
          // fallback compatibility
          setFiles(data);
          setTotal(data.length);
          setTotalPages(1);
        } else {
          setFiles(Array.isArray(data.items) ? data.items : []);
          setTotal(Number(data.total) || 0);
          setTotalPages(Math.max(1, Number(data.totalPages) || 1));
        }
        if (!hasLoadedOnce) setHasLoadedOnce(true);
      } catch (err: unknown) {
        if (err instanceof Error) {
          if (err?.name !== 'AbortError') {
            toast.error(getApiErrorMessage(err));
          }
        }
      } finally {
        setIsGalleryLoading(false);
      }
    }, 250);

    return () => {
      controller.abort();
      clearTimeout(t);
    };
  }, [searchQuery, page, refreshNonce, toast, hasLoadedOnce]);

  const handleUpload = async () => {
    if (!selectedFiles.length) return;

    setIsUploading(true);
    setUploadSuccess(false);
    setUploadError(null);

    try {
      const formData = new FormData();
      for (const f of selectedFiles) formData.append('files', f);

      const data = await apiClient.post<{
        items: MediaItem[];
        failed?: { name: string; reason: string }[];
      }>('/media', formData);
      toast.success(t('UploadedNFile', { NFile: data.items.length }));

      if (data.failed?.length) {
        toast.error(
          data.failed
            .slice(0, 2)
            .map((x) => `${x.name}: ${x.reason}`)
            .join(' • '),
          t('SomeFailed'),
        );
      }

      setUploadSuccess(true);

      // Refresh list (even if already on page 1)
      setPage(1);
      setRefreshNonce((n) => n + 1);

      setTimeout(() => {
        setSelectedFiles([]);
        setUploadSuccess(false);
      }, 1200);
    } catch (error) {
      const message = getApiErrorMessage(error, t('NetworkError'));
      setUploadError(message);
      toast.error(message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRenameClick = (item: MediaItem) => {
    setFileToRename(item);
    setRenameValue(item.filename);
    setRenameDialogOpen(true);
  };

  const handleRenameConfirm = async () => {
    if (!fileToRename) return;

    const next = renameValue.trim();
    if (!next) {
      return toast.error(t('FilenameRequired'));
    }

    setRenamingCode(fileToRename.code);
    try {
      const data = await apiClient.patch<{ filename: string }>(`/media/${fileToRename.code}`, {
        filename: next,
      });

      setFiles((prev) =>
        prev.map((f) => (f.code === fileToRename.code ? { ...f, filename: data.filename } : f)),
      );
      setRenameDialogOpen(false);
      setFileToRename(null);
      toast.success(t('FileRenamed'));
    } catch (err: unknown) {
      if (err instanceof Error) {
        toast.error(getApiErrorMessage(err));
      }
    } finally {
      setRenamingCode(null);
    }
  };

  const handleDeleteClick = (code: string) => {
    setFileToDelete(code);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!fileToDelete) return;
    setDeletingCode(fileToDelete);

    try {
      await apiClient.delete(`/media/${fileToDelete}`);
      toast.success(t('FileDeleted'));

      // Optimistic removal + adjust pagination if page becomes empty
      setFiles((prev) => prev.filter((f) => f.code !== fileToDelete));
      setTotal((t) => Math.max(0, t - 1));

      // If we deleted the last item on this page, go back a page
      if (files.length === 1 && page > 1) {
        setPage((p) => Math.max(1, p - 1));
      } else {
        setRefreshNonce((n) => n + 1);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        toast.error(getApiErrorMessage(err));
      }
    } finally {
      setDeletingCode(null);
      setDeleteDialogOpen(false);
      setFileToDelete(null);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-muted/30 via-background to-muted/20 pb-20 sm:pb-0">
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-400 mx-auto">
        {/* Header */}
        <AdminPageHeader icon={ImageIcon} title={t('Title')} description={t('Description')} />

        {/* Upload */}
        <Card className="border-primary/20 overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="size-5" />
              {t('UploadNewImages')}
            </CardTitle>
            <CardDescription>{t('UploadNewImagesDescription')}</CardDescription>
          </CardHeader>

          <CardContent className="p-6 space-y-4">
            <FileUploadPicker
              kind="image"
              files={selectedFiles}
              onFilesChange={setSelectedFiles}
              accept=".jpg,.jpeg,.webp"
              multiple
              maxFiles={MAX_UPLOAD_FILES}
              isAllowedFile={isAllowedImage}
              disabled={isUploading || uploadSuccess}
              uploading={isUploading}
              success={uploadSuccess}
              error={uploadError}
              onErrorChange={setUploadError}
              dropTitleIdle={t('DragDropYourImages')}
              dropTitleActive={t('DropHere')}
              helperText={t('SupportsFormat')}
              blockedErrorText="Only JPG/JPEG/WebP are allowed"
              maxFilesErrorText={(m) => t('MaximumNFiles', { NFile: m })}
              actions={
                !uploadSuccess && selectedFiles.length > 0 ? (
                  <>
                    <Button
                      onClick={handleUpload}
                      disabled={isUploading}
                      className="gap-2"
                      size="sm"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          {t('Uploading')}
                        </>
                      ) : (
                        <>
                          <Upload className="size-4" />
                          {t('UploadNFile', { NFile: selectedFiles.length })}
                        </>
                      )}
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => {
                        setSelectedFiles([]);
                        setUploadError(null);
                      }}
                      disabled={isUploading}
                      size="sm"
                    >
                      {g('Cancel')}
                    </Button>
                  </>
                ) : null
              }
            />
          </CardContent>
        </Card>

        {/* Gallery */}
        <Card className="border-primary/20">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <CardTitle>{t('MediaGallery')}</CardTitle>
                  <span className="inline-flex items-center rounded-full border bg-muted/40 px-2.5 py-0.5 text-xs font-medium">
                    {t('TotalFile', { NFile: total })}
                  </span>
                </div>
                <CardDescription className="mt-1">{t('BrowseManageImages')}</CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-4 md:p-6 space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('SearchByFilename')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="ps-9 h-11"
              />
            </div>

            {/* Image Grid */}
            <div ref={paginationScrollRef} className="relative">
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
                    {searchQuery ? t('NoImagesFound') : t('NoImagesUploaded')}
                  </p>
                  <p className="text-xs md:text-sm text-muted-foreground/70">
                    {searchQuery ? t('TrySearch') : t('UploadFirst')}
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
                          src={`${getBookCoverThumbnailUrl(file.code)}`}
                          alt={file.filename || 'Image'}
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
                        <div className="text-xs font-medium truncate text-center">
                          {file.filename}
                        </div>
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
              itemLabel={t('MediaItems')}
              onPageChange={setPage}
              canGoPrevious={!isGalleryLoading && page > 1}
              canGoNext={!isGalleryLoading && page < totalPages}
              scrollTarget={paginationScrollRef}
            />
          </CardContent>
        </Card>

        {/* Rename Dialog */}
        <AlertDialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('RenameMedia')}</AlertDialogTitle>
              <AlertDialogDescription className="rtl:text-right">
                {t('RenameMediaDescription')}
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="space-y-2">
              <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel disabled={!!renamingCode}>{g('Cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={handleRenameConfirm} disabled={!!renamingCode}>
                {renamingCode ? g('Saving') : g('Save')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('DeleteMedia')}</AlertDialogTitle>
              <AlertDialogDescription className="rtl:text-right">
                {t('DeleteMediaDescription')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={!!deletingCode}>{g('Cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteConfirm} disabled={!!deletingCode}>
                {deletingCode ? g('Deleting') : g('Delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
