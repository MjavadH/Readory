'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Check,
  FileStack,
  FileText,
  FileType2,
  FolderOpen,
  GitBranch,
  Hash,
  ImageIcon,
  Layers,
  Loader2,
  Plus,
  RefreshCcw,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { apiClient, getApiErrorMessage } from '@/lib/api-client';
import { useToast } from '@/providers/toast-provider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
} from '@/components/ui/alert-dialog';
import { AppPagination } from '@/components/app-pagination';
import { UploadPanel } from '@/components/admin/upload-panel';
import { cn } from '@/lib/utils';

type ChapterMeta = {
  id: number;
  title: string;
  index: number;
  contentPath: string | null;
  contentType: 'images' | 'text' | null;
  pageCount: number;
  contentVersion: number;
  updatedAt: string;
  pdfKey?: string | null;
  pdfPageCount?: number | null;
  pdfUploadedAt?: string | null;
};

type Manifest = {
  version: 1;
  format: 'images' | 'text';
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
  contentType: 'images' | 'text' | null;
  contentVersion: number;
  adminPreview: true;
};

type UploadTab = 'images' | 'text' | 'pdf';

const PAGE_SIZE = 24;
const POLL_INTERVAL_MS = 5000;

// Mirrors backend limits (chapter-content.service.ts / pdf-processing.service.ts)
const IMAGE_MAX_FILES = 120;
const IMAGE_MAX_BYTES = 12 * 1024 * 1024;
const TEXT_MAX_BYTES = 2 * 1024 * 1024;
const PDF_MAX_BYTES = 100 * 1024 * 1024;

const EASE = [0.25, 0.46, 0.45, 0.94] as const;

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

function PageSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56 sm:w-72" />
          <Skeleton className="h-4 w-40 sm:w-80" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-2xl" />
      <Skeleton className="h-80 rounded-2xl" />
    </div>
  );
}

function MetaCard({
  icon,
  label,
  value,
  mono = false,
  delay = 0,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: EASE }}
      className="group relative overflow-hidden rounded-xl border border-border bg-card p-3 transition-colors duration-200 hover:border-primary/40 sm:p-4"
    >
      <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="mb-1.5 flex items-center gap-2 text-[11px] font-medium text-muted-foreground sm:text-xs">
        <span className="text-primary/70">{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <div className={cn('truncate text-xs font-semibold sm:text-sm', mono && 'font-mono text-xs')}>
        {value}
      </div>
    </motion.div>
  );
}

function Section({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
    >
      <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-foreground">{title}</h2>
          {subtitle && <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="p-4 sm:p-6">{children}</div>
    </motion.section>
  );
}

function TabBtn({
  active,
  icon,
  label,
  onClick,
  disabled,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        'relative flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors duration-150 sm:flex-none sm:px-4 sm:text-sm',
        'disabled:cursor-not-allowed disabled:opacity-50',
        active ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {active && (
        <motion.span
          layoutId="upload-tab-pill"
          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          className="absolute inset-0 rounded-lg bg-primary shadow-sm shadow-primary/30"
        />
      )}
      <span className="relative z-10 flex items-center gap-1.5 whitespace-nowrap">
        {icon}
        {label}
      </span>
    </button>
  );
}

export default function ChapterContentManager() {
  const t = useTranslations('Books');
  const g = useTranslations('General');
  const params = useParams<{ id: string; index: string }>();
  const toast = useToast();

  const bookId = Number(Array.isArray(params.id) ? params.id[0] : params.id);
  const chapterIndex = Number(Array.isArray(params.index) ? params.index[0] : params.index);

  const [data, setData] = useState<ChapterContentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeTab, setActiveTab] = useState<UploadTab>('images');

  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [textFile, setTextFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  const [imageError, setImageError] = useState<string | null>(null);
  const [textError, setTextError] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const [imagePage, setImagePage] = useState(1);
  const imagePaginationScrollRef = useRef<HTMLDivElement>(null);
  const [adminPreviewToken, setAdminPreviewToken] = useState<string | null>(null);
  const [textPage, setTextPage] = useState(1);
  const [currentTextHtml, setCurrentTextHtml] = useState<string | null>(null);
  const [isLoadingText, setIsLoadingText] = useState(false);
  const textContainerRef = useRef<HTMLDivElement>(null);
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedImagePages, setSelectedImagePages] = useState<number[]>([]);
  const [deletingImages, setDeletingImages] = useState(false);

  const canLoad =
    Number.isInteger(bookId) && bookId > 0 && Number.isInteger(chapterIndex) && chapterIndex > 0;

  const loadContent = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!canLoad) {
        setLoading(false);
        return;
      }
      if (!options?.silent) setLoading(true);
      try {
        const response = await apiClient.get<ChapterContentResponse>(
          `/admin/books/${bookId}/chapters/${chapterIndex}/content`,
        );
        setData(response);
        setLoadError(null);
        setDeleteMode(false);
        setSelectedImagePages([]);
        setTextPage(1);
        setCurrentTextHtml(null);

        if (response.manifest && response.manifest.pageCount > 0) {
          try {
            const preview = await apiClient.post<AdminPreviewSessionResponse>(
              '/reader/admin/session',
              { bookId, chapterIndex },
            );
            setAdminPreviewToken(preview.sessionToken);
          } catch (error) {
            setAdminPreviewToken(null);
            toast.error(
              getApiErrorMessage(error, t('UnableCreatePreview')),
              t('PreviewUnavailable'),
            );
          }
        } else {
          setAdminPreviewToken(null);
        }
      } catch (error) {
        const message = getApiErrorMessage(error, t('UnableFetchChapterContent'));
        setLoadError(message);
        if (!options?.silent) toast.error(message);
      } finally {
        setLoading(false);
      }
    },
    [bookId, chapterIndex, canLoad, toast, t],
  );

  useEffect(() => {
    void loadContent();
  }, [loadContent]);

  const chapter = data?.chapter ?? null;
  const isPdfProcessing = Boolean(chapter && !chapter.contentType && chapter.pdfKey);
  const hasContent = Boolean(chapter?.contentType);

  // Poll while the PDF worker converts pages in the background.
  useEffect(() => {
    if (!isPdfProcessing) return;
    const timer = window.setInterval(() => {
      void loadContent({ silent: true });
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [isPdfProcessing, loadContent]);

  const imagePages = useMemo(
    () => (data?.manifest?.format === 'images' ? data.manifest.pages : []),
    [data],
  );
  const totalImagePages = Math.max(1, Math.ceil(imagePages.length / PAGE_SIZE));
  const pagedImages = imagePages.slice((imagePage - 1) * PAGE_SIZE, imagePage * PAGE_SIZE);

  useEffect(() => {
    if (imagePage > totalImagePages) setImagePage(totalImagePages);
  }, [imagePage, totalImagePages]);

  useEffect(() => {
    if (data?.manifest?.format !== 'text' || !adminPreviewToken) return;

    let isMounted = true;
    setIsLoadingText(true);

    apiClient
      .get<{ html: string }>('/reader/text', {
        query: { token: adminPreviewToken, p: textPage },
      })
      .then((res) => {
        if (isMounted) setCurrentTextHtml(res.html);
      })
      .catch((err) => {
        if (isMounted) {
          toast.error(getApiErrorMessage(err, t('UnableFetchChapterContent')));
        }
      })
      .finally(() => {
        if (isMounted) setIsLoadingText(false);
      });

    return () => {
      isMounted = false;
    };
  }, [adminPreviewToken, textPage, data?.manifest?.format, toast, t]);

  const uploadWithXhr = useCallback(
    (url: string, formData: FormData): Promise<void> =>
      new Promise((resolve, reject) => {
        const request = new XMLHttpRequest();
        const base = process.env.NEXT_PUBLIC_API_BASE ?? '';
        request.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            setProgress(Math.round((event.loaded / event.total) * 100));
          }
        };
        request.onerror = () => reject(new Error(t('NetworkUploadError')));
        request.ontimeout = () => reject(new Error(t('NetworkUploadError')));
        request.onload = () => {
          if (request.status >= 200 && request.status < 300) {
            resolve();
            return;
          }
          let serverMessage: string;
          try {
            const parsed = JSON.parse(request.responseText) as { message?: string | string[] };
            serverMessage = Array.isArray(parsed.message)
              ? parsed.message.join(', ')
              : (parsed.message ?? '');
          } catch {
            serverMessage = '';
          }
          reject(
            new Error(serverMessage || t('UploadFailedStatus', { RequestStatus: request.status })),
          );
        };
        request.open('POST', `${base}${url}`);
        request.withCredentials = true;
        request.send(formData);
      }),
    [t],
  );

  const handleUploadImages = async (mode: 'replace' | 'append') => {
    if (imageFiles.length === 0) {
      setImageError(t('SelectMoreImage'));
      toast.error(t('SelectMoreImage'), t('NoFilesSelected'));
      return;
    }
    if (imageFiles.length > IMAGE_MAX_FILES) {
      setImageError(t('TooManyImages', { Max: IMAGE_MAX_FILES }));
      return;
    }
    const oversized = imageFiles.find((file) => file.size > IMAGE_MAX_BYTES);
    if (oversized) {
      setImageError(
        t('FileTooLarge', { FileName: oversized.name, Max: formatBytes(IMAGE_MAX_BYTES) }),
      );
      return;
    }

    setImageError(null);
    setUploading(true);
    setProgress(0);
    try {
      const formData = new FormData();
      imageFiles.forEach((file) => formData.append('files', file));
      const url =
        mode === 'append'
          ? `/admin/books/${bookId}/chapters/${chapterIndex}/content/images/append`
          : `/admin/books/${bookId}/chapters/${chapterIndex}/content/images`;
      await uploadWithXhr(url, formData);
      toast.success(mode === 'append' ? t('ImagesAppended') : t('ImageContentReplaced'));
      setImageFiles([]);
      await loadContent({ silent: true });
    } catch (error) {
      const message = getApiErrorMessage(error, t('VerifyFile'));
      setImageError(message);
      toast.error(message, mode === 'append' ? t('AppendFailed') : t('UploadFailed'));
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const handleUploadText = async () => {
    if (!textFile) {
      setTextError(t('SelectTextFile'));
      toast.error(t('SelectTextFile'), t('NoFileSelected'));
      return;
    }
    if (textFile.size > TEXT_MAX_BYTES) {
      setTextError(
        t('FileTooLarge', { FileName: textFile.name, Max: formatBytes(TEXT_MAX_BYTES) }),
      );
      return;
    }

    setTextError(null);
    setUploading(true);
    setProgress(0);
    try {
      const formData = new FormData();
      formData.append('file', textFile);
      await uploadWithXhr(`/admin/books/${bookId}/chapters/${chapterIndex}/content/text`, formData);
      toast.success(t('TextContentUploaded'));
      setTextFile(null);
      await loadContent({ silent: true });
    } catch (error) {
      const message = getApiErrorMessage(error, t('UnableUploadTextContent'));
      setTextError(message);
      toast.error(message, t('TextUploadFailed'));
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const handleUploadPdf = async () => {
    if (!pdfFile) {
      setPdfError(t('SelectPdfFile'));
      toast.error(t('SelectPdfFile'), t('NoFileSelected'));
      return;
    }
    if (pdfFile.size > PDF_MAX_BYTES) {
      setPdfError(t('FileTooLarge', { FileName: pdfFile.name, Max: formatBytes(PDF_MAX_BYTES) }));
      return;
    }

    setPdfError(null);
    setUploading(true);
    setProgress(0);
    try {
      const formData = new FormData();
      formData.append('file', pdfFile);
      await uploadWithXhr(`/admin/books/${bookId}/chapters/${chapterIndex}/content/pdf`, formData);
      toast.success(t('PdfQueued'), t('PdfProcessingStarted'));
      setPdfFile(null);
      await loadContent({ silent: true });
    } catch (error) {
      const message = getApiErrorMessage(error, t('UnableUploadPdf'));
      setPdfError(message);
      toast.error(message, t('PdfUploadFailed'));
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const handleDeleteAll = async () => {
    setDeleting(true);
    try {
      await apiClient.delete(`/admin/books/${bookId}/chapters/${chapterIndex}/content`);
      toast.success(t('AllContentRemoved'));
      await loadContent({ silent: true });
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('CouldNotDeleteContent')), t('DeleteFailed'));
    } finally {
      setDeleting(false);
    }
  };

  const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? '';
  const buildAdminPreviewImageUrl = (pageNumber: number) =>
    `${apiBase}/reader/page?token=${encodeURIComponent(adminPreviewToken ?? '')}&p=${pageNumber}`;

  const absolutePageNumber = (pageIndexInCurrentPage: number) =>
    (imagePage - 1) * PAGE_SIZE + pageIndexInCurrentPage + 1;

  const selectedImagePageSet = useMemo(() => new Set(selectedImagePages), [selectedImagePages]);

  const toggleImageSelection = (pageNumber: number) => {
    setSelectedImagePages((prev) =>
      prev.includes(pageNumber)
        ? prev.filter((p) => p !== pageNumber)
        : [...prev, pageNumber].sort((a, b) => a - b),
    );
  };

  const currentPagedPageNumbers = useMemo(
    () => pagedImages.map((_, idx) => (imagePage - 1) * PAGE_SIZE + idx + 1),
    [pagedImages, imagePage],
  );

  const selectedCountOnCurrentPage = useMemo(
    () => currentPagedPageNumbers.filter((p) => selectedImagePageSet.has(p)).length,
    [currentPagedPageNumbers, selectedImagePageSet],
  );

  const allCurrentSelected =
    currentPagedPageNumbers.length > 0 &&
    selectedCountOnCurrentPage === currentPagedPageNumbers.length;

  const toggleSelectCurrentPage = () => {
    if (allCurrentSelected) {
      setSelectedImagePages((prev) => prev.filter((p) => !currentPagedPageNumbers.includes(p)));
      return;
    }
    setSelectedImagePages((prev) =>
      [...new Set([...prev, ...currentPagedPageNumbers])].sort((a, b) => a - b),
    );
  };

  const handleDeleteSelectedImages = async () => {
    if (selectedImagePages.length === 0) return;
    setDeletingImages(true);
    try {
      await apiClient.delete(`/admin/books/${bookId}/chapters/${chapterIndex}/content/images`, {
        body: { pageNumbers: selectedImagePages },
      });
      toast.success(t('NImageDeleted', { NImage: selectedImagePages.length }));
      setDeleteMode(false);
      setSelectedImagePages([]);
      await loadContent({ silent: true });
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('CouldNotDeleteImages')), t('DeleteFailed'));
    } finally {
      setDeletingImages(false);
    }
  };

  const metadataRows = useMemo(() => {
    if (!chapter) return [];
    return [
      {
        icon: <BookOpen className="h-3.5 w-3.5" />,
        label: t('Chapter'),
        value: `${chapter.index} — ${chapter.title}`,
      },
      {
        icon: <Layers className="h-3.5 w-3.5" />,
        label: t('ContentType'),
        value: chapter.contentType ?? (isPdfProcessing ? t('Processing') : t('None')),
      },
      {
        icon: <Hash className="h-3.5 w-3.5" />,
        label: t('PageCount'),
        value: String(chapter.pageCount ?? 0),
      },
      {
        icon: <GitBranch className="h-3.5 w-3.5" />,
        label: t('ContentVersion'),
        value: `v${chapter.contentVersion ?? 0}`,
      },
      {
        icon: <FolderOpen className="h-3.5 w-3.5" />,
        label: t('StoragePrefix'),
        value: chapter.contentPath ?? `b${bookId}/c${chapterIndex}`,
        mono: true,
      },
      {
        icon: <FileStack className="h-3.5 w-3.5" />,
        label: t('Manifest'),
        value: data?.manifest ? (
          <span className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="h-5 px-1.5 py-0 font-mono text-xs">
              v{data.manifest.version}
            </Badge>
            <Badge className="h-5 border-primary/20 bg-primary/15 px-1.5 py-0 text-xs text-primary">
              {data.manifest.format}
            </Badge>
            <span className="tabular-nums">{data.manifest.pageCount}p</span>
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">{t('NoManifest')}</span>
        ),
      },
    ];
  }, [chapter, data, bookId, chapterIndex, isPdfProcessing, t]);

  const isBusy = loading || uploading || deleting || deletingImages;
  const imagesDisabledByPdf = isPdfProcessing;

  if (!canLoad) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-sm space-y-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-8 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
          <p className="font-semibold text-foreground">{t('InvalidRoute')}</p>
          <p className="text-sm text-muted-foreground">{t('PathInvalid')}</p>
        </div>
      </div>
    );
  }

  if (loading && !data) return <PageSkeleton />;

  if (loadError && !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, ease: EASE }}
          className="max-w-sm space-y-4 rounded-2xl border border-border bg-card p-8 text-center"
        >
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-destructive/10">
            <AlertCircle className="h-5 w-5 text-destructive" />
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-foreground">{t('UnableFetchChapterContent')}</p>
            <p className="text-sm wrap-break-word text-muted-foreground">{loadError}</p>
          </div>
          <Button className="w-full gap-2" onClick={() => void loadContent()}>
            <RefreshCcw className="h-3.5 w-3.5" />
            {g('Retry')}
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-16">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-10 sm:space-y-8">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE }}
          className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
        >
          <div className="min-w-0 space-y-1">
            <Link
              href={`/admin/books/${bookId}`}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-primary"
            >
              <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
              {t('GoBack')}
            </Link>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl lg:text-3xl">
              {t('ChapterContentManager')}
            </h1>
            <p className="text-xs text-muted-foreground sm:text-sm">
              {t('ChapterContentManagerDescription')}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-2 sm:flex-none"
              onClick={() => void loadContent({ silent: true })}
              disabled={isBusy}
            >
              <RefreshCcw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              {g('Refresh')}
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  className="flex-1 gap-2 sm:flex-none"
                  disabled={isBusy || (!hasContent && !isPdfProcessing)}
                >
                  {deleting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  {g('DeleteAll')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('DeleteAllContent')}</AlertDialogTitle>
                  <AlertDialogDescription className="rtl:text-right">
                    {t('DeleteAllContentDescription')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deleting}>{g('Cancel')}</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" onClick={handleDeleteAll}>
                    {t('ConfirmDelete')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </motion.header>

        {/* Background refresh error */}
        <AnimatePresence>
          {loadError && data && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive"
              role="alert"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1 wrap-break-word">{loadError}</span>
              <Button size="sm" variant="ghost" onClick={() => void loadContent({ silent: true })}>
                {g('Retry')}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* PDF processing banner */}
        <AnimatePresence>
          {isPdfProcessing && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="flex flex-col gap-3 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{t('PdfProcessingTitle')}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('PdfProcessingDescription', { Pages: chapter?.pdfPageCount ?? 0 })}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={() => void loadContent({ silent: true })}
                disabled={isBusy}
              >
                <RefreshCcw className="h-3.5 w-3.5" />
                {g('Refresh')}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Metadata */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3">
          {metadataRows.map((row, i) => (
            <MetaCard
              key={row.label}
              icon={row.icon}
              label={row.label}
              value={row.value}
              mono={row.mono}
              delay={i * 0.04}
            />
          ))}
        </div>

        {/* Upload */}
        <Section title={t('UploadContent')} subtitle={t('UploadContentDescription')}>
          <div className="mb-5 flex items-center gap-1 rounded-xl border border-border bg-muted/60 p-1 sm:w-fit">
            <TabBtn
              active={activeTab === 'images'}
              icon={<ImageIcon className="h-3.5 w-3.5" />}
              label={t('Images')}
              onClick={() => setActiveTab('images')}
              disabled={uploading}
            />
            <TabBtn
              active={activeTab === 'text'}
              icon={<FileText className="h-3.5 w-3.5" />}
              label={t('Text')}
              onClick={() => setActiveTab('text')}
              disabled={uploading}
            />
            <TabBtn
              active={activeTab === 'pdf'}
              icon={<FileType2 className="h-3.5 w-3.5" />}
              label={t('Pdf')}
              onClick={() => setActiveTab('pdf')}
              disabled={uploading}
            />
          </div>

          <AnimatePresence mode="wait">
            {activeTab === 'images' && (
              <UploadPanel
                key="images"
                kind="image"
                description={t('UploadImageFiles')}
                accept="image/png,image/jpeg,image/webp"
                multiple
                maxFiles={IMAGE_MAX_FILES}
                allowAddMore
                files={imageFiles}
                onFilesChange={setImageFiles}
                uploading={uploading && activeTab === 'images'}
                disabled={imagesDisabledByPdf}
                progress={progress}
                progressLabel={t('UploadingImages')}
                error={imageError}
                onErrorChange={setImageError}
                blockedErrorText={t('OnlyImageAllowed')}
                maxFilesErrorText={(max) => t('TooManyImages', { Max: max })}
                helperText={t('ImageAllowed')}
                notice={
                  imagesDisabledByPdf ? (
                    <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      {t('PdfProcessingBlocksUpload')}
                    </p>
                  ) : chapter?.contentType === 'text' ? (
                    <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      {t('AppendDisabled')}
                    </p>
                  ) : null
                }
                actions={
                  <>
                    {chapter?.contentType === 'images' && (
                      <Button
                        size="sm"
                        className="w-full gap-2 sm:w-auto"
                        onClick={() => void handleUploadImages('append')}
                        disabled={isBusy || imagesDisabledByPdf}
                      >
                        {uploading ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Upload className="h-3.5 w-3.5" />
                        )}
                        {t('AppendImages')}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant={hasContent ? 'outline' : 'default'}
                      className="w-full gap-2 sm:w-auto"
                      onClick={() => void handleUploadImages('replace')}
                      disabled={isBusy || imagesDisabledByPdf}
                    >
                      {uploading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : hasContent ? (
                        <RefreshCcw className="h-3.5 w-3.5" />
                      ) : (
                        <Plus className="h-3.5 w-3.5" />
                      )}
                      {hasContent ? t('ReplaceAll') : t('AddImages')}
                    </Button>
                  </>
                }
              />
            )}

            {activeTab === 'text' && (
              <UploadPanel
                key="text"
                kind="file"
                description={t('UploadTextFile')}
                accept=".md,.txt,text/plain,text/markdown"
                maxFiles={1}
                files={textFile ? [textFile] : []}
                onFilesChange={(files) => setTextFile(files[0] ?? null)}
                uploading={uploading && activeTab === 'text'}
                disabled={imagesDisabledByPdf}
                progress={progress}
                progressLabel={t('UploadingText')}
                error={textError}
                onErrorChange={setTextError}
                blockedErrorText={t('OnlyTextAllowed')}
                maxFilesErrorText={() => t('OnlyOneFileAllowed')}
                dropTitleIdle={t('DropTextFile')}
                helperText={t('TextFormats')}
                notice={
                  imagesDisabledByPdf ? (
                    <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      {t('PdfProcessingBlocksUpload')}
                    </p>
                  ) : null
                }
                actions={
                  <Button
                    size="sm"
                    className="w-full gap-2 sm:w-auto"
                    onClick={() => void handleUploadText()}
                    disabled={isBusy || imagesDisabledByPdf}
                  >
                    {uploading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
                    {t('UploadText')}
                  </Button>
                }
              />
            )}

            {activeTab === 'pdf' && (
              <UploadPanel
                key="pdf"
                kind="file"
                description={t('UploadPdfDescription')}
                accept="application/pdf,.pdf"
                maxFiles={1}
                files={pdfFile ? [pdfFile] : []}
                onFilesChange={(files) => setPdfFile(files[0] ?? null)}
                isAllowedFile={(file) =>
                  file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
                }
                uploading={uploading && activeTab === 'pdf'}
                disabled={imagesDisabledByPdf}
                progress={progress}
                progressLabel={t('UploadingPdf')}
                error={pdfError}
                onErrorChange={setPdfError}
                blockedErrorText={t('OnlyPdfAllowed')}
                maxFilesErrorText={() => t('OnlyOneFileAllowed')}
                dropTitleIdle={t('DropPdfFile')}
                helperText={t('PdfLimits', { Max: formatBytes(PDF_MAX_BYTES) })}
                notice={
                  <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />
                    {imagesDisabledByPdf ? t('PdfProcessingBlocksUpload') : t('PdfReplaceWarning')}
                  </p>
                }
                actions={
                  <Button
                    size="sm"
                    className="w-full gap-2 sm:w-auto"
                    onClick={() => void handleUploadPdf()}
                    disabled={isBusy || imagesDisabledByPdf}
                  >
                    {uploading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
                    {t('UploadPdf')}
                  </Button>
                }
              />
            )}
          </AnimatePresence>
        </Section>

        {/* Current content */}
        <Section
          title={t('CurrentContent')}
          subtitle={
            data?.manifest
              ? `${data.manifest.format} · ${t('NPages', { NPages: data.manifest.pageCount })}`
              : isPdfProcessing
                ? t('PdfProcessingTitle')
                : t('NoContentUploaded')
          }
          action={
            data?.manifest?.format === 'images' && imagePages.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                {deleteMode ? (
                  <>
                    <span className="text-xs text-muted-foreground">
                      {t('NPagesSelected', { NPages: selectedImagePages.length })}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={toggleSelectCurrentPage}
                      disabled={deletingImages}
                    >
                      {allCurrentSelected ? t('DeselectPage') : t('SelectPage')}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-7 gap-1.5 px-2.5 text-xs"
                          disabled={deletingImages || selectedImagePages.length === 0}
                        >
                          {deletingImages ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                          {t('DeleteNPages', { NPages: selectedImagePages.length })}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t('DeleteSelectedImages')}</AlertDialogTitle>
                          <AlertDialogDescription className="rtl:text-right">
                            {t('DeleteSelectedImagesDescription', {
                              NPages: selectedImagePages.length,
                            })}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel disabled={deletingImages}>
                            {g('Cancel')}
                          </AlertDialogCancel>
                          <AlertDialogAction
                            variant="destructive"
                            onClick={handleDeleteSelectedImages}
                          >
                            {t('ConfirmDelete')}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1.5 px-2 text-xs text-muted-foreground"
                      onClick={() => {
                        setDeleteMode(false);
                        setSelectedImagePages([]);
                      }}
                      disabled={deletingImages}
                    >
                      <X className="h-3 w-3" />
                      {g('Cancel')}
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1.5 border-destructive/30 px-2.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => {
                      setDeleteMode(true);
                      setSelectedImagePages([]);
                    }}
                    disabled={isBusy}
                  >
                    <Trash2 className="h-3 w-3" />
                    {t('DeleteImages')}
                  </Button>
                )}
              </div>
            ) : undefined
          }
        >
          {!data?.manifest && !isPdfProcessing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-12 text-muted-foreground sm:py-16"
            >
              <div className="grid h-12 w-12 place-items-center rounded-full bg-muted">
                <FileStack className="h-5 w-5" />
              </div>
              <p className="text-sm">{t('NoContentUploaded')}</p>
            </motion.div>
          )}

          {!data?.manifest && isPdfProcessing && (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="aspect-3/4 rounded-xl" />
              ))}
            </div>
          )}

          {data?.manifest?.format === 'text' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
              ref={textContainerRef}
            >
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4 text-primary" />
                <span>{t('TextChapterUploaded')}</span>
                <Badge variant="outline" className="h-5 px-1.5 py-0 font-mono text-xs">
                  {data.manifest.format}
                </Badge>
              </div>

              <div
                className={cn(
                  'prose prose-sm dark:prose-invert max-h-150 max-w-none overflow-auto rounded-xl border border-border bg-muted/30 px-4 py-4 text-sm leading-relaxed sm:px-6 sm:py-5 transition-opacity duration-200',
                  isLoadingText ? 'opacity-50 pointer-events-none' : 'opacity-100',
                )}
                dangerouslySetInnerHTML={{ __html: currentTextHtml || data.textPreviewHtml || '' }}
              />

              {(data.manifest.pageCount || 0) > 1 && (
                <AppPagination
                  currentPage={textPage}
                  pageSize={1}
                  totalItems={data.manifest.pageCount}
                  itemLabel={t('Text')}
                  totalPages={data.manifest.pageCount}
                  onPageChange={setTextPage}
                  scrollTarget={textContainerRef}
                />
              )}
            </motion.div>
          )}

          {data?.manifest?.format === 'images' && (
            <div className="space-y-5">
              <div
                ref={imagePaginationScrollRef}
                className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3 lg:grid-cols-6"
              >
                {pagedImages.map((page, idx) => {
                  const pageNumber = absolutePageNumber(idx);
                  const isSelected = selectedImagePageSet.has(pageNumber);

                  return (
                    <motion.button
                      type="button"
                      key={page.key}
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: Math.min(idx * 0.015, 0.3), duration: 0.22 }}
                      whileTap={deleteMode ? { scale: 0.97 } : undefined}
                      onClick={() => {
                        if (!deleteMode) return;
                        toggleImageSelection(pageNumber);
                      }}
                      disabled={deletingImages}
                      aria-pressed={deleteMode ? isSelected : undefined}
                      className={cn(
                        'group relative overflow-hidden rounded-xl border text-start transition-all duration-150',
                        deleteMode ? 'cursor-pointer' : 'cursor-default',
                        isSelected
                          ? 'border-destructive ring-2 ring-destructive/40'
                          : 'border-border hover:border-primary/40',
                      )}
                    >
                      <div className="relative aspect-3/4 overflow-hidden bg-muted/40">
                        {adminPreviewToken ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={buildAdminPreviewImageUrl(pageNumber)}
                            alt={t('PageNumber', { Page: pageNumber })}
                            loading="lazy"
                            crossOrigin="use-credentials"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
                          </div>
                        )}

                        {deleteMode && (
                          <>
                            <div className="pointer-events-none absolute inset-0 bg-foreground/20" />
                            <div
                              className={cn(
                                'absolute top-1.5 flex h-5 w-5 items-center justify-center rounded-full border transition-colors ltr:right-1.5 rtl:left-1.5',
                                isSelected
                                  ? 'border-destructive bg-destructive text-destructive-foreground'
                                  : 'border-border bg-background/80',
                              )}
                            >
                              {isSelected && <Check className="h-3 w-3" />}
                            </div>
                          </>
                        )}
                      </div>

                      <div className="flex items-center justify-between px-2 py-1.5">
                        <span className="text-xs tabular-nums text-muted-foreground">
                          p.{pageNumber}
                        </span>
                        {page.w && page.h ? (
                          <span className="hidden font-mono text-[10px] text-muted-foreground/60 sm:inline">
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
                  pageSize={PAGE_SIZE}
                  totalItems={imagePages.length}
                  itemLabel={t('images')}
                  totalPages={totalImagePages}
                  onPageChange={setImagePage}
                  scrollTarget={imagePaginationScrollRef}
                />
              )}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}
