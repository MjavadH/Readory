'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, MoreHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  ChapterPurchaseDialog,
  type PurchaseDialogChapter,
} from '@/components/chapter-purchase-dialog';
import { ControlSlot, ToolbarButton } from './toolbar/primitives';
import { NavigationGroup } from './toolbar/navigation-group';
import { ChaptersDrawer } from './toolbar/chapters-drawer';
import { MobileMoreSheet } from './toolbar/mobile-more-sheet';
import { ModeEndControls, ModeStartControls } from './toolbar/mode-controls';
import { ToolbarSettingsButton, ToolbarSettingsPanel } from './toolbar/toolbar-settings-panel';
import { useToolbarPrefs } from './toolbar/use-toolbar-prefs';
import { useFullscreen } from './toolbar/use-fullscreen';
import {
  spring,
  type PanelKey,
  type ReaderChapterItem,
  type ReaderToolbarProps,
} from './toolbar/types';

export type { ReaderChapterItem, ReaderToolbarProps } from './toolbar/types';

export function ReaderToolbar({
  contentMode,
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
  typography,
  onTypographyChange,
}: ReaderToolbarProps) {
  const t = useTranslations('Books');

  const [panel, setPanel] = useState<PanelKey>(null);
  const [showChapters, setShowChapters] = useState(false);
  const [visible, setVisible] = useState(true);
  const [purchaseTarget, setPurchaseTarget] = useState<ReaderChapterItem | null>(null);

  const { prefs, toggle: togglePref, reset: resetPrefs } = useToolbarPrefs();
  const { isFullscreen, toggleFullscreen } = useFullscreen(fullscreenTarget);

  const isText = contentMode === 'text';
  const activeZoom = isText ? undefined : zoom;
  const canToggleReadMode = !isText && showReadModeToggle;

  const panelOpen = panel !== null || showChapters || purchaseTarget !== null;
  const togglePanel = (key: Exclude<PanelKey, null>) => setPanel((p) => (p === key ? null : key));
  const closePanel = () => setPanel(null);

  /* auto-hide */
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const handleMove = () => {
      setVisible(true);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setVisible(false), 3500);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('touchstart', handleMove);
    handleMove();
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('touchstart', handleMove);
      if (timer) clearTimeout(timer);
    };
  }, []);

  // Never hide the bar while a panel/drawer is open.
  useEffect(() => {
    if (panelOpen) setVisible(true);
  }, [panelOpen]);

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

  // A hidden or mode-irrelevant control must not stay open.
  useEffect(() => {
    if (!prefs.chapters && showChapters) setShowChapters(false);
    if (!prefs.brightness && panel === 'brightness') setPanel(null);
    if (!prefs.typography && panel === 'typography') setPanel(null);
    if (isText && panel === 'brightness') setPanel(null);
    if (!isText && panel === 'typography') setPanel(null);
  }, [prefs.brightness, prefs.chapters, prefs.typography, panel, showChapters, isText]);

  const prevChapter = chapters.find((c) => c.index === currentChapter.index - 1);
  const nextChapter = chapters.find((c) => c.index === currentChapter.index + 1);

  const openPurchase = (chapter: ReaderChapterItem) => {
    setShowChapters(false);
    if (!book) {
      onChapterChange(chapter);
      return;
    }
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

  return (
    <>
      {/* Brightness dimming overlay (image mode only) */}
      {!isText && brightness < 100 && (
        <div
          className="pointer-events-none fixed inset-0 z-100"
          style={{ backgroundColor: `rgba(0,0,0,${((100 - brightness) / 100) * 0.7})` }}
        />
      )}

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
              <ToolbarSettingsButton
                open={panel === 'settings'}
                onToggle={() => togglePanel('settings')}
                onClose={closePanel}
              >
                <ToolbarSettingsPanel
                  contentMode={contentMode}
                  prefs={prefs}
                  onToggle={togglePref}
                  onReset={resetPrefs}
                  readMode={readMode}
                  showReadModeToggle={showReadModeToggle}
                  hasZoom={Boolean(zoom)}
                />
              </ToolbarSettingsButton>

              <div className="toolbar-glass pointer-events-auto rounded-[1.75rem] p-1.5 shadow-2xl ring-1 ring-border/60 sm:p-2">
                <div className="flex items-center justify-between gap-1 sm:gap-2">
                  {/* Start: chapters + mode specific controls */}
                  <div className="flex min-w-0 items-center justify-start gap-1 sm:gap-1.5">
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

                    <ModeStartControls
                      contentMode={contentMode}
                      prefs={prefs}
                      panel={panel}
                      onTogglePanel={togglePanel}
                      onClosePanel={closePanel}
                      brightness={brightness}
                      onBrightnessChange={onBrightnessChange}
                      readMode={readMode}
                      onReadModeChange={onReadModeChange}
                      showReadModeToggle={canToggleReadMode}
                      typography={typography}
                      onTypographyChange={onTypographyChange}
                    />
                  </div>

                  <NavigationGroup
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={onPageChange}
                    hasPrevChapter={Boolean(prevChapter)}
                    hasNextChapter={Boolean(nextChapter)}
                    jumpOpen={panel === 'jump'}
                    onToggleJump={() => togglePanel('jump')}
                    onCloseJump={closePanel}
                  />

                  {/* End: mode specific controls inline on desktop, sheet on mobile */}
                  <div className="flex min-w-0 items-center justify-end gap-1 sm:gap-1.5">
                    <ModeEndControls
                      contentMode={contentMode}
                      prefs={prefs}
                      zoom={activeZoom}
                      isFullscreen={isFullscreen}
                      onToggleFullscreen={toggleFullscreen}
                    />

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

      <MobileMoreSheet
        open={panel === 'more'}
        onClose={closePanel}
        contentMode={contentMode}
        prefs={prefs}
        brightness={brightness}
        onBrightnessChange={onBrightnessChange}
        readMode={readMode}
        onReadModeChange={onReadModeChange}
        showReadModeToggle={canToggleReadMode}
        zoom={activeZoom}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        typography={typography}
        onTypographyChange={onTypographyChange}
      />

      <ChaptersDrawer
        open={showChapters}
        onClose={() => setShowChapters(false)}
        chapters={chapters}
        currentChapter={currentChapter}
        bookTitle={book?.title}
        onSelect={(ch) => {
          onChapterChange(ch);
          setShowChapters(false);
        }}
        onLockedSelect={openPurchase}
      />

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
