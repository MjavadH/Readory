'use client';

import { AnimatePresence } from 'framer-motion';
import { Layers, Maximize, Minimize, ScrollText } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReaderZoomApi } from '@/components/reader/reader-zoom';
import { BrightnessControl } from './brightness-control';
import { ControlSlot, Divider, ToolbarButton } from './primitives';
import type { PanelKey, ReaderTypographySettings, ToolbarPrefs } from './types';
import { TypographyControl } from './typography-panel';
import { ZoomControls } from './zoom-controls';

export function ModeStartControls({
  contentMode,
  prefs,
  panel,
  onTogglePanel,
  onClosePanel,
  brightness,
  onBrightnessChange,
  readMode,
  onReadModeChange,
  showReadModeToggle,
  typography,
  onTypographyChange,
}: {
  contentMode: 'image' | 'text';
  prefs: ToolbarPrefs;
  panel: PanelKey;
  onTogglePanel: (key: Exclude<PanelKey, null>) => void;
  onClosePanel: () => void;
  brightness: number;
  onBrightnessChange: (val: number) => void;
  readMode: 'scroll' | 'page';
  onReadModeChange: (mode: 'scroll' | 'page') => void;
  showReadModeToggle: boolean;
  typography?: ReaderTypographySettings;
  onTypographyChange?: (next: ReaderTypographySettings) => void;
}) {
  const t = useTranslations('Books');

  if (contentMode === 'text') {
    return (
      <AnimatePresence initial={false}>
        {prefs.typography && typography && onTypographyChange && (
          <ControlSlot key="typography" className="hidden md:block">
            <TypographyControl
              open={panel === 'typography'}
              onToggle={() => onTogglePanel('typography')}
              onClose={onClosePanel}
              value={typography}
              onChange={onTypographyChange}
            />
          </ControlSlot>
        )}
      </AnimatePresence>
    );
  }

  return (
    <>
      <AnimatePresence initial={false}>
        {showReadModeToggle && prefs.readMode && (
          <ControlSlot key="readmode" className="hidden md:block">
            <ToolbarButton
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
          </ControlSlot>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {prefs.brightness && (
          <ControlSlot key="brightness" className="hidden md:block">
            <BrightnessControl
              open={panel === 'brightness'}
              onToggle={() => onTogglePanel('brightness')}
              onClose={onClosePanel}
              brightness={brightness}
              onBrightnessChange={onBrightnessChange}
            />
          </ControlSlot>
        )}
      </AnimatePresence>
    </>
  );
}

/**
 * Controls placed AFTER the navigation group.
 * image: zoom + fullscreen — text: fullscreen.
 */
export function ModeEndControls({
  contentMode,
  prefs,
  zoom,
  isFullscreen,
  onToggleFullscreen,
}: {
  contentMode: 'image' | 'text';
  prefs: ToolbarPrefs;
  zoom?: ReaderZoomApi;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  const t = useTranslations('Books');
  const showZoom = contentMode === 'image' && Boolean(zoom) && prefs.zoom;

  return (
    <div className="hidden items-center gap-1.5 md:flex">
      <Divider />

      <AnimatePresence initial={false}>
        {showZoom && zoom && (
          <ControlSlot key="zoom">
            <ZoomControls zoom={zoom} />
          </ControlSlot>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {prefs.fullscreen && (
          <ControlSlot key="fullscreen">
            <ToolbarButton
              icon={
                isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />
              }
              label={isFullscreen ? t('ExitFullscreen') : t('Fullscreen')}
              onClick={onToggleFullscreen}
            />
          </ControlSlot>
        )}
      </AnimatePresence>
    </div>
  );
}
