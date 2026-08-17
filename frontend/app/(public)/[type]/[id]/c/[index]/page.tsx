'use client';

import { getBookCoverThumbnailUrl } from '@/lib/media';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { apiClient, getApiErrorMessage, ApiError } from '@/lib/api-client';
import { ReaderToolbar } from '@/components/reader/reader-toolbar';
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Loader2,
  Lock,
  LogIn,
  RefreshCw,
  ShoppingCart,
  Unlock,
} from 'lucide-react';
import { useToast } from '@/providers/toast-provider';
import { ReaderContextMenu } from '@/components/reader/reader-context-menu';
import { ReaderZoomViewport, useReaderZoom } from '@/components/reader/reader-zoom';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AppIcon } from '@/components/AppIcon';
import {
  ChapterPurchaseDialog,
  type PurchaseDialogBook,
  type PurchaseDialogChapter,
} from '@/components/chapter-purchase-dialog';
import { ReaderTextContent } from '@/components/reader/reader-text-content';

type SessionResponse = {
  chapterId: number;
  bookId: number;
  chapterIndex: number;
  contentType: 'images' | 'text' | null;
  pageCount: number;
  contentVersion: number;
  resume: { lastPage: number; percent: number } | null;
  sessionToken: string;
};

type Manifest = {
  version: 1;
  format: 'images' | 'text';
  pageCount: number;
  pages: Array<{ key: string; w?: number; h?: number; sha256?: string }>;
};

type ReaderChapterItem = {
  id: number;
  index: number;
  title: string;
  pageCount: number;
  locked: boolean;
  price?: number | null;
};

type ReaderContextResponse = {
  chapters: ReaderChapterItem[];
};

type BookDetailsResponse = {
  id: number;
  title: string;
  contributors?: Array<{
    id: number;
    name: string;
    role: string;
    slug: string;
  }>;
  coverImage: string;
  type: PurchaseDialogBook['type'];
};

type ReaderErrorVariant = 'auth' | 'locked' | 'notfound' | 'processing' | 'error';

type ReaderSettings = {
  fontSize: number;
  lineHeight: number;
  fontFamily: string;
  textDirection: 'ltr' | 'rtl';
};

const DEFAULT_READER_SETTINGS: ReaderSettings = {
  fontSize: 18,
  lineHeight: 1.6,
  fontFamily: 'Georgia, serif',
  textDirection: 'ltr',
};

export default function ChapterPage() {
  const t = useTranslations('Books');
  const g = useTranslations('General');
  const toast = useToast();
  const router = useRouter();
  const params = useParams<{ type: string; id: string; index: string }>();

  const idParam = Array.isArray(params.id) ? params.id[0] : params.id;
  const indexParam = Array.isArray(params.index) ? params.index[0] : params.index;
  const typeSlug = Array.isArray(params.type) ? params.type[0] : params.type;

  const bookId = Number(idParam);
  const chapterIndex = Number(indexParam);

  const backUrl = useMemo(() => `/${encodeURIComponent(typeSlug)}/${bookId}`, [typeSlug, bookId]);

  const [session, setSession] = useState<SessionResponse | null>(null);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [textHtml, setTextHtml] = useState<string>('');
  const [readerCtx, setReaderCtx] = useState<ReaderContextResponse | null>(null);
  const [book, setBook] = useState<PurchaseDialogBook | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [showPurchase, setShowPurchase] = useState(false);
  const [brightness, setBrightness] = useState(100);
  const [readMode, setReadMode] = useState<'scroll' | 'page'>('page');
  const [currentPage, setCurrentPage] = useState(1);
  const scrollCanvasRefs = useRef<Array<HTMLCanvasElement | null>>([]); // scroll mode
  const loadedPagesRef = useRef<Set<number>>(new Set());
  const pageBlobCacheRef = useRef<Map<number, Blob>>(new Map()); // key: page number (1-based)
  const [loadedPages, setLoadedPages] = useState<Set<number>>(new Set());
  const [pageCanvasEl, setPageCanvasEl] = useState<HTMLCanvasElement | null>(null);
  const inFlightPagesRef = useRef<Map<number, Promise<void>>>(new Map());
  const [pageTransitionLoading, setPageTransitionLoading] = useState(false);
  const pageDrawRequestIdRef = useRef(0);
  const lastSavedPageRef = useRef<number | null>(null);
  const totalPages = manifest?.pageCount ?? session?.pageCount ?? 1;
  const maxReachedPageRef = useRef(1);
  const progressCompletedRef = useRef(false);
  const readerRootRef = useRef<HTMLDivElement | null>(null);
  const [readerRootEl, setReaderRootEl] = useState<HTMLDivElement | null>(null);
  const zoom = useReaderZoom();
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const sessionRef = useRef<SessionResponse | null>(null);
  const refreshingSessionRef = useRef<Promise<SessionResponse> | null>(null);
  const [readerFilter, setReaderFilter] = useState<string>('');
  const [readerSettings, setReaderSettings] = useState<ReaderSettings>(() => {
    if (typeof window === 'undefined') return DEFAULT_READER_SETTINGS;

    const stored = window.localStorage.getItem('readory.readerSettings');
    if (!stored) return DEFAULT_READER_SETTINGS;

    try {
      const parsed = JSON.parse(stored) as Partial<ReaderSettings>;
      return {
        fontSize:
          typeof parsed.fontSize === 'number' ? parsed.fontSize : DEFAULT_READER_SETTINGS.fontSize,
        lineHeight:
          typeof parsed.lineHeight === 'number'
            ? parsed.lineHeight
            : DEFAULT_READER_SETTINGS.lineHeight,
        fontFamily:
          typeof parsed.fontFamily === 'string'
            ? parsed.fontFamily
            : DEFAULT_READER_SETTINGS.fontFamily,
        textDirection:
          parsed.textDirection === 'rtl' || parsed.textDirection === 'ltr'
            ? parsed.textDirection
            : DEFAULT_READER_SETTINGS.textDirection,
      };
    } catch {
      window.localStorage.removeItem('readory.readerSettings');
      return DEFAULT_READER_SETTINGS;
    }
  });

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    // Persist typography changes after hydration so text chapters keep the user's reading preferences.
    window.localStorage.setItem('readory.readerSettings', JSON.stringify(readerSettings));
  }, [readerSettings]);

  const currentChapter =
    readerCtx?.chapters.find((c) => c.index === chapterIndex) ??
    ({
      id: session?.chapterId ?? 0,
      index: chapterIndex,
      title: t('ChapterChapterIndex', { ChapterIndex: chapterIndex }),
      pageCount: session?.pageCount ?? 1,
      locked: false,
    } satisfies ReaderChapterItem);

  const chapters = readerCtx?.chapters ?? [currentChapter];

  const setReaderRoot = useCallback((element: HTMLDivElement | null) => {
    readerRootRef.current = element;
    setReaderRootEl(element);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); // Disable default browser menu
    setMenuPos({ x: e.clientX, y: e.clientY });
  }, []);

  const refreshReaderSession = useCallback(async (): Promise<SessionResponse> => {
    if (refreshingSessionRef.current) {
      return refreshingSessionRef.current;
    }

    const task = (async () => {
      const nextSession = await apiClient.post<
        SessionResponse,
        { bookId: number; chapterIndex: number }
      >('/reader/session', { bookId, chapterIndex });

      setSession(nextSession);
      sessionRef.current = nextSession;

      // refresh manifest/text with new token (important if old token expired)
      if (nextSession.contentType === 'images') {
        const nextManifest = await apiClient.get<Manifest>('/reader/manifest', {
          query: { token: nextSession.sessionToken },
        });
        setManifest(nextManifest);
        setTextHtml('');
        setCurrentPage((prev) => Math.max(1, Math.min(prev, nextManifest.pageCount || 1)));
      } else if (nextSession.contentType === 'text') {
        const nextManifest = await apiClient.get<Manifest>('/reader/manifest', {
          query: { token: nextSession.sessionToken },
        });
        const safePage = Math.max(1, Math.min(currentPage, nextManifest.pageCount || 1));
        const nextText = await apiClient.get<{ html: string }>('/reader/text', {
          query: { token: nextSession.sessionToken, p: safePage },
        });
        setManifest(nextManifest);
        setTextHtml(nextText.html);
        setCurrentPage(safePage);
      }

      return nextSession;
    })();

    refreshingSessionRef.current = task;

    try {
      return await task;
    } finally {
      refreshingSessionRef.current = null;
    }
  }, [bookId, chapterIndex, currentPage]);

  useEffect(() => {
    if (!session) return;
    const interval = setInterval(() => {
      refreshReaderSession().catch(() => undefined);
    }, 90000);
    return () => clearInterval(interval);
  }, [session, refreshReaderSession]);

  const resetChapterRenderState = useCallback(() => {
    pageBlobCacheRef.current.clear();
    inFlightPagesRef.current.clear();
    loadedPagesRef.current = new Set();
    setLoadedPages(new Set());
  }, []);

  const fetchPageBlob = useCallback(
    async (page: number, signal?: AbortSignal): Promise<Blob> => {
      const activeSession = sessionRef.current;
      if (!activeSession) throw new Error('No reader session');

      // Limit cache size to 10 items
      if (pageBlobCacheRef.current.size > 10) {
        const firstKey = pageBlobCacheRef.current.keys().next().value;
        if (firstKey !== undefined) {
          pageBlobCacheRef.current.delete(firstKey);
        }
      }

      const cached = pageBlobCacheRef.current.get(page);
      if (cached) return cached;

      const requestPage = (token: string) =>
        fetch(
          `${process.env.NEXT_PUBLIC_API_BASE}/reader/page?token=${encodeURIComponent(token)}&p=${page}`,
          {
            credentials: 'include',
            cache: 'no-store',
            signal,
          },
        );

      let res = await requestPage(activeSession.sessionToken);

      // token expired -> refresh session once and retry
      if (res.status === 401) {
        try {
          const refreshed = await refreshReaderSession();
          res = await requestPage(refreshed.sessionToken);
        } catch {
          toast.error(t('SessionExpired'));
          throw new Error(t('SessionRefreshFailed'));
        }
      }

      if (!res.ok) {
        if (res.status === 429) {
          toast.error(t('AbnormalBehavior'));
        } else if (res.status === 401) {
          toast.error(t('SessionExpired'));
        }
        throw new Error(`Failed page ${page} (${res.status})`);
      }

      const blob = await res.blob();
      pageBlobCacheRef.current.set(page, blob);
      return blob;
    },
    [refreshReaderSession, toast, t],
  );

  const drawBlobToCanvas = useCallback(async (blob: Blob, canvas: HTMLCanvasElement) => {
    const bitmap = await createImageBitmap(blob);
    try {
      const needResize = canvas.width !== bitmap.width || canvas.height !== bitmap.height;

      if (needResize) {
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(bitmap, 0, 0);
    } finally {
      type ClosableImageBitmap = ImageBitmap & {
        close?: () => void;
      };

      const closableBitmap = bitmap as ClosableImageBitmap;

      if (typeof closableBitmap.close === 'function') {
        closableBitmap.close();
      }
    }
  }, []);

  const drawPageToCanvas = useCallback(
    async (page: number, canvas: HTMLCanvasElement | null, signal?: AbortSignal) => {
      if (!canvas || !session) return;

      const maxPage = manifest?.pageCount ?? session.pageCount ?? 1;
      if (page < 1 || page > maxPage) return;
      if (canvas.dataset.renderedPage === String(page)) return;

      if (signal?.aborted) return;

      let blob = pageBlobCacheRef.current.get(page);

      if (!blob) {
        const existingTask = inFlightPagesRef.current.get(page);
        if (existingTask) {
          try {
            await existingTask;
          } catch {
            // Ignore previous task failure
          }
          if (signal?.aborted) return;
          blob = pageBlobCacheRef.current.get(page);
        }

        if (!blob) {
          const newTask = (async () => {
            const b = await fetchPageBlob(page, signal);
            pageBlobCacheRef.current.set(page, b);
          })();
          inFlightPagesRef.current.set(page, newTask);

          try {
            await newTask;
          } catch (err) {
            throw err;
          } finally {
            inFlightPagesRef.current.delete(page);
          }

          if (signal?.aborted) return;
          blob = pageBlobCacheRef.current.get(page);
        }
      }

      if (blob) {
        if (signal?.aborted) return;
        await drawBlobToCanvas(blob, canvas);
        if (signal?.aborted) return;

        canvas.dataset.renderedPage = String(page);

        if (!loadedPagesRef.current.has(page)) {
          loadedPagesRef.current.add(page);
          setLoadedPages((prev) => {
            if (prev.has(page)) return prev;
            const next = new Set(prev);
            next.add(page);
            return next;
          });
        }
      }
    },
    [session, manifest, fetchPageBlob, drawBlobToCanvas],
  );

  // Initial load (session + context + manifest/text + book details)
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (
        !Number.isInteger(bookId) ||
        !Number.isInteger(chapterIndex) ||
        bookId <= 0 ||
        chapterIndex <= 0
      ) {
        setError(t('InvalidChapterLink'));
        setErrorStatus(404);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      setErrorStatus(null);
      setErrorCode(null);
      resetChapterRenderState();

      try {
        apiClient
          .get<BookDetailsResponse>(`/books/${bookId}`)
          .then((b) => {
            if (!cancelled) {
              setBook({
                id: b.id,
                title: b.title,
                contributors: b.contributors,
                coverImage: b.coverImage,
                type: b.type,
              });
            }
          })
          .catch(() => {
            // non-fatal
          });

        apiClient
          .get<ReaderContextResponse>('/reader/context', { query: { bookId } })
          .then((ctx) => {
            if (!cancelled) setReaderCtx(ctx);
          })
          .catch(() => {
            // non-fatal
          });

        const s = await apiClient.post<SessionResponse, { bookId: number; chapterIndex: number }>(
          '/reader/session',
          { bookId, chapterIndex },
        );
        if (cancelled) return;

        setSession(s);

        const startPage = Math.max(1, Math.min(s.pageCount || 1, s.resume?.lastPage ?? 1));
        maxReachedPageRef.current = startPage;
        lastSavedPageRef.current = s.resume?.lastPage ?? 0;
        progressCompletedRef.current = (s.resume?.lastPage ?? 0) >= (s.pageCount || 1);
        setCurrentPage(progressCompletedRef.current ? 1 : startPage);

        if (s.contentType === 'images') {
          const m = await apiClient.get<Manifest>('/reader/manifest', {
            query: { token: s.sessionToken },
          });
          if (cancelled) return;
          setManifest(m);
        } else if (s.contentType === 'text') {
          const m = await apiClient.get<Manifest>('/reader/manifest', {
            query: { token: s.sessionToken },
          });
          if (cancelled) return;
          setManifest(m);

          const textPage = Math.max(1, Math.min(m.pageCount || 1, startPage));
          const txt = await apiClient.get<{ html: string }>('/reader/text', {
            query: { token: s.sessionToken, p: textPage },
          });
          if (cancelled) return;
          setCurrentPage(textPage);
          setTextHtml(txt.html);
        } else {
          setError('Chapter content is unavailable');
          setErrorStatus(0);
        }
      } catch (e) {
        if (!cancelled) {
          setErrorStatus(e instanceof ApiError ? e.status : 0);
          setErrorCode(e instanceof ApiError ? (e.data?.code ?? null) : null);
          setError(getApiErrorMessage(e, 'Unable to open chapter'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [bookId, chapterIndex, reloadKey, resetChapterRenderState, t]);

  useEffect(() => {
    maxReachedPageRef.current = Math.max(maxReachedPageRef.current, currentPage);
  }, [currentPage]);

  useEffect(() => {
    if (!session || !manifest || manifest.format !== 'text') return;

    let cancelled = false;

    const run = async () => {
      try {
        const textPage = await apiClient.get<{ html: string }>('/reader/text', {
          query: { token: session.sessionToken, p: currentPage },
        });
        if (!cancelled) setTextHtml(textPage.html);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 401) {
          await refreshReaderSession().catch(() => undefined);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [session, manifest, currentPage, refreshReaderSession]);

  // Page mode: draw current page to single canvas
  useEffect(() => {
    if (!session || !manifest || manifest.format !== 'images') return;
    if (readMode !== 'page') return;
    if (!pageCanvasEl) return;

    const abortController = new AbortController();
    const signal = abortController.signal;
    const reqId = ++pageDrawRequestIdRef.current;

    queueMicrotask(() => {
      if (!signal.aborted && reqId === pageDrawRequestIdRef.current) {
        setPageTransitionLoading(true);
      }
    });

    const run = async () => {
      try {
        await drawPageToCanvas(currentPage, pageCanvasEl, signal);
      } catch {
        // ignore page-level error
      } finally {
        if (!signal.aborted && reqId === pageDrawRequestIdRef.current) {
          setPageTransitionLoading(false);
        }
      }
    };

    void run();

    return () => {
      abortController.abort();
    };
  }, [session, manifest, readMode, currentPage, pageCanvasEl, drawPageToCanvas]);

  // Scroll mode
  useEffect(() => {
    if (!session || !manifest || manifest.format !== 'images') return;
    if (readMode !== 'scroll') return;

    const abortControllers = new Map<number, AbortController>();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const canvas = entry.target as HTMLCanvasElement;
          const pageStr = canvas.dataset.page;
          if (!pageStr) return;

          const pageNum = Number(pageStr);

          if (entry.isIntersecting) {
            const controller = new AbortController();
            abortControllers.set(pageNum, controller);
            void drawPageToCanvas(pageNum, canvas, controller.signal);
          } else {
            const controller = abortControllers.get(pageNum);
            if (controller) {
              controller.abort();
              abortControllers.delete(pageNum);
            }
          }
        });
      },
      {
        rootMargin: '600px 0px', // Preload pages before they enter the viewport
        threshold: 0.01,
      },
    );

    const refs = scrollCanvasRefs.current;
    refs.forEach((canvas) => {
      if (canvas) observer.observe(canvas);
    });

    return () => {
      observer.disconnect();
      abortControllers.forEach((c) => c.abort());
      abortControllers.clear();
    };
  }, [session, manifest, readMode, drawPageToCanvas]);

  // Track currentPage in scroll mode by viewport center
  useEffect(() => {
    if (readMode !== 'scroll') return;
    if (!manifest || manifest.format !== 'images') return;

    // Track active page efficiently using viewport center
    const pageObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const pageStr = (entry.target as HTMLElement).dataset.page;
            if (pageStr) {
              setCurrentPage(Number(pageStr));
            }
          }
        });
      },
      {
        rootMargin: '-50% 0px -50% 0px', // Trigger when the center of the canvas hits the center of the screen
        threshold: 0,
      },
    );

    const refs = scrollCanvasRefs.current;
    refs.forEach((canvas) => {
      if (canvas) pageObserver.observe(canvas);
    });

    return () => pageObserver.disconnect();
  }, [readMode, manifest]);

  // Save reading progress
  useEffect(() => {
    if (!session) return;
    if (progressCompletedRef.current) return;

    const total = session.pageCount || 1;
    const targetPage = Math.min(total, maxReachedPageRef.current);
    const lastSaved = lastSavedPageRef.current ?? 0;

    if (targetPage <= lastSaved) return;

    const id = window.setTimeout(() => {
      apiClient
        .post('/reader/progress', {
          chapterId: session.chapterId,
          lastPage: targetPage,
        })
        .then(() => {
          lastSavedPageRef.current = targetPage;

          if (targetPage >= total) {
            progressCompletedRef.current = true;
          }
        })
        .catch(() => undefined);
    }, 1200);

    return () => window.clearTimeout(id);
  }, [session, currentPage]);

  useEffect(() => {
    if (!session) return;

    const saveNow = () => {
      if (progressCompletedRef.current) return;

      const total = session.pageCount || 1;
      const targetPage = Math.min(total, maxReachedPageRef.current);
      const lastSaved = lastSavedPageRef.current ?? 0;

      if (targetPage <= lastSaved) return;

      apiClient
        .post('/reader/progress', {
          chapterId: session.chapterId,
          lastPage: targetPage,
        })
        .then(() => {
          lastSavedPageRef.current = targetPage;
          if (targetPage >= total) {
            progressCompletedRef.current = true;
          }
        })
        .catch(() => undefined);
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') saveNow();
    };

    window.addEventListener('beforeunload', saveNow);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('beforeunload', saveNow);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [session, currentPage]);

  const toggleFullscreen = useCallback(() => {
    const element = readerRootRef.current;
    if (!element) return;

    if (!document.fullscreenElement) {
      element.requestFullscreen().catch(() => {
        toast.error(t('FullscreenBlocked'));
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }, [t, toast]);

  const handleChapterChange = useCallback(
    (chapter: ReaderChapterItem) => {
      router.push(`/${encodeURIComponent(typeSlug)}/${bookId}/c/${chapter.index}`);
    },
    [router, typeSlug, bookId],
  );

  const handlePageChange = useCallback(
    (nextPage: number) => {
      const total = manifest?.pageCount ?? session?.pageCount ?? 1;

      if (nextPage < 1 || nextPage > total) {
        return;
      }

      setCurrentPage(nextPage);

      if (readMode === 'scroll' && session?.contentType !== 'text') {
        const target = scrollCanvasRefs.current[nextPage - 1];
        target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        const container = readerRootRef.current;
        if (!container) return;

        if (document.fullscreenElement === container) {
          container.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }
    },
    [manifest?.pageCount, session?.pageCount, readMode, session?.contentType],
  );

  // Re-run the full reader load (used after a successful in-page purchase / retry).
  const reloadReader = useCallback(() => {
    setReloadKey((key) => key + 1);
  }, []);

  const handlePurchased = useCallback(() => {
    // Access has been granted: re-open the session so the chapter renders inline.
    reloadReader();
  }, [reloadReader]);

  // Keyboard navigation (page mode) & Fullscreen
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (readMode === 'page') handlePageChange(currentPage - 1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (readMode === 'page') handlePageChange(currentPage + 1);
      } else if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [readMode, currentPage, handlePageChange, toggleFullscreen]);

  if (loading) {
    return (
      <div className="min-h-dvh bg-reader-bg">
        <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-10">
          <div className="space-y-4">
            <div className="h-11 w-full animate-pulse rounded-2xl bg-muted" />
            <div className="h-[58vh] w-full animate-pulse rounded-2xl bg-muted sm:h-[64vh]" />
            <div className="flex items-center justify-center gap-3">
              <div className="h-10 w-28 animate-pulse rounded-full bg-muted" />
              <div className="h-10 w-16 animate-pulse rounded-full bg-muted" />
              <div className="h-10 w-28 animate-pulse rounded-full bg-muted" />
            </div>
          </div>
          <div className="mt-6 flex items-center justify-center" aria-hidden="true">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    const isProcessing = errorStatus === 503 && errorCode === 'PROCESSING';
    const variant: ReaderErrorVariant =
      errorStatus === 401
        ? 'auth'
        : errorStatus === 402 || errorStatus === 403
          ? 'locked'
          : errorStatus === 404
            ? 'notfound'
            : isProcessing
              ? 'processing'
              : 'error';

    const lockedChapter = readerCtx?.chapters.find((c) => c.index === chapterIndex);
    const lockedPrice = lockedChapter?.price ?? null;
    const lockedIsFree = lockedPrice == null || lockedPrice <= 0;

    const purchaseChapter: PurchaseDialogChapter | null = lockedChapter
      ? {
          id: lockedChapter.id,
          title: lockedChapter.title,
          index: lockedChapter.index,
          isFree: lockedIsFree,
          price: lockedPrice,
          mode: lockedIsFree ? 'access' : 'purchase',
        }
      : null;

    const canPurchase = variant === 'locked' && !!book && !!purchaseChapter;

    const priceLabel = lockedIsFree
      ? t('Free')
      : `${g('CurrencySymbols')}${Number(lockedPrice ?? 0).toFixed(2)}`;

    const coverSrc = book?.coverImage
      ? getBookCoverThumbnailUrl(book.coverImage)
      : '/placeholder.svg';

    // Per-variant presentation.
    const presentation: Record<
      ReaderErrorVariant,
      {
        icon: typeof Lock;
        iconWrap: string;
        title: string;
        description: string;
      }
    > = {
      auth: {
        icon: LogIn,
        iconWrap: 'bg-blue-600 dark:bg-blue-500',
        title: t('OnlyRegisteredUsers'),
        description: error,
      },
      locked: {
        icon: lockedIsFree ? Unlock : Lock,
        iconWrap: lockedIsFree
          ? 'bg-emerald-600 dark:bg-emerald-500'
          : 'bg-blue-600 dark:bg-blue-500',
        title: lockedIsFree ? t('AccessChapter') : t('PurchaseChapter'),
        description: lockedIsFree
          ? t('AccessChapterDescription', {
              ChapterIndex: lockedChapter?.index ?? chapterIndex,
              ChapterTitle: lockedChapter?.title ?? currentChapter.title,
            })
          : t('PurchaseChapterDescription', {
              ChapterIndex: lockedChapter?.index ?? chapterIndex,
              ChapterTitle: lockedChapter?.title ?? currentChapter.title,
              CurrencySymbols: g('CurrencySymbols'),
              ChapterPrice: Number(lockedPrice ?? 0).toFixed(2),
            }),
      },
      notfound: {
        icon: AlertCircle,
        iconWrap: 'bg-muted-foreground/80',
        title: t('BookNotFound'),
        description: error || t('BookNotFoundDescription'),
      },
      processing: {
        icon: Loader2,
        iconWrap: 'bg-blue-600 dark:bg-blue-500',
        title: t('ContentProcessingTitle'),
        description: t('ContentProcessingDescription'),
      },
      error: {
        icon: AlertCircle,
        iconWrap: 'bg-destructive',
        title: error,
        description: '',
      },
    };

    const view = presentation[variant];
    const Icon = view.icon;

    return (
      <div className="flex min-h-dvh flex-col bg-reader-bg">
        <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
          <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-300">
            <div className="overflow-hidden rounded-3xl border border-border bg-card text-card-foreground shadow-xl">
              <div className="flex flex-col items-center px-5 pt-8 text-center sm:px-8">
                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg ${view.iconWrap}`}
                >
                  <Icon
                    className={`h-7 w-7 ${variant === 'processing' ? 'animate-spin' : ''}`}
                    aria-hidden="true"
                  />
                </div>
                <h1 className="mt-5 text-balance text-xl font-bold leading-tight text-foreground sm:text-2xl">
                  {view.title}
                </h1>
                {view.description && (
                  <p className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">
                    {view.description}
                  </p>
                )}
              </div>

              {/* Locked chapter summary + price */}
              {variant === 'locked' && book && (
                <div className="px-5 pt-6 sm:px-8">
                  <div className="flex gap-4 rounded-2xl border border-border bg-muted/40 p-4">
                    <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded-lg shadow-md">
                      <Image
                        src={coverSrc}
                        alt={`Cover of ${book.title}`}
                        fill
                        className="object-cover"
                        sizes="64px"
                      />
                    </div>
                    <div className="flex min-w-0 flex-col justify-center gap-1.5 text-start">
                      <h2 className="line-clamp-2 font-semibold leading-snug text-foreground">
                        {book.title}
                      </h2>
                      <p className="truncate text-sm text-muted-foreground">
                        {book.contributors &&
                          book.contributors.length > 0 &&
                          book.contributors[0].name}
                      </p>
                      <Badge
                        variant="outline"
                        className="w-fit gap-1.5 border-border bg-background"
                      >
                        <AppIcon name={book.type.iconKey} className="h-3.5 w-3.5" />
                        {book.type.name}
                      </Badge>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-3 rounded-2xl border border-border p-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white dark:bg-blue-500">
                      {lockedChapter?.index ?? chapterIndex}
                    </div>
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <BookOpen
                        className="h-4 w-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <span className="line-clamp-1 text-sm font-medium text-foreground">
                        {lockedChapter?.title ?? currentChapter.title}
                      </span>
                    </div>
                    <span
                      className={`shrink-0 text-base font-bold ${
                        lockedIsFree ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'
                      }`}
                    >
                      {priceLabel}
                    </span>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col gap-3 p-5 sm:p-8">
                {variant === 'locked' && (
                  <Button
                    type="button"
                    onClick={() => setShowPurchase(true)}
                    disabled={!canPurchase}
                    className={`h-11 w-full text-white ${
                      lockedIsFree
                        ? 'bg-emerald-600 hover:bg-emerald-700'
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {lockedIsFree ? (
                      <Unlock className="me-2 h-4 w-4" aria-hidden="true" />
                    ) : (
                      <ShoppingCart className="me-2 h-4 w-4" aria-hidden="true" />
                    )}
                    {lockedIsFree ? t('Access') : t('Buy')}
                  </Button>
                )}

                {variant === 'error' && (
                  <Button type="button" onClick={reloadReader} className="h-11 w-full">
                    <RefreshCw className="me-2 h-4 w-4" aria-hidden="true" />
                    {t('TryAgain')}
                  </Button>
                )}

                <Button asChild variant="outline" className="h-11 w-full">
                  <Link href={backUrl}>
                    <ArrowLeft className="me-2 h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                    {t('BackBookPage')}
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {variant === 'locked' && book && purchaseChapter && showPurchase && (
          <ChapterPurchaseDialog
            book={book}
            chapter={purchaseChapter}
            typeSlug={typeSlug}
            onPurchased={handlePurchased}
            onClose={() => setShowPurchase(false)}
          />
        )}
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-dvh bg-reader-bg">
        <div className="mx-auto w-full max-w-3xl px-4 py-8">
          <div className="h-11 w-full animate-pulse rounded-2xl bg-muted" />
          <div className="mt-4 h-[60vh] w-full animate-pulse rounded-2xl bg-muted" />
        </div>
      </div>
    );
  }

  // Text mode
  if (session.contentType === 'text') {
    return (
      <div ref={setReaderRoot} className="min-h-screen bg-reader-bg overflow-y-auto">
        <main
          onContextMenu={handleContextMenu}
          className="pt-20 pb-10 transition-[filter] duration-300"
          style={{ filter: `brightness(${brightness}%) ${readerFilter}`.trim() }}
        >
          <div className="mx-auto w-full px-4 lg:max-w-3/4">
            <ReaderTextContent
              html={textHtml}
              dir={readerSettings.textDirection}
              className="prose prose-neutral dark:prose-invert max-w-none select-none rounded-2xl border border-border bg-card/60 p-5 text-foreground sm:p-6"
              style={{
                fontSize: `${readerSettings.fontSize}px`,
                lineHeight: readerSettings.lineHeight,
                fontFamily: readerSettings.fontFamily,
                color: 'var(--foreground)',
              }}
            />
          </div>
        </main>

        <ReaderToolbar
          contentMode="text"
          currentPage={currentPage}
          totalPages={totalPages}
          brightness={brightness}
          readMode="page"
          typography={readerSettings}
          onTypographyChange={setReaderSettings}
          currentChapter={currentChapter}
          chapters={chapters}
          onPageChange={handlePageChange}
          onBrightnessChange={setBrightness}
          onReadModeChange={() => {}}
          onChapterChange={handleChapterChange}
          book={book}
          typeSlug={typeSlug}
          onPurchased={handlePurchased}
          showReadModeToggle={false}
          fullscreenTarget={readerRootEl}
        />
      </div>
    );
  }

  return (
    <div ref={setReaderRoot} className="min-h-screen bg-reader-bg overflow-y-auto">
      {/* Main content */}
      <main
        onContextMenu={handleContextMenu}
        className="pt-16 pb-24 transition-[filter] duration-300"
        style={{ filter: `brightness(${brightness}%) ${readerFilter}`.trim() }}
      >
        <ReaderZoomViewport zoom={zoom}>
          {readMode === 'page' ? (
            <div className="mx-auto flex min-h-[calc(100dvh-10rem)] max-w-2xl items-center justify-center px-4 pt-8">
              <div className="w-full">
                <div className="relative">
                  {pageTransitionLoading && (
                    <div className="absolute flex h-full w-full items-center justify-center rounded-lg bg-muted/60 px-2 py-1 backdrop-blur">
                      <Loader2 className="h-16 w-16 animate-spin text-primary sm:h-20 sm:w-20" />
                    </div>
                  )}

                  <canvas
                    ref={setPageCanvasEl}
                    className="h-full w-full select-none rounded-lg bg-muted shadow-xl"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-2xl px-4 pt-8 space-y-4">
              {Array.from({ length: manifest?.pageCount ?? 0 }).map((_, idx) => {
                const pageNo = idx + 1;
                const meta = manifest?.pages?.[idx];
                const ratio = meta?.w && meta?.h ? `${meta.w} / ${meta.h}` : undefined;
                return (
                  <motion.div
                    key={pageNo}
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-40px' }}
                    transition={{ duration: 0.25 }}
                    className="relative"
                    style={ratio ? { aspectRatio: ratio } : undefined}
                  >
                    {!loadedPages.has(pageNo) && (
                      <div className="absolute flex h-full w-full items-center justify-center rounded-lg bg-muted/60 px-2 py-1 backdrop-blur">
                        <Loader2 className="h-16 w-16 animate-spin text-primary sm:h-20 sm:w-20" />
                      </div>
                    )}
                    <canvas
                      data-page={pageNo}
                      ref={(el) => {
                        scrollCanvasRefs.current[idx] = el;
                      }}
                      className="h-full w-full select-none rounded-lg bg-muted shadow-xl"
                    />
                  </motion.div>
                );
              })}
            </div>
          )}
        </ReaderZoomViewport>
      </main>

      {/* Toolbar */}
      <ReaderToolbar
        contentMode="image"
        currentPage={currentPage}
        totalPages={totalPages}
        brightness={brightness}
        readMode={readMode}
        currentChapter={currentChapter}
        chapters={chapters}
        onPageChange={handlePageChange}
        onBrightnessChange={setBrightness}
        onReadModeChange={setReadMode}
        onChapterChange={handleChapterChange}
        book={book}
        typeSlug={typeSlug}
        onPurchased={handlePurchased}
        fullscreenTarget={readerRootEl}
        zoom={zoom}
      />

      {menuPos && (
        <ReaderContextMenu
          x={menuPos.x}
          y={menuPos.y}
          onClose={() => setMenuPos(null)}
          canResetZoom={zoom.isZoomed}
          activeFilter={readerFilter}
          onAction={(action) => {
            if (!action.startsWith('filter-')) setMenuPos(null);

            switch (action) {
              case 'reset-zoom':
                zoom.resetZoom();
                break;
              case 'reload':
                window.location.reload();
                break;
              case 'fullscreen':
                toggleFullscreen();
                break;
              // Contrast Filters
              case 'filter-none':
                setReaderFilter('');
                break;
              case 'filter-sepia':
                setReaderFilter('sepia(100%)');
                break;
              case 'filter-paper':
                setReaderFilter('sepia(20%) brightness(0.9) contrast(1.1)');
                break;
              case 'filter-e-ink':
                setReaderFilter('grayscale(100%) contrast(150%)');
                break;
              default:
                console.warn(`Action ${action} not implemented.`);
            }
          }}
        />
      )}
    </div>
  );
}
