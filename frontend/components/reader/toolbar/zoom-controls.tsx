'use client';

import { ZoomIn, ZoomOut } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import type { ReaderZoomApi } from '@/components/reader/reader-zoom';
import { ToolbarButton } from './primitives';

export function ZoomControls({ zoom }: { zoom: ReaderZoomApi }) {
  const t = useTranslations('Books');
  const percent = Math.round(zoom.scale * 100);

  return (
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
        disabled={percent === 100}
        className="inline-flex h-9 min-w-14 cursor-pointer items-center justify-center rounded-lg border border-border/70 bg-secondary/60 px-2 text-xs font-semibold tabular-nums text-foreground/80 transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-default disabled:border-transparent disabled:bg-transparent disabled:text-foreground/60"
      >
        <span dir="ltr">{percent}%</span>
      </motion.button>
      <ToolbarButton
        icon={<ZoomIn className="h-5 w-5" />}
        label={t('ZoomIn')}
        onClick={zoom.zoomIn}
        disabled={!zoom.canZoomIn}
      />
    </div>
  );
}
