'use client';

import { Sun } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useLocaleInfo } from '@/hooks/use-locale-info';
import { Popover, ToolbarButton } from './primitives';

export function BrightnessSlider({
  brightness,
  onBrightnessChange,
}: {
  brightness: number;
  onBrightnessChange: (val: number) => void;
}) {
  const t = useTranslations('Books');
  const { isRTL } = useLocaleInfo();

  return (
    <div className="w-52 max-w-full">
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
  );
}

/** Toolbar button + popover wrapper (desktop / tablet). */
export function BrightnessControl({
  open,
  onToggle,
  onClose,
  brightness,
  onBrightnessChange,
}: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  brightness: number;
  onBrightnessChange: (val: number) => void;
}) {
  const t = useTranslations('Books');

  return (
    <div className="relative flex" data-popover-root>
      <ToolbarButton
        icon={<Sun className="h-5 w-5" />}
        label={t('Brightness')}
        onClick={onToggle}
        active={open}
      />
      <Popover open={open} onClose={onClose}>
        <BrightnessSlider brightness={brightness} onBrightnessChange={onBrightnessChange} />
      </Popover>
    </div>
  );
}
