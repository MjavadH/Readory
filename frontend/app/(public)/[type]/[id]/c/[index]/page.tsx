"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { ReaderToolbar } from "@/components/reader/reader-toolbar";
import {Loader2} from "lucide-react";
import { Toast } from "@/components/toast";
import {ReaderContextMenu} from "@/components/reader/reader-context-menu";

type SessionResponse = {
    chapterId: number;
    bookId: number;
    chapterIndex: number;
    contentType: "images" | "text" | null;
    pageCount: number;
    contentVersion: number;
    resume: { lastPage: number; percent: number } | null;
    sessionToken: string;
};

type Manifest = {
    version: 1;
    format: "images" | "text";
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

export default function ChapterPage() {
    const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
    const router = useRouter();
    const params = useParams<{ type: string; id: string; index: string }>();

    const idParam = Array.isArray(params.id) ? params.id[0] : params.id;
    const indexParam = Array.isArray(params.index) ? params.index[0] : params.index;
    const typeSlug = Array.isArray(params.type) ? params.type[0] : params.type;

    const bookId = Number(idParam);
    const chapterIndex = Number(indexParam);

    const backUrl = useMemo(
        () => `/${encodeURIComponent(typeSlug)}/${bookId}`,
        [typeSlug, bookId]
    );

    const [session, setSession] = useState<SessionResponse | null>(null);
    const [manifest, setManifest] = useState<Manifest | null>(null);
    const [textHtml, setTextHtml] = useState<string>("");
    const [readerCtx, setReaderCtx] = useState<ReaderContextResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [brightness, setBrightness] = useState(100);
    const [readMode, setReadMode] = useState<"scroll" | "page">("page");
    const [currentPage, setCurrentPage] = useState(1);
    const pageCanvasRef = useRef<HTMLCanvasElement | null>(null); // page mode
    const scrollCanvasRefs = useRef<Array<HTMLCanvasElement | null>>([]); // scroll mode
    const loadedPagesRef = useRef<Set<number>>(new Set());
    const pageBlobCacheRef = useRef<Map<number, Blob>>(new Map()); // key: page number (1-based)
    const drawingSetRef = useRef<Set<number>>(new Set());
    const [loadedPages, setLoadedPages] = useState<Set<number>>(new Set());
    const [pageCanvasEl, setPageCanvasEl] = useState<HTMLCanvasElement | null>(null);
    const [visiblePageDrawn, setVisiblePageDrawn] = useState<number | null>(null);
    const inFlightPagesRef = useRef<Map<number, Promise<void>>>(new Map());
    const [pageTransitionLoading, setPageTransitionLoading] = useState(false);
    const pageDrawRequestIdRef = useRef(0);
    const lastSavedPageRef = useRef<number | null>(null);
    const totalPages = manifest?.pageCount ?? session?.pageCount ?? 1;
    const maxReachedPageRef = useRef(1);
    const progressCompletedRef = useRef(false);
    const readerRootRef = useRef<HTMLDivElement | null>(null);
    const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);

    const currentChapter =
        readerCtx?.chapters.find((c) => c.index === chapterIndex) ??
        ({
            id: session?.chapterId ?? 0,
            index: chapterIndex,
            title: `Chapter ${chapterIndex}`,
            pageCount: session?.pageCount ?? 1,
            locked: false,
        } satisfies ReaderChapterItem);

    const chapters = readerCtx?.chapters ?? [currentChapter];

    const handleContextMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault(); // Disable default browser menu

        // Ensure menu stays within screen bounds
        const x = Math.min(e.clientX, window.innerWidth - 180);
        const y = Math.min(e.clientY, window.innerHeight - 200);

        setMenuPos({ x, y });
    }, []);

    const resetChapterRenderState = useCallback(() => {
        pageBlobCacheRef.current.clear();
        drawingSetRef.current.clear();
        inFlightPagesRef.current.clear();
        loadedPagesRef.current = new Set();
        setLoadedPages(new Set());
        setVisiblePageDrawn(null);
        setPageCanvasEl(null);
        scrollCanvasRefs.current = [];
        pageCanvasRef.current = null;
    }, []);

    const fetchPageBlob = useCallback(
        async (page: number): Promise<Blob> => {
            if (!session) throw new Error("No reader session");

            // Limit cache size to 10 items
            if (pageBlobCacheRef.current.size > 10) {
                const firstKey = pageBlobCacheRef.current.keys().next().value;
                if (firstKey !== undefined) {
                    pageBlobCacheRef.current.delete(firstKey);
                }
            }

            const cached = pageBlobCacheRef.current.get(page);
            if (cached) return cached;

            const res = await fetch(
                `${process.env.NEXT_PUBLIC_API_BASE}/reader/page?token=${encodeURIComponent(
                    session.sessionToken
                )}&p=${page}`,
                {
                    credentials: "include",
                    cache: "no-store",
                }
            );

            if (!res.ok) {
                if (res.status === 401) {
                    setToast({ message: "token expired, Please refresh the page.", type: "error" });
                } else if (res.status === 429) {
                    setToast({ message: "Temporarily blocked due to abnormal behavior. Please try again in 1 minute.", type: "error" });
                }
                throw new Error(`Failed page ${page} (${res.status})`);
            }

            const blob = await res.blob();
            pageBlobCacheRef.current.set(page, blob);
            return blob;
        },
        [session]
    );

    const drawBlobToCanvas = useCallback(async (blob: Blob, canvas: HTMLCanvasElement) => {
        const bitmap = await createImageBitmap(blob);
        try {
            const needResize = canvas.width !== bitmap.width || canvas.height !== bitmap.height;

            if (needResize) {
                canvas.width = bitmap.width;
                canvas.height = bitmap.height;
            }

            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            ctx.drawImage(bitmap, 0, 0);
        } finally {
            if (typeof (bitmap as any).close === "function") {
                (bitmap as any).close();
            }
        }
    }, []);

    const drawPageToCanvas = useCallback(
        async (page: number, canvas: HTMLCanvasElement | null) => {
            if (!canvas || !session) return;

            const maxPage = manifest?.pageCount ?? session.pageCount ?? 1;
            if (page < 1 || page > maxPage) return;
            if (canvas.dataset.renderedPage === String(page)) return;

            let blob = pageBlobCacheRef.current.get(page);

            // Logic to retrieve the blob (from cache, in-flight, or new fetch)
            if (!blob) {
                const existingTask = inFlightPagesRef.current.get(page);
                if (existingTask) {
                    await existingTask;
                    blob = pageBlobCacheRef.current.get(page);
                } else {
                    const newTask = (async () => {
                        const b = await fetchPageBlob(page);
                        pageBlobCacheRef.current.set(page, b);
                    })();
                    inFlightPagesRef.current.set(page, newTask);
                    try {
                        await newTask;
                        blob = pageBlobCacheRef.current.get(page);
                    } finally {
                        inFlightPagesRef.current.delete(page);
                    }
                }
            }

            // Final render and state update logic
            if (blob) {
                await drawBlobToCanvas(blob, canvas);
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
        [session, manifest, fetchPageBlob, drawBlobToCanvas]
    );

    // Initial load (session + context + manifest/text)
    useEffect(() => {
        let cancelled = false;

        const run = async () => {
            if (!Number.isInteger(bookId) || !Number.isInteger(chapterIndex) || bookId <= 0 || chapterIndex <= 0) {
                setError("Invalid chapter link");
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);
            resetChapterRenderState();

            try {
                apiClient
                    .get<ReaderContextResponse>("/reader/context", { query: { bookId } })
                    .then((ctx) => {
                        if (!cancelled) setReaderCtx(ctx);
                    })
                    .catch(() => {
                        // non-fatal
                    });

                const s = await apiClient.post<SessionResponse, { bookId: number; chapterIndex: number }>(
                    "/reader/session",
                    { bookId, chapterIndex }
                );
                if (cancelled) return;

                setSession(s);

                const startPage = Math.max(1, Math.min(s.pageCount || 1, s.resume?.lastPage ?? 1));
                maxReachedPageRef.current = startPage;
                lastSavedPageRef.current = s.resume?.lastPage ?? 0;
                progressCompletedRef.current = (s.resume?.lastPage ?? 0) >= (s.pageCount || 1);
                setCurrentPage(progressCompletedRef ? 1 : startPage);

                if (s.contentType === "images") {
                    const m = await apiClient.get<Manifest>("/reader/manifest", {
                        query: { token: s.sessionToken },
                    });
                    if (cancelled) return;
                    setManifest(m);

                } else if (s.contentType === "text") {
                    const t = await apiClient.get<{ html: string }>("/reader/text", {
                        query: { token: s.sessionToken },
                    });
                    if (cancelled) return;
                    setTextHtml(t.html);
                } else {
                    setError("Chapter content is unavailable");
                }
            } catch (e) {
                if (!cancelled) setError(getApiErrorMessage(e, "Unable to open chapter"));
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        void run();

        return () => {
            cancelled = true;
        };
    }, [bookId, chapterIndex, resetChapterRenderState]);

    useEffect(() => {
        maxReachedPageRef.current = Math.max(maxReachedPageRef.current, currentPage);
    }, [currentPage]);

    // Clear render cache when session token changes
    useEffect(() => {
        resetChapterRenderState();
    }, [session?.sessionToken, resetChapterRenderState]);

    // Page mode: draw current page to single canvas
    useEffect(() => {
        if (!session || !manifest || manifest.format !== "images") return;
        if (readMode !== "page") return;
        if (!pageCanvasEl) return;

        let cancelled = false;
        const reqId = ++pageDrawRequestIdRef.current;

        setPageTransitionLoading(true);

        const run = async () => {
            try {
                await drawPageToCanvas(currentPage, pageCanvasEl);

                if (!cancelled && reqId === pageDrawRequestIdRef.current) {
                    setVisiblePageDrawn(currentPage);
                }
            } catch {
                // ignore page-level error
            } finally {
                if (!cancelled && reqId === pageDrawRequestIdRef.current) {
                    setPageTransitionLoading(false);
                }
            }
        };

        void run();

        return () => {
            cancelled = true;
        };
    }, [session, manifest, readMode, currentPage, pageCanvasEl, drawPageToCanvas]);

    // Scroll mode
    useEffect(() => {
        if (!session || !manifest || manifest.format !== "images") return;
        if (readMode !== "scroll") return;

        // Use IntersectionObserver for optimal mobile performance
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const canvas = entry.target as HTMLCanvasElement;
                        const pageStr = canvas.dataset.page;
                        if (pageStr) {
                            void drawPageToCanvas(Number(pageStr), canvas);
                        }
                    }
                });
            },
            {
                rootMargin: "600px 0px", // Preload pages before they enter the viewport
                threshold: 0.01,
            }
        );

        const refs = scrollCanvasRefs.current;
        refs.forEach((canvas) => {
            if (canvas) observer.observe(canvas);
        });

        return () => observer.disconnect();
    }, [session, manifest, readMode, drawPageToCanvas]);

    // Track currentPage in scroll mode by viewport center
    useEffect(() => {
        if (readMode !== "scroll") return;
        if (!manifest || manifest.format !== "images") return;

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
                rootMargin: "-50% 0px -50% 0px", // Trigger when the center of the canvas hits the center of the screen
                threshold: 0,
            }
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
                .post("/reader/progress", {
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
                .post("/reader/progress", {
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
            if (document.visibilityState === "hidden") saveNow();
        };

        window.addEventListener("beforeunload", saveNow);
        document.addEventListener("visibilitychange", onVisibility);

        return () => {
            window.removeEventListener("beforeunload", saveNow);
            document.removeEventListener("visibilitychange", onVisibility);
        };
    }, [session, currentPage]);

    // Keyboard navigation (page mode)
    useEffect(() => {
        if (readMode !== "page") return;

        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                e.preventDefault();
                handlePageChange(currentPage - 1);
            } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                e.preventDefault();
                handlePageChange(currentPage + 1);
            }
        };

        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [readMode, currentPage]);

    const handleChapterChange = useCallback(
        (chapter: ReaderChapterItem) => {
            router.push(`/${encodeURIComponent(typeSlug)}/${bookId}/c/${chapter.index}`);
        },
        [router, typeSlug, bookId]
    );

    const handlePurchase = useCallback(() => {
        router.push(backUrl);
    }, [router, backUrl]);

    const handlePageChange = useCallback(
        (nextPage: number) => {
            const total = manifest?.pageCount ?? session?.pageCount ?? 1;

            if (nextPage < 1 || nextPage > total) {
                return;
            }

            setCurrentPage(nextPage);

            if (readMode === "scroll") {
                const target = scrollCanvasRefs.current[nextPage - 1];
                target?.scrollIntoView({ behavior: "smooth", block: "start" });
            }
        },
        [manifest, session, chapters, currentChapter.index, handleChapterChange, handlePurchase, readMode]
    );

    if (error) {
        return (
            <div className="container mx-auto px-4 py-10 space-y-4">
                <p className="text-destructive">{error}</p>
                <Link className="text-sm underline" href={backUrl}>
                    Back to book page
                </Link>
            </div>
        );
    }

    if (loading || !session) {
        return (
            <div className="min-h-screen bg-reader-bg">
                <div className="max-w-4xl mx-auto px-4 py-8 space-y-4">
                    <div className="h-12 rounded-xl bg-muted animate-pulse" />
                    <div className="h-[60vh] rounded-2xl bg-muted animate-pulse" />
                </div>
            </div>
        );
    }

    // Text mode
    if (session.contentType === "text") {
        return (
            <div ref={readerRootRef} className="min-h-screen bg-reader-bg">
                <main onContextMenu={handleContextMenu} className="pt-20 pb-10">
                    <div className="max-w-3xl mx-auto px-4">
                        <article
                            className="prose select-none prose-invert max-w-none rounded-2xl border bg-card/60 p-6"
                            dangerouslySetInnerHTML={{ __html: textHtml }}
                        />
                    </div>
                </main>

                <ReaderToolbar
                    currentPage={1}
                    totalPages={1}
                    brightness={brightness}
                    readMode="scroll"
                    currentChapter={currentChapter}
                    chapters={chapters}
                    onPageChange={() => {}}
                    onBrightnessChange={setBrightness}
                    onReadModeChange={() => {}}
                    onChapterChange={handleChapterChange}
                    onPurchase={handlePurchase}
                    showReadModeToggle={false}
                    fullscreenTarget={readerRootRef.current}
                />

            </div>
        );
    }

    return (
        <div ref={readerRootRef} className="min-h-screen bg-reader-bg">
            {/* Main content */}
            <main onContextMenu={handleContextMenu} className="pt-16 pb-24">
                {readMode === "page" ? (
                    <div className="max-w-2xl mx-auto px-4 pt-8 flex items-center justify-center min-h-[calc(100vh-10rem)]">
                        <div className="w-full">
                            <div className="relative">
                                {pageTransitionLoading && visiblePageDrawn !== null && (
                                    <div className="absolute flex w-full h-full justify-center items-center rounded-lg bg-muted/60 px-2 py-1 backdrop-blur">
                                        <Loader2 className="h-20 w-20 animate-spin text-primary" />
                                    </div>
                                )}

                                <canvas
                                    ref={setPageCanvasEl}
                                    className="w-full h-full select-none rounded-lg shadow-xl bg-muted"
                                />
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="max-w-2xl mx-auto px-4 space-y-4 pt-8">
                        {Array.from({ length: manifest?.pageCount ?? 0 }).map((_, idx) => {
                            const pageNo = idx + 1;
                            const meta = manifest?.pages?.[idx];
                            const ratio = meta?.w && meta?.h ? `${meta.w} / ${meta.h}` : undefined;
                            return (
                                <motion.div
                                    key={pageNo}
                                    initial={{ opacity: 0, y: 24 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true, margin: "-40px" }}
                                    transition={{ duration: 0.25 }}
                                    className="relative"
                                    style={ratio ? { aspectRatio: ratio } : undefined}
                                >
                                    {!loadedPages.has(pageNo) && (
                                        <div className="absolute flex w-full h-full justify-center items-center rounded-lg bg-muted/60 px-2 py-1 backdrop-blur">
                                            <Loader2 className="h-20 w-20 animate-spin text-primary" />
                                        </div>
                                    )}
                                    <canvas
                                        data-page={pageNo}
                                        ref={(el) => {
                                            scrollCanvasRefs.current[idx] = el;
                                        }}
                                        className="w-full h-full select-none rounded-lg shadow-xl bg-muted"
                                    />
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </main>

            {/* Toolbar */}
            <ReaderToolbar
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
                onPurchase={handlePurchase}
                fullscreenTarget={readerRootRef.current}
            />

            {menuPos && (
                <ReaderContextMenu
                    x={menuPos.x}
                    y={menuPos.y}
                    onClose={() => setMenuPos(null)}
                    onAction={(action) => {
                        setMenuPos(null);

                        switch (action) {
                            case 'reload':
                                window.location.reload();
                                break;

                            case 'fullscreen':
                                const element = readerRootRef.current;
                                if (!element) return;

                                if (!document.fullscreenElement) {
                                    // Enter fullscreen for the specific reader container
                                    element.requestFullscreen().catch(() => {
                                        setToast({
                                            message: "Fullscreen was blocked by your browser.",
                                            type: "error"
                                        });
                                    });
                                } else {
                                    if (document.exitFullscreen) {
                                        document.exitFullscreen();
                                    }
                                }
                                break;

                            default:
                                console.warn(`Action ${action} not implemented.`);
                        }
                    }}
                />
            )}

            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
        </div>
    );
}