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
} from "lucide-react";

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
    onPurchase: (chapter: ReaderChapterItem) => void;
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
                                  onPurchase,
                                  showReadModeToggle = true,
                                  fullscreenTarget = null,
                              }: ReaderToolbarProps) {
    const [showBrightness, setShowBrightness] = useState(false);
    const [showChapters, setShowChapters] = useState(false);
    const [visible, setVisible] = useState(true);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        const handleMove = () => {
            setVisible(true);
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            timeoutRef.current = setTimeout(() => setVisible(false), 3500);
        };
        window.addEventListener("mousemove", handleMove);
        window.addEventListener("touchstart", handleMove);
        handleMove();
        return () => {
            window.removeEventListener("mousemove", handleMove);
            window.removeEventListener("touchstart", handleMove);
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    useEffect(() => {
        const onFsChange = () => {
            setIsFullscreen(Boolean(document.fullscreenElement));
        };

        document.addEventListener("fullscreenchange", onFsChange);
        onFsChange();

        return () => {
            document.removeEventListener("fullscreenchange", onFsChange);
        };
    }, []);

    const toggleFullscreen = async () => {
        try {
            if (document.fullscreenElement) {
                await document.exitFullscreen();
                return;
            }

            const target = fullscreenTarget ?? document.documentElement;
            if (target?.requestFullscreen) {
                await target.requestFullscreen();
            }
        } catch {

        }
    };

    const prevChapter = chapters.find((c) => c.index === currentChapter.index - 1);
    const nextChapter = chapters.find((c) => c.index === currentChapter.index + 1);

    return (
        <>
            {/* Brightness overlay */}
            {brightness < 100 && (
                <div
                    className="fixed inset-0 pointer-events-none z-100"
                    style={{
                        backgroundColor: `rgba(0,0,0,${(100 - brightness) / 100 * 0.7})`,
                    }}
                />
            )}

            {/* Bottom toolbar */}
            <AnimatePresence>
                {visible && (
                    <motion.div
                        initial={{ y: 80, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 80, opacity: 0 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-60"
                    >
                        <div className="toolbar-glass rounded-2xl px-3 py-2 flex items-center gap-1 sm:gap-2 shadow-2xl">
                            {/* Read mode toggle */}
                            {showReadModeToggle && (
                                <>
                                    <ToolbarButton
                                        icon={readMode === "scroll" ? <Layers className="w-4 h-4" /> : <ScrollText className="w-4 h-4" />}
                                        label={readMode === "scroll" ? "Page mode" : "Scroll mode"}
                                        onClick={() => onReadModeChange(readMode === "scroll" ? "page" : "scroll")}
                                    />
                                    <Divider />
                                </>
                            )}

                            {/* Page navigation */}
                            <ToolbarButton
                                icon={<ChevronLeft className="w-4 h-4" />}
                                label="Previous page"
                                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                                disabled={currentPage <= 1 && !prevChapter}
                            />

                            <span className="text-xs font-medium text-foreground/80 min-w-16 text-center tabular-nums">
                                {currentPage} / {totalPages}
                            </span>

                            <ToolbarButton
                                icon={<ChevronRight className="w-4 h-4" />}
                                label="Next page"
                                onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                                disabled={currentPage >= totalPages && !nextChapter}
                            />

                            <Divider />

                            {/* Fullscreen */}
                            <ToolbarButton
                                icon={
                                    isFullscreen ? (
                                        <Minimize className="w-4 h-4" />
                                    ) : (
                                        <Maximize className="w-4 h-4" />
                                    )
                                }
                                label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                                onClick={toggleFullscreen}
                            />

                            <Divider />

                            {/* Brightness */}
                            <div className="relative">
                                <ToolbarButton
                                    icon={<Sun className="w-4 h-4" />}
                                    label="Brightness"
                                    onClick={() => { setShowBrightness(!showBrightness); setShowChapters(false); }}
                                    active={showBrightness}
                                />
                                <AnimatePresence>
                                    {showBrightness && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                            className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 toolbar-glass rounded-xl p-4 w-48"
                                        >
                                            <div className="flex items-center gap-3">
                                                <Sun className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                                <input
                                                    type="range"
                                                    min={20}
                                                    max={100}
                                                    value={brightness}
                                                    onChange={(e) => onBrightnessChange(Number(e.target.value))}
                                                    className="w-full accent-primary h-1 cursor-pointer"
                                                />
                                                <span className="text-xs text-muted-foreground w-7 text-right tabular-nums">{brightness}%</span>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            <Divider />

                            {/* Chapters */}
                            <ToolbarButton
                                icon={<BookOpen className="w-4 h-4" />}
                                label="Chapters"
                                onClick={() => { setShowChapters(!showChapters); setShowBrightness(false); }}
                                active={showChapters}
                            />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Chapter sidebar */}
            <AnimatePresence>
                {showChapters && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/50 z-70"
                            onClick={() => setShowChapters(false)}
                        />
                        <motion.div
                            initial={{ x: "100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "100%" }}
                            transition={{ type: "spring", damping: 30, stiffness: 300 }}
                            className="fixed right-0 top-0 bottom-0 w-80 max-w-[85vw] z-80 toolbar-glass border-l border-border overflow-y-auto"
                        >
                            <div className="p-4 flex items-center justify-between border-b border-border">
                                <h3 className="font-serif font-semibold text-foreground">Chapters</h3>
                                <button onClick={() => setShowChapters(false)} className="p-1 rounded-md hover:bg-secondary transition-colors">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="p-2">
                                {chapters.map((ch, i) => (
                                    <motion.button
                                        key={ch.id}
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.03 }}
                                        onClick={() => {
                                            if (ch.locked) {
                                                onPurchase(ch);
                                            } else {
                                                onChapterChange(ch);
                                                setShowChapters(false);
                                            }
                                        }}
                                        className={`w-full text-left px-3 py-3 rounded-lg flex items-center gap-3 transition-all group ${
                                            ch.index === currentChapter.index 
                                                ? "bg-primary/15 text-primary"
                                                : "hover:bg-secondary text-foreground/80 hover:text-foreground"
                                        }`}
                                    >
                                        <span className="text-xs font-medium w-6 text-center text-muted-foreground tabular-nums">
                                            {ch.index}
                                        </span>
                                        <span className="flex-1 text-sm font-medium truncate">{ch.title}</span>
                                        {ch.locked ? (
                                            <span className="flex items-center gap-1.5 text-xs">
                                                <Lock className="w-3 h-3 text-muted-foreground" />
                                                <span className="text-primary font-semibold">${ch.price?.toFixed(2)}</span>
                                            </span>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">{ch.pageCount}p</span>
                                        )}
                                    </motion.button>
                                ))}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}

function ToolbarButton({
                           icon,
                           label,
                           onClick,
                           disabled,
                           active,
                       }: {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    disabled?: boolean;
    active?: boolean;
}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            title={label}
            className={`p-2 rounded-lg transition-all duration-150 ${
                active
                    ? "bg-primary/20 text-primary"
                    : "text-foreground/70 hover:text-foreground hover:bg-secondary"
            } disabled:opacity-30 disabled:cursor-not-allowed`}
        >
            {icon}
        </button>
    );
}

function Divider() {
    return <div className="w-px h-5 bg-border/50 mx-0.5" />;
}
