'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Layers, Maximize, Minimize, ScrollText, ZoomIn, ZoomOut } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReaderZoomApi } from '@/components/reader/reader-zoom';
import { BrightnessSlider } from './brightness-control';
import { SheetAction } from './primitives';
import {
  type ReaderContentMode,
  type ReaderTypographySettings,
  spring,
  type ToolbarPrefs,
} from './types';
import { TypographyPanel } from './typography-panel';

/**
 * Mobile overflow sheet. Holds every secondary control for the active content
 * mode, so the mobile bar can stay at: chapters – navigation – more.
 */
export function MobileMoreSheet({
  open,
  onClose,
  contentMode,
  prefs,
  brightness,
  onBrightnessChange,
  readMode,
  onReadModeChange,
  showReadModeToggle,
  zoom,
  isFullscreen,
  onToggleFullscreen,
  typography,
  onTypographyChange,
}: {
  open: boolean;
  onClose: () => void;
  contentMode: ReaderContentMode;
  prefs: ToolbarPrefs;
  brightness: number;
  onBrightnessChange: (val: number) => void;
  readMode: 'scroll' | 'page';
  onReadModeChange: (mode: 'scroll' | 'page') => void;
  showReadModeToggle: boolean;
  zoom?: ReaderZoomApi;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  typography?: ReaderTypographySettings;
  onTypographyChange?: (next: ReaderTypographySettings) => void;
}) {
  const t = useTranslations('Books');
  const isText = contentMode === 'text';

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-70 bg-black/50 backdrop-blur-sm md:hidden"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={spring}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => info.offset.y > 90 && onClose()}
            role="dialog"
            aria-label={t('More')}
            className="toolbar-glass fixed inset-x-0 bottom-0 z-80 max-h-[85dvh] overflow-y-auto overscroll-contain rounded-t-3xl border-t border-border p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl md:hidden"
          >
            <span className="mx-auto mb-4 block h-1.5 w-10 rounded-full bg-border" />

            {/* Text mode: typography. Image mode: brightness. */}
            {isText && prefs.typography && typography && onTypographyChange && (
              <div className="mb-3 rounded-2xl bg-secondary/40 p-3">
                <TypographyPanel
                  value={typography}
                  onChange={onTypographyChange}
                  className="w-full!"
                />
              </div>
            )}

            {!isText && prefs.brightness && (
              <div className="mb-3 rounded-2xl bg-secondary/70 px-3 py-3">
                <BrightnessSlider brightness={brightness} onBrightnessChange={onBrightnessChange} />
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              {!isText && showReadModeToggle && prefs.readMode && (
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
                  onClick={onToggleFullscreen}
                />
              )}

              {!isText && zoom && prefs.zoom && (
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
  );
}
