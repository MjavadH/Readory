'use client';

import { useState, useRef, useEffect, useLayoutEffect, useCallback, type ReactNode } from 'react';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

import { motion, AnimatePresence } from 'framer-motion';
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
  ZoomIn,
  ZoomOut,
  Hash,
  CornerDownLeft,
  MoreHorizontal,
  Settings2,
  RotateCcw,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  ChapterPurchaseDialog,
  type PurchaseDialogBook,
  type PurchaseDialogChapter,
} from '@/components/chapter-purchase-dialog';
import { useLocaleInfo } from '@/hooks/use-locale-info';
import type { ReaderZoomApi } from '@/components/reader/reader-zoom';

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
  readMode: 'scroll' | 'page';
  currentChapter: ReaderChapterItem;
  chapters: ReaderChapterItem[];
  onPageChange: (page: number) => void;
  onBrightnessChange: (val: number) => void;
  onReadModeChange: (mode: 'scroll' | 'page') => void;
  onChapterChange: (chapter: ReaderChapterItem) => void;
  book: PurchaseDialogBook | null;
  typeSlug: string;
  onPurchased?: (chapterId: number) => void;
  showReadModeToggle?: boolean;
  fullscreenTarget?: HTMLElement | null;
  /** Zoom api from useReaderZoom(); when omitted the zoom controls are hidden. */
  zoom?: ReaderZoomApi;
}

type PanelKey = 'brightness' | 'jump' | 'more' | 'settings' | null;

const spring = { type: 'spring' as const, damping: 28, stiffness: 340 };

/* toolbar customization prefs */

type ToolbarPrefs = {
  brightness: boolean;
  fullscreen: boolean;
  readMode: boolean;
  chapters: boolean;
  zoom: boolean;
};

const PREFS_STORAGE_KEY = 'reader-toolbar-prefs:v1';

const DEFAULT_PREFS: ToolbarPrefs = {
  brightness: true,
  fullscreen: true,
  readMode: true,
  chapters: true,
  zoom: true,
};

function readStoredPrefs(): ToolbarPrefs {
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<ToolbarPrefs>;
    return {
      brightness: parsed.brightness ?? DEFAULT_PREFS.brightness,
      fullscreen: parsed.fullscreen ?? DEFAULT_PREFS.fullscreen,
      readMode: parsed.readMode ?? DEFAULT_PREFS.readMode,
      chapters: parsed.chapters ?? DEFAULT_PREFS.chapters,
      zoom: parsed.zoom ?? DEFAULT_PREFS.zoom,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

function useToolbarPrefs() {
  const [prefs, setPrefs] = useState<ToolbarPrefs>(DEFAULT_PREFS);
  const [hydrated, setHydrated] = useState(false);

  // Read after mount so SSR markup and first client render match.
  useEffect(() => {
    const timer = setTimeout(() => {
      setPrefs(readStoredPrefs());
      setHydrated(true);
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      /* storage can be unavailable (private mode / quota) */
    }
  }, [prefs, hydrated]);

  // Keep multiple open tabs in sync.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === PREFS_STORAGE_KEY) setPrefs(readStoredPrefs());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const toggle = useCallback(
    (key: keyof ToolbarPrefs) => setPrefs((p) => ({ ...p, [key]: !p[key] })),
    [],
  );
  const reset = useCallback(() => setPrefs(DEFAULT_PREFS), []);

  return { prefs, toggle, reset };
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
  zoom,
}: ReaderToolbarProps) {
  const t = useTranslations('Books');
  const g = useTranslations('General');
  const { isRTL } = useLocaleInfo();

  const [panel, setPanel] = useState<PanelKey>(null);
  const [showChapters, setShowChapters] = useState(false);
  const [visible, setVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [purchaseTarget, setPurchaseTarget] = useState<ReaderChapterItem | null>(null);
  const [pageDraft, setPageDraft] = useState(String(currentPage));

  const { prefs, toggle: togglePref, reset: resetPrefs } = useToolbarPrefs();

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const jumpInputRef = useRef<HTMLInputElement | null>(null);

  const panelOpen = panel !== null || showChapters || purchaseTarget !== null;
  const togglePanel = (key: Exclude<PanelKey, null>) => setPanel((p) => (p === key ? null : key));

  /* auto-hide */
  useEffect(() => {
    const handleMove = () => {
      setVisible(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setVisible(false), 3500);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('touchstart', handleMove);
    handleMove();
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('touchstart', handleMove);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Never hide the bar while a panel/drawer is open.
  useEffect(() => {
    if (panelOpen) {
      setVisible(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }
  }, [panelOpen]);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    onFsChange();
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  useEffect(() => {
    setPageDraft(String(currentPage));
  }, [currentPage]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPanel(null);
        setShowChapters(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // A hidden control must not stay open / active.
  useEffect(() => {
    if (!prefs.brightness && panel === 'brightness') setPanel(null);
    if (!prefs.chapters && showChapters) setShowChapters(false);
  }, [prefs.brightness, prefs.chapters, panel, showChapters]);

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

  const clampPage = useCallback(
    (n: number) => Math.min(totalPages, Math.max(1, Math.round(n))),
    [totalPages],
  );

  const commitJump = () => {
    const parsed = Number(pageDraft.replace(/\D/g, ''));
    if (!parsed || Number.isNaN(parsed)) {
      setPageDraft(String(currentPage));
      return;
    }
    const target = clampPage(parsed);
    setPageDraft(String(target));
    onPageChange(target);
    setPanel(null);
  };

  const openPurchase = (chapter: ReaderChapterItem) => {
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
    mode: 'purchase',
  });

  const jumpPanel = (
    <div className="w-[min(17rem,calc(100vw-2.5rem))] sm:w-[20rem]">
      <div className="mb-2 flex items-center justify-between gap-2 sm:mb-3">
        <span className="text-xs font-semibold text-foreground">{t('GoToPage')}</span>
        <span className="text-[11px] tabular-nums text-muted-foreground" dir="ltr">
          1 – {totalPages}
        </span>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          aria-label={t('PreviousPage')}
          onClick={() => setPageDraft(String(clampPage(Number(pageDraft || currentPage) - 1)))}
          className="inline-flex h-10 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-background/70 text-foreground/70 transition hover:bg-secondary sm:hidden"
        >
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
        </button>

        <div className="relative min-w-0 flex-1">
          <Hash className="pointer-events-none absolute inset-y-0 inset-s-3 my-auto hidden h-4 w-4 text-muted-foreground sm:block" />
          <input
            ref={jumpInputRef}
            type="number"
            inputMode="numeric"
            pattern="[0-9]*"
            enterKeyHint="go"
            value={pageDraft}
            onChange={(e) => setPageDraft(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitJump();
              if (e.key === 'ArrowUp') setPageDraft(String(clampPage(Number(pageDraft || 0) + 1)));
              if (e.key === 'ArrowDown')
                setPageDraft(String(clampPage(Number(pageDraft || 0) - 1)));
            }}
            aria-label={t('GoToPage')}
            className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none h-10 w-full rounded-xl border border-border bg-background/70 px-2 text-center text-sm font-semibold tabular-nums text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30 sm:h-11 sm:ps-9 sm:pe-3"
          />
        </div>

        <button
          type="button"
          aria-label={t('NextPage')}
          onClick={() => setPageDraft(String(clampPage(Number(pageDraft || currentPage) + 1)))}
          className="inline-flex h-10 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-background/70 text-foreground/70 transition hover:bg-secondary sm:hidden"
        >
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
        </button>

        <motion.button
          whileTap={{ scale: 0.94 }}
          onClick={commitJump}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 sm:h-11 sm:px-4 sm:text-sm"
        >
          <CornerDownLeft className="h-4 w-4 rtl:-scale-x-100" />
          {t('Go')}
        </motion.button>
      </div>
    </div>
  );

  const settingsItems: {
    key: keyof ToolbarPrefs;
    label: string;
    icon: React.ReactNode;
    hidden?: boolean;
  }[] = [
    { key: 'chapters', label: t('Chapters'), icon: <BookOpen className="h-4 w-4" /> },
    { key: 'brightness', label: t('Brightness'), icon: <Sun className="h-4 w-4" /> },
    {
      key: 'readMode',
      label: readMode === 'scroll' ? t('PageMode') : t('ScrollMode'),
      icon: <Layers className="h-4 w-4" />,
      hidden: !showReadModeToggle,
    },
    { key: 'zoom', label: t('ZoomIn'), icon: <ZoomIn className="h-4 w-4" />, hidden: !zoom },
    { key: 'fullscreen', label: t('Fullscreen'), icon: <Maximize className="h-4 w-4" /> },
  ];

  const settingsPanel = (
    <div className="w-[min(18rem,calc(100vw-2.5rem))]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Settings2 className="h-4 w-4 text-primary" />
          {t('CustomizeToolbar')}
        </span>
        <button
          type="button"
          onClick={resetPrefs}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5 rtl:-scale-x-100" />
          {t('Reset')}
        </button>
      </div>

      <div className="flex flex-col gap-1">
        {settingsItems
          .filter((item) => !item.hidden)
          .map((item, i) => (
            <motion.div
              key={item.key}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.03 * i, ...spring }}
            >
              <SettingRow
                icon={item.icon}
                label={item.label}
                checked={prefs[item.key]}
                onChange={() => togglePref(item.key)}
              />
            </motion.div>
          ))}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        {t('NavigationAlwaysVisible')}
      </p>
    </div>
  );

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
            transition={spring}
            className="fixed inset-x-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-50 flex justify-center px-3"
            onContextMenu={(e) => e.preventDefault()}
          >
            <div className="relative w-full max-w-xl md:w-auto md:max-w-3xl lg:max-w-4xl">
              {/* Floating settings button */}
              <div className="absolute -top-2 inset-e-1 z-10 hidden sm:block" data-popover-root>
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.82 }}
                  animate={{ rotate: panel === 'settings' ? 90 : 0 }}
                  transition={spring}
                  onClick={() => togglePanel('settings')}
                  title={t('CustomizeToolbar')}
                  aria-label={t('CustomizeToolbar')}
                  aria-expanded={panel === 'settings'}
                  className={`toolbar-glass inline-flex h-6 w-6 items-center justify-center rounded-full shadow-lg ring-1 ring-border/60 transition-colors ${
                    panel === 'settings'
                      ? 'bg-primary/20 text-primary'
                      : 'text-foreground/70 hover:text-foreground'
                  }`}
                >
                  <Settings2 className="h-3.5 w-3.5" />
                </motion.button>

                <Popover open={panel === 'settings'} onClose={() => setPanel(null)}>
                  {settingsPanel}
                </Popover>
              </div>

              <div className="toolbar-glass pointer-events-auto rounded-[1.75rem] p-1.5 shadow-2xl ring-1 ring-border/60 sm:p-2">
                <div className="flex items-center justify-between gap-1 sm:gap-2">
                  {/* Start group */}
                  <div className="flex min-w-0 items-center justify-start gap-1 sm:gap-1.5">
                    {/* Chapters */}
                    <AnimatePresence initial={false}>
                      {prefs.chapters && (
                        <ControlSlot key="chapters">
                          <ToolbarButton
                            icon={<BookOpen className="h-5 w-5" />}
                            label={t('Chapters')}
                            onClick={() => {
                              setShowChapters((s) => !s);
                              setPanel(null);
                            }}
                            active={showChapters}
                          />
                        </ControlSlot>
                      )}
                    </AnimatePresence>

                    {/* Brightness */}
                    <AnimatePresence initial={false}>
                      {prefs.brightness && (
                        <ControlSlot key="brightness" className="hidden md:block">
                          <div className="relative flex" data-popover-root>
                            <ToolbarButton
                              icon={<Sun className="h-5 w-5" />}
                              label={t('Brightness')}
                              onClick={() => togglePanel('brightness')}
                              active={panel === 'brightness'}
                            />
                            <Popover open={panel === 'brightness'} onClose={() => setPanel(null)}>
                              <div className="w-52">
                                <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                                  <span>{t('Brightness')}</span>
                                  <span className="font-semibold tabular-nums text-foreground">
                                    {brightness}%
                                  </span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <Sun className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                  <input
                                    type="range"
                                    min={20}
                                    max={100}
                                    value={brightness}
                                    onChange={(e) => onBrightnessChange(Number(e.target.value))}
                                    aria-label={t('Brightness')}
                                    dir={isRTL ? 'rtl' : 'ltr'}
                                    className="h-1.5 w-full cursor-pointer accent-primary"
                                  />
                                </div>
                              </div>
                            </Popover>
                          </div>
                        </ControlSlot>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* navigation */}
                  <div className="flex items-center justify-center gap-1 sm:gap-1.5">
                    <ToolbarButton
                      icon={<ChevronLeft className="h-5 w-5 rtl:rotate-180" />}
                      label={t('PreviousPage')}
                      onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                      disabled={currentPage <= 1 && !prevChapter}
                    />

                    {/* Page counter */}
                    <div className="relative" data-popover-root>
                      <motion.button
                        whileTap={{ scale: 0.96 }}
                        onClick={() => togglePanel('jump')}
                        aria-label={t('GoToPage')}
                        aria-expanded={panel === 'jump'}
                        className={`inline-flex h-10 min-w-20 shrink-0 items-center justify-center rounded-xl px-3 text-xs font-semibold tabular-nums transition ${
                          panel === 'jump'
                            ? 'bg-primary/20 text-primary'
                            : 'text-foreground/85 hover:bg-secondary'
                        }`}
                      >
                        <span dir="ltr">
                          {currentPage} / {totalPages}
                        </span>
                      </motion.button>

                      <Popover
                        open={panel === 'jump'}
                        onOpened={() => jumpInputRef.current?.select()}
                        onClose={() => setPanel(null)}
                      >
                        {jumpPanel}
                      </Popover>
                    </div>

                    <ToolbarButton
                      icon={<ChevronRight className="h-5 w-5 rtl:rotate-180" />}
                      label={t('NextPage')}
                      onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage >= totalPages && !nextChapter}
                    />
                  </div>

                  {/* End group: secondary controls inline on desktop, sheet on mobile */}
                  <div className="flex min-w-0 items-center justify-end gap-1 sm:gap-1.5">
                    <div className="hidden items-center gap-1.5 md:flex">
                      <Divider />

                      <AnimatePresence initial={false}>
                        {showReadModeToggle && prefs.readMode && (
                          <ControlSlot key="readmode">
                            <ToolbarButton
                              icon={
                                readMode === 'scroll' ? (
                                  <Layers className="h-5 w-5" />
                                ) : (
                                  <ScrollText className="h-5 w-5" />
                                )
                              }
                              label={readMode === 'scroll' ? t('PageMode') : t('ScrollMode')}
                              onClick={() =>
                                onReadModeChange(readMode === 'scroll' ? 'page' : 'scroll')
                              }
                            />
                          </ControlSlot>
                        )}
                      </AnimatePresence>

                      <AnimatePresence initial={false}>
                        {zoom && prefs.zoom && (
                          <ControlSlot key="zoom">
                            <div className="flex items-center gap-1">
                              <ToolbarButton
                                icon={<ZoomOut className="h-5 w-5" />}
                                label={t('ZoomOut')}
                                onClick={zoom.zoomOut}
                                disabled={!zoom.canZoomOut}
                              />
                              <motion.button
                                type="button"
                                whileTap={{ scale: 0.92 }}
                                onClick={zoom.resetZoom}
                                title={t('ResetZoom')}
                                aria-label={t('ResetZoom')}
                                disabled={Math.round(zoom.scale * 100) === 100}
                                className="inline-flex h-9 min-w-14 cursor-pointer items-center justify-center rounded-lg border border-border/70 bg-secondary/60 px-2 text-xs font-semibold tabular-nums text-foreground/80 transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-default disabled:border-transparent disabled:bg-transparent disabled:text-foreground/60 disabled:hover:text-foreground/60"
                              >
                                <span dir="ltr">{Math.round(zoom.scale * 100)}%</span>
                              </motion.button>
                              <ToolbarButton
                                icon={<ZoomIn className="h-5 w-5" />}
                                label={t('ZoomIn')}
                                onClick={zoom.zoomIn}
                                disabled={!zoom.canZoomIn}
                              />
                            </div>
                          </ControlSlot>
                        )}
                      </AnimatePresence>

                      <AnimatePresence initial={false}>
                        {prefs.fullscreen && (
                          <ControlSlot key="fullscreen">
                            <ToolbarButton
                              icon={
                                isFullscreen ? (
                                  <Minimize className="h-5 w-5" />
                                ) : (
                                  <Maximize className="h-5 w-5" />
                                )
                              }
                              label={isFullscreen ? t('ExitFullscreen') : t('Fullscreen')}
                              onClick={toggleFullscreen}
                            />
                          </ControlSlot>
                        )}
                      </AnimatePresence>
                    </div>

                    <div className="md:hidden">
                      <ToolbarButton
                        icon={<MoreHorizontal className="h-5 w-5" />}
                        label={t('More')}
                        onClick={() => togglePanel('more')}
                        active={panel === 'more'}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile overflow sheet */}
      <AnimatePresence>
        {panel === 'more' && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-70 bg-black/50 backdrop-blur-sm md:hidden"
              onClick={() => setPanel(null)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={spring}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.4 }}
              onDragEnd={(_, info) => info.offset.y > 90 && setPanel(null)}
              role="dialog"
              aria-label={t('More')}
              className="toolbar-glass fixed inset-x-0 bottom-0 z-80 rounded-t-3xl border-t border-border p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl md:hidden"
            >
              <span className="mx-auto mb-4 block h-1.5 w-10 rounded-full bg-border" />

              {/* Brightness */}
              {prefs.brightness && (
                <div className="mb-3 rounded-2xl bg-secondary/70 px-3 py-3">
                  <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5 font-medium text-foreground/80">
                      <Sun className="h-4 w-4" />
                      {t('Brightness')}
                    </span>
                    <span className="font-semibold tabular-nums text-foreground" dir="ltr">
                      {brightness}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={20}
                    max={100}
                    value={brightness}
                    onChange={(e) => onBrightnessChange(Number(e.target.value))}
                    aria-label={t('Brightness')}
                    dir={isRTL ? 'rtl' : 'ltr'}
                    className="h-1.5 w-full cursor-pointer accent-primary"
                  />
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                {showReadModeToggle && prefs.readMode && (
                  <SheetAction
                    icon={
                      readMode === 'scroll' ? (
                        <Layers className="h-5 w-5" />
                      ) : (
                        <ScrollText className="h-5 w-5" />
                      )
                    }
                    label={readMode === 'scroll' ? t('PageMode') : t('ScrollMode')}
                    onClick={() => onReadModeChange(readMode === 'scroll' ? 'page' : 'scroll')}
                  />
                )}
                {prefs.fullscreen && (
                  <SheetAction
                    icon={
                      isFullscreen ? (
                        <Minimize className="h-5 w-5" />
                      ) : (
                        <Maximize className="h-5 w-5" />
                      )
                    }
                    label={isFullscreen ? t('ExitFullscreen') : t('Fullscreen')}
                    onClick={toggleFullscreen}
                  />
                )}
                {zoom && prefs.zoom && (
                  <>
                    <SheetAction
                      icon={<ZoomOut className="h-5 w-5" />}
                      label={t('ZoomOut')}
                      onClick={zoom.zoomOut}
                      disabled={!zoom.canZoomOut}
                    />
                    <SheetAction
                      icon={<ZoomIn className="h-5 w-5" />}
                      label={t('ZoomIn')}
                      onClick={zoom.zoomIn}
                      disabled={!zoom.canZoomIn}
                    />
                    <SheetAction
                      icon={
                        <span dir="ltr" className="text-sm font-bold tabular-nums">
                          {Math.round(zoom.scale * 100)}%
                        </span>
                      }
                      label={t('ResetZoom')}
                      onClick={zoom.resetZoom}
                      disabled={Math.round(zoom.scale * 100) === 100}
                    />
                  </>
                )}
              </div>
            </motion.div>
          </>
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
              initial={{ x: isRTL ? '-100%' : '100%' }}
              animate={{ x: 0 }}
              exit={{ x: isRTL ? '-100%' : '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 320 }}
              className="toolbar-glass fixed inset-y-0 inset-e-0 z-80 flex w-[88vw] max-w-sm flex-col border-s border-border shadow-2xl"
              role="dialog"
              aria-label={t('Chapters')}
            >
              <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-4 py-4 pt-[max(1rem,env(safe-area-inset-top))]">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold text-foreground">
                    {t('Chapters')}
                  </h3>
                  {book?.title && (
                    <p className="truncate text-xs text-muted-foreground">{book.title}</p>
                  )}
                </div>
                <button
                  onClick={() => setShowChapters(false)}
                  aria-label={g('Cancel')}
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
                      aria-current={isCurrent ? 'true' : undefined}
                      className={`group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-start transition-colors ${
                        isCurrent
                          ? 'bg-primary/15 text-primary'
                          : 'text-foreground/80 hover:bg-secondary hover:text-foreground'
                      }`}
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold tabular-nums ${
                          isCurrent
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-secondary text-muted-foreground group-hover:text-foreground'
                        }`}
                      >
                        {ch.index}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{ch.title}</span>
                        <span className="block text-xs text-muted-foreground">{ch.pageCount}p</span>
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

/* primitives */

/** Animated wrapper so toggled controls collapse/expand smoothly. */
function ControlSlot({ children, className = '' }: { children: ReactNode; className?: string }) {
  const [animating, setAnimating] = useState(true);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, width: 0, scale: 0.8 }}
      animate={{ opacity: 1, width: 'auto', scale: 1 }}
      exit={{ opacity: 0, width: 0, scale: 0.8 }}
      transition={spring}
      onAnimationStart={() => setAnimating(true)}
      onAnimationComplete={() => setAnimating(false)}
      onLayoutAnimationStart={() => setAnimating(true)}
      onLayoutAnimationComplete={() => setAnimating(false)}
      className={`${animating ? 'overflow-hidden' : 'overflow-visible'} ${className}`}
    >
      {children}
    </motion.div>
  );
}

function SettingRow({
  icon,
  label,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className="group flex w-full items-center gap-3 rounded-xl px-2 py-2 text-start transition-colors hover:bg-secondary"
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
          checked ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground'
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground/85">
        {label}
      </span>
      <span
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
          checked ? 'bg-primary' : 'bg-border'
        }`}
      >
        <motion.span
          layout
          transition={spring}
          className="absolute h-4 w-4 rounded-full bg-background shadow-sm"
          style={{ insetInlineStart: checked ? 'calc(100% - 1.125rem)' : '0.125rem' }}
        />
      </span>
    </button>
  );
}

function Popover({
  open,
  children,
  onOpened,
  onClose,
}: {
  open: boolean;
  children: ReactNode;
  onOpened?: () => void;
  onClose?: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shift, setShift] = useState(0);

  useEffect(() => {
    if (open) {
      onOpened?.();
    } else {
      const timer = setTimeout(() => setShift(0), 0);
      return () => clearTimeout(timer);
    }
  }, [open, onOpened]);

  /* Keep the panel inside the viewport */
  useIsomorphicLayoutEffect(() => {
    if (!open) return;
    const reposition = () => {
      const el = ref.current;
      if (!el) return;
      const margin = 12;
      const rect = el.getBoundingClientRect();
      const vw = document.documentElement.clientWidth;
      let delta = 0;
      if (rect.left < margin) delta = margin - rect.left;
      else if (rect.right > vw - margin) delta = vw - margin - rect.right;
      if (Math.abs(delta) > 0.5) setShift((prev) => prev + delta);
    };
    const raf = requestAnimationFrame(reposition);
    window.addEventListener('resize', reposition);
    window.addEventListener('orientationchange', reposition);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('orientationchange', reposition);
    };
  }, [open, shift]);

  /* Click / tap outside closes the popover. */
  useEffect(() => {
    if (!open || !onClose) return;
    const onPointerDown = (e: PointerEvent) => {
      const el = ref.current;
      if (!el) return;
      const root = el.closest('[data-popover-root]') ?? el;
      if (!root.contains(e.target as Node)) onClose();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          role="dialog"
          initial={{ opacity: 0, y: 10, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.96 }}
          transition={spring}
          style={{ ['--popover-shift' as string]: `${shift}px` }}
          className="toolbar-glass absolute bottom-full left-1/2 mb-3 w-max max-w-[calc(100vw-1.5rem)] translate-x-[calc(-50%+var(--popover-shift))] rounded-2xl p-4 shadow-2xl ring-1 ring-border/60"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ToolbarButton({
  icon,
  label,
  onClick,
  disabled,
  active,
  className = '',
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  className?: string;
}) {
  return (
    <motion.button
      whileTap={{ scale: disabled ? 1 : 0.9 }}
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors duration-150 ${
        active
          ? 'bg-primary/20 text-primary'
          : 'text-foreground/70 hover:bg-secondary hover:text-foreground'
      } disabled:cursor-not-allowed disabled:opacity-30 ${className}`}
    >
      {icon}
    </motion.button>
  );
}

function SheetAction({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center justify-center gap-1.5 rounded-2xl bg-secondary/70 px-2 py-4 text-foreground/80 transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-40"
    >
      {icon}
      <span className="line-clamp-1 text-[11px] font-medium">{label}</span>
    </motion.button>
  );
}

function Divider() {
  return <div className="mx-0.5 h-5 w-px shrink-0 bg-border/60" />;
}
