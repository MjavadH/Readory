'use client';

import { motion } from 'framer-motion';
import { BookOpen, Layers, Maximize, RotateCcw, Settings2, Sun, Type, ZoomIn } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Popover, SettingRow, ToolbarButton } from './primitives';
import { spring, type ReaderContentMode, type ToolbarPrefs } from './types';

/** Which controls the reader may show/hide, per content mode. */
export function ToolbarSettingsPanel({
  contentMode,
  prefs,
  onToggle,
  onReset,
  readMode,
  showReadModeToggle,
  hasZoom,
}: {
  contentMode: ReaderContentMode;
  prefs: ToolbarPrefs;
  onToggle: (key: keyof ToolbarPrefs) => void;
  onReset: () => void;
  readMode: 'scroll' | 'page';
  showReadModeToggle: boolean;
  hasZoom: boolean;
}) {
  const t = useTranslations('Books');
  const isText = contentMode === 'text';

  const items: { key: keyof ToolbarPrefs; label: string; icon: React.ReactNode; hidden?: boolean }[] =
    [
      { key: 'chapters', label: t('Chapters'), icon: <BookOpen className="h-4 w-4" /> },
      { key: 'typography', label: t('Typography'), icon: <Type className="h-4 w-4" />, hidden: !isText },
      { key: 'brightness', label: t('Brightness'), icon: <Sun className="h-4 w-4" />, hidden: isText },
      {
        key: 'readMode',
        label: readMode === 'scroll' ? t('PageMode') : t('ScrollMode'),
        icon: <Layers className="h-4 w-4" />,
        hidden: isText || !showReadModeToggle,
      },
      { key: 'zoom', label: t('ZoomIn'), icon: <ZoomIn className="h-4 w-4" />, hidden: isText || !hasZoom },
      { key: 'fullscreen', label: t('Fullscreen'), icon: <Maximize className="h-4 w-4" /> },
    ];

  return (
    <div className="w-[min(18rem,calc(100vw-2.5rem))]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Settings2 className="h-4 w-4 text-primary" />
          {t('CustomizeToolbar')}
        </span>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5 rtl:-scale-x-100" />
          {t('Reset')}
        </button>
      </div>

      <div className="flex flex-col gap-1">
        {items
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
                onChange={() => onToggle(item.key)}
              />
            </motion.div>
          ))}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        {t('NavigationAlwaysVisible')}
      </p>
    </div>
  );
}

/** Floating gear button that opens the settings popover. */
export function ToolbarSettingsButton({
  open,
  onToggle,
  onClose,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const t = useTranslations('Books');

  return (
    <div className="absolute -top-2 inset-e-1 z-10 hidden sm:block" data-popover-root>
      <motion.button
        type="button"
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.82 }}
        animate={{ rotate: open ? 90 : 0 }}
        transition={spring}
        onClick={onToggle}
        title={t('CustomizeToolbar')}
        aria-label={t('CustomizeToolbar')}
        aria-expanded={open}
        className={`toolbar-glass inline-flex h-6 w-6 items-center justify-center rounded-full shadow-lg ring-1 ring-border/60 transition-colors ${
          open ? 'bg-primary/20 text-primary' : 'text-foreground/70 hover:text-foreground'
        }`}
      >
        <Settings2 className="h-3.5 w-3.5" />
      </motion.button>

      <Popover open={open} onClose={onClose}>
        {children}
      </Popover>
    </div>
  );
}

// Keep ToolbarButton re-exported for convenience in mode layouts.
export { ToolbarButton };
