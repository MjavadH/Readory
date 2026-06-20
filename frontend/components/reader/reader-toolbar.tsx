"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Sun,
    ChevronLeft,
    ChevronRight,
    BookOpen,
    Lock,
    Layers,
    ScrollText,
    X,
    Maximize,
    Minimize,
    Check,
} from "lucide-react";
import { useTranslations } from "next-intl";
import {
    ChapterPurchaseDialog,
    type PurchaseDialogBook,
    type PurchaseDialogChapter,
} from "@/components/chapter-purchase-dialog";

export type ReaderChapterItem = {
    id: number;
    index: number;
    title: string;
    pageCount: number;
    locked: boolean;
    price?: number | null;
};

interface ReaderToolbarProps {
    currentPage: number;
    totalPages: number;
    brightness: number;
    readMode: "scroll" | "page";
    currentChapter: ReaderChapterItem;
    chapters: ReaderChapterItem[];
    onPageChange: (page: number) => void;
    onBrightnessChange: (val: number) => void;
    onReadModeChange: (mode: "scroll" | "page") => void;
    onChapterChange: (chapter: ReaderChapterItem) => void;
    book: PurchaseDialogBook | null;
    typeSlug: string;
    onPurchased?: (chapterId: number) => void;
    showReadModeToggle?: boolean;
    fullscreenTarget?: HTMLElement | null;
}

export function ReaderToolbar({
                                  currentPage,
                                  totalPages,
                                  brightness,
                                  readMode,
                                  currentChapter,
                                  chapters,
                                  onPageChange,
                                  onBrightnessChange,
                                  onReadModeChange,
                                  onChapterChange,
                                  book,
                                  typeSlug,
                                  onPurchased,
                                  showReadModeToggle = true,
                                  fullscreenTarget = null,
                              }: ReaderToolbarProps) {
    const t = useTranslations("Books");
    const g = useTranslations("General");
    const [showBrightness, setShowBrightness] = useState(false);
    const [showChapters, setShowChapters] = useState(false);
    const [visible, setVisible] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isRtl, setIsRtl] = useState(false);
    const [purchaseTarget, setPurchaseTarget] = useState<ReaderChapterItem | null>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const panelOpen = showChapters || showBrightness || purchaseTarget !== null;

    useEffect(() => {
        setIsRtl(getComputedStyle(document.documentElement).direction === "rtl");
    }, []);

    useEffect(() => {
        const handleMove = () => {
            setVisible(true);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => setVisible(false), 3500);
        };
        window.addEventListener("mousemove", handleMove);
        window.addEventListener("touchstart", handleMove);
        handleMove();
        return () => {
            window.removeEventListener("mousemove", handleMove);
            window.removeEventListener("touchstart", handleMove);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    useEffect(() => {
        const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
        document.addEventListener("fullscreenchange", onFsChange);
        onFsChange();
        return () => document.removeEventListener("fullscreenchange", onFsChange);
    }, []);

    const toggleFullscreen = async () => {
        try {
            if (document.fullscreenElement) {
                await document.exitFullscreen();
                return;
            }
            const target = fullscreenTarget ?? document.documentElement;
            if (target?.requestFullscreen) await target.requestFullscreen();
        } catch {
            /* no-op: fullscreen can be blocked by the browser */
        }
    };

    const prevChapter = chapters.find((c) => c.index === currentChapter.index - 1);
    const nextChapter = chapters.find((c) => c.index === currentChapter.index + 1);
    const progress = totalPages > 1 ? Math.round((currentPage / totalPages) * 100) : 100;

    const openPurchase = (chapter: ReaderChapterItem) => {
        // Without book metadata the dialog can't render; fall back to selecting the chapter.
        if (!book) {
            onChapterChange(chapter);
            setShowChapters(false);
            return;
        }
        setShowChapters(false);
        setPurchaseTarget(chapter);
    };

    const toDialogChapter = (chapter: ReaderChapterItem): PurchaseDialogChapter => ({
        id: chapter.id,
        title: chapter.title,
        index: chapter.index,
        isFree: false,
        price: chapter.price ?? null,
        mode: "purchase",
    });

    return (
        <>
            {/* Brightness dimming overlay */}
            {brightness < 100 && (
                <div
                    className="pointer-events-none fixed inset-0 z-100"
                    style={{ backgroundColor: `rgba(0,0,0,${((100 - brightness) / 100) * 0.7})` }}
                />
            )}

            {/* Bottom toolbar */}
            <AnimatePresence>
                {(visible || panelOpen) && (
                    <motion.div
                        initial={{ y: 90, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 90, opacity: 0 }}
                        transition={{ type: "spring", damping: 26, stiffness: 320 }}
                        className="fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] flex justify-center px-3"
                    >
                        <div className="toolbar-glass pointer-events-auto flex w-full max-w-md items-center justify-between gap-1 rounded-2xl px-2 py-1.5 shadow-2xl ring-1 ring-border/60 sm:w-auto sm:gap-1.5 sm:px-3 sm:py-2">
                            {/* Read mode toggle */}
                            {showReadModeToggle && (
                                <>
                                    <ToolbarButton
                                        icon={
                                            readMode === "scroll" ? (
                                                <Layers className="h-5 w-5" />
                                            ) : (
                                                <ScrollText className="h-5 w-5" />
                                            )
                                        }
                                        label={readMode === "scroll" ? t("PageMode") : t("ScrollMode")}
                                        onClick={() => onReadModeChange(readMode === "scroll" ? "page" : "scroll")}
                                    />
                                    <Divider />
                                </>
                            )}

                            {/* Page navigation */}
                            <ToolbarButton
                                icon={<ChevronLeft className="h-5 w-5 rtl:rotate-180" />}
                                label={t("PreviousPage")}
                                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                                disabled={currentPage <= 1 && !prevChapter}
                            />

                            <div className="flex min-w-18 flex-col items-center gap-1 px-1">
                                <span className="text-xs font-semibold tabular-nums text-foreground/90">
                                    {currentPage} / {totalPages}
                                </span>
                                <span className="h-1 w-full overflow-hidden rounded-full bg-border/70" aria-hidden="true">
                                    <span
                                        className="block h-full rounded-full bg-primary transition-[width] duration-300"
                                        style={{ width: `${progress}%` }}
                                    />
                                </span>
                            </div>

                            <ToolbarButton
                                icon={<ChevronRight className="h-5 w-5 rtl:rotate-180" />}
                                label={t("NextPage")}
                                onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                                disabled={currentPage >= totalPages && !nextChapter}
                            />

                            <Divider />

                            {/* Fullscreen */}
                            <ToolbarButton
                                icon={isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
                                label={isFullscreen ? t("ExitFullscreen") : t("Fullscreen")}
                                onClick={toggleFullscreen}
                            />

                            <Divider />

                            {/* Brightness */}
                            <div className="relative">
                                <ToolbarButton
                                    icon={<Sun className="h-5 w-5" />}
                                    label={t("Brightness")}
                                    onClick={() => {
                                        setShowBrightness((s) => !s);
                                        setShowChapters(false);
                                    }}
                                    active={showBrightness}
                                />
                                <AnimatePresence>
                                    {showBrightness && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10, scale: 0.96 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: 10, scale: 0.96 }}
                                            className="toolbar-glass absolute bottom-full left-1/2 mb-3 w-52 -translate-x-1/2 rounded-2xl p-4 shadow-2xl ring-1 ring-border/60"
                                        >
                                            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                                                <span>{t("Brightness")}</span>
                                                <span className="font-semibold tabular-nums text-foreground">{brightness}%</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <Sun className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                                <input
                                                    type="range"
                                                    min={20}
                                                    max={100}
                                                    value={brightness}
                                                    onChange={(e) => onBrightnessChange(Number(e.target.value))}
                                                    aria-label={t("Brightness")}
                                                    className="h-1.5 w-full cursor-pointer accent-primary"
                                                />
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            <Divider />

                            {/* Chapters */}
                            <ToolbarButton
                                icon={<BookOpen className="h-5 w-5" />}
                                label={t("Chapters")}
                                onClick={() => {
                                    setShowChapters((s) => !s);
                                    setShowBrightness(false);
                                }}
                                active={showChapters}
                            />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Chapter drawer */}
            <AnimatePresence>
                {showChapters && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-70 bg-black/50 backdrop-blur-sm"
                            onClick={() => setShowChapters(false)}
                        />
                        <motion.aside
                            initial={{ x: isRtl ? "-100%" : "100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: isRtl ? "-100%" : "100%" }}
                            transition={{ type: "spring", damping: 32, stiffness: 320 }}
                            className="toolbar-glass fixed inset-y-0 inset-e-0 z-80 flex w-[88vw] max-w-sm flex-col border-s border-border shadow-2xl"
                            role="dialog"
                            aria-label={t("Chapters")}
                        >
                            <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-4 pt-[max(1rem,env(safe-area-inset-top))]">
                                <div className="min-w-0">
                                    <h3 className="truncate text-base font-semibold text-foreground">{t("Chapters")}</h3>
                                    {book?.title && (
                                        <p className="truncate text-xs text-muted-foreground">{book.title}</p>
                                    )}
                                </div>
                                <button
                                    onClick={() => setShowChapters(false)}
                                    aria-label={g("Cancel")}
                                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground/70 transition-colors hover:bg-secondary hover:text-foreground"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </header>

                            <div className="flex-1 overflow-y-auto overscroll-contain p-2">
                                {chapters.map((ch, i) => {
                                    const isCurrent = ch.index === currentChapter.index;
                                    return (
                                        <motion.button
                                            key={ch.id}
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: Math.min(i * 0.02, 0.3) }}
                                            onClick={() => {
                                                if (ch.locked) {
                                                    openPurchase(ch);
                                                } else {
                                                    onChapterChange(ch);
                                                    setShowChapters(false);
                                                }
                                            }}
                                            aria-current={isCurrent ? "true" : undefined}
                                            className={`group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-start transition-colors ${
                                                isCurrent
                                                    ? "bg-primary/15 text-primary"
                                                    : "text-foreground/80 hover:bg-secondary hover:text-foreground"
                                            }`}
                                        >
                                            <span
                                                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold tabular-nums ${
                                                    isCurrent
                                                        ? "bg-primary text-primary-foreground"
                                                        : "bg-secondary text-muted-foreground group-hover:text-foreground"
                                                }`}
                                            >
                                                {ch.index}
                                            </span>

                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm font-medium">{ch.title}</span>
                                                <span className="block text-xs text-muted-foreground">
                                                    {ch.pageCount}p
                                                </span>
                                            </span>

                                            {ch.locked ? (
                                                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                                                    <Lock className="h-3 w-3" />
                                                    {Number(ch.price ?? 0).toFixed(2)}
                                                </span>
                                            ) : isCurrent ? (
                                                <Check className="h-4 w-4 shrink-0 text-primary" />
                                            ) : null}
                                        </motion.button>
                                    );
                                })}
                            </div>
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>

            {/* In-place purchase dialog for locked chapters */}
            {purchaseTarget && book && (
                <ChapterPurchaseDialog
                    book={book}
                    chapter={toDialogChapter(purchaseTarget)}
                    typeSlug={typeSlug}
                    onPurchased={(chapterId) => {
                        onPurchased?.(chapterId);
                        setPurchaseTarget(null);
                    }}
                    onClose={() => setPurchaseTarget(null)}
                />
            )}
        </>
    );
}

function ToolbarButton({
                           icon,
                           label,
                           onClick,
                           disabled,
                           active,
                           className = "",
                       }: {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    disabled?: boolean;
    active?: boolean;
    className?: string;
}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            title={label}
            aria-label={label}
            aria-pressed={active}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-150 ${
                active
                    ? "bg-primary/20 text-primary"
                    : "text-foreground/70 hover:bg-secondary hover:text-foreground"
            } disabled:cursor-not-allowed disabled:opacity-30 ${className}`}
        >
            {icon}
        </button>
    );
}

function Divider() {
    return <div className="mx-0.5 h-5 w-px shrink-0 bg-border/60" />;
}
