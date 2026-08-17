'use client';

import {
  Minus,
  Plus,
  Type,
  RotateCcw,
  AlignJustify,
  PilcrowLeft,
  PilcrowRight,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { useLocaleInfo } from '@/hooks/use-locale-info';
import { Popover, ToolbarButton } from './primitives';
import {
  FONT_FAMILIES,
  FONT_SIZE_RANGE,
  LINE_HEIGHT_RANGE,
  TEXT_DIRECTIONS,
  spring,
  type ReaderTypographySettings,
} from './types';

export const DEFAULT_TYPOGRAPHY: ReaderTypographySettings = {
  fontSize: 18,
  lineHeight: 1.6,
  fontFamily: 'var(--font-vazirmatn), sans-serif',
  textDirection: 'ltr',
};

const clamp = (val: number, min: number, max: number) => Math.min(max, Math.max(min, val));
const round1 = (val: number) => Math.round(val * 10) / 10;

/** Font family + size + line height. Shared by the desktop popover and the mobile sheet. */
export function TypographyPanel({
  value,
  onChange,
  className = '',
}: {
  value: ReaderTypographySettings;
  onChange: (next: ReaderTypographySettings) => void;
  className?: string;
}) {
  const t = useTranslations('Books');
  const { isRTL } = useLocaleInfo();

  const setFontSize = (size: number) =>
    onChange({
      ...value,
      fontSize: clamp(Math.round(size), FONT_SIZE_RANGE.min, FONT_SIZE_RANGE.max),
    });

  const setLineHeight = (lh: number) =>
    onChange({
      ...value,
      lineHeight: round1(clamp(lh, LINE_HEIGHT_RANGE.min, LINE_HEIGHT_RANGE.max)),
    });

  return (
    <div className={`w-[min(19rem,calc(100vw-2.5rem))] ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Type className="h-4 w-4 text-primary" />
          {t('Typography')}
        </span>
        <button
          type="button"
          onClick={() => onChange(DEFAULT_TYPOGRAPHY)}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5 rtl:-scale-x-100" />
          {t('Reset')}
        </button>
      </div>

      {/* Font family */}
      <div className="mb-3">
        <span className="mb-1.5 block text-[11px] font-medium text-muted-foreground">
          {t('FontFamily')}
        </span>
        <div className="grid grid-cols-4 gap-1.5">
          {FONT_FAMILIES.map((font) => {
            const active = value.fontFamily === font.value;
            return (
              <motion.button
                key={font.value}
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={() => onChange({ ...value, fontFamily: font.value })}
                aria-pressed={active}
                style={{ fontFamily: font.value }}
                className={`rounded-xl border px-2 py-2.5 text-xs font-semibold transition-colors ${
                  active
                    ? 'border-primary/50 bg-primary/15 text-primary'
                    : 'border-border bg-secondary/60 text-foreground/80 hover:bg-secondary'
                }`}
              >
                {t(font.labelKey)}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Text direction */}
      <div className="mb-3">
        <span className="mb-1.5 block text-[11px] font-medium text-muted-foreground">
          {t('TextDirection')}
        </span>
        <div className="grid grid-cols-2 gap-1.5">
          {TEXT_DIRECTIONS.map((option) => {
            const active = value.textDirection === option.value;
            return (
              <motion.button
                key={option.value}
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={() => onChange({ ...value, textDirection: option.value })}
                aria-pressed={active}
                className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 text-xs font-semibold transition-colors ${
                  active
                    ? 'border-primary/50 bg-primary/15 text-primary'
                    : 'border-border bg-secondary/60 text-foreground/80 hover:bg-secondary'
                }`}
              >
                {option.value === 'ltr' ? (
                  <PilcrowRight className="h-4 w-4" />
                ) : (
                  <PilcrowLeft className="h-4 w-4" />
                )}
                {t(option.labelKey)}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Font size */}
      <div className="mb-3 rounded-2xl bg-secondary/60 p-3">
        <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground/80">{t('FontSize')}</span>
          <span className="font-semibold tabular-nums text-foreground" dir="ltr">
            {value.fontSize}px
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ToolbarButton
            icon={<Minus className="h-4 w-4" />}
            label={t('DecreaseFontSize')}
            onClick={() => setFontSize(value.fontSize - FONT_SIZE_RANGE.step)}
            disabled={value.fontSize <= FONT_SIZE_RANGE.min}
            className="h-9 w-9 border border-border bg-background/70"
          />
          <input
            type="range"
            min={FONT_SIZE_RANGE.min}
            max={FONT_SIZE_RANGE.max}
            step={FONT_SIZE_RANGE.step}
            value={value.fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            aria-label={t('FontSize')}
            dir={isRTL ? 'rtl' : 'ltr'}
            className="h-1.5 w-full cursor-pointer accent-primary"
          />
          <ToolbarButton
            icon={<Plus className="h-4 w-4" />}
            label={t('IncreaseFontSize')}
            onClick={() => setFontSize(value.fontSize + FONT_SIZE_RANGE.step)}
            disabled={value.fontSize >= FONT_SIZE_RANGE.max}
            className="h-9 w-9 border border-border bg-background/70"
          />
        </div>
      </div>

      {/* Line height */}
      <div className="rounded-2xl bg-secondary/60 p-3">
        <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 font-medium text-foreground/80">
            <AlignJustify className="h-3.5 w-3.5" />
            {t('LineHeight')}
          </span>
          <span className="font-semibold tabular-nums text-foreground" dir="ltr">
            {value.lineHeight.toFixed(1)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ToolbarButton
            icon={<Minus className="h-4 w-4" />}
            label={t('DecreaseLineHeight')}
            onClick={() => setLineHeight(value.lineHeight - LINE_HEIGHT_RANGE.step)}
            disabled={value.lineHeight <= LINE_HEIGHT_RANGE.min}
            className="h-9 w-9 border border-border bg-background/70"
          />
          <input
            type="range"
            min={LINE_HEIGHT_RANGE.min}
            max={LINE_HEIGHT_RANGE.max}
            step={LINE_HEIGHT_RANGE.step}
            value={value.lineHeight}
            onChange={(e) => setLineHeight(Number(e.target.value))}
            aria-label={t('LineHeight')}
            dir={isRTL ? 'rtl' : 'ltr'}
            className="h-1.5 w-full cursor-pointer accent-primary"
          />
          <ToolbarButton
            icon={<Plus className="h-4 w-4" />}
            label={t('IncreaseLineHeight')}
            onClick={() => setLineHeight(value.lineHeight + LINE_HEIGHT_RANGE.step)}
            disabled={value.lineHeight >= LINE_HEIGHT_RANGE.max}
            className="h-9 w-9 border border-border bg-background/70"
          />
        </div>
      </div>
    </div>
  );
}

/** Toolbar button + popover wrapper (desktop / tablet). */
export function TypographyControl({
  open,
  onToggle,
  onClose,
  value,
  onChange,
}: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  value: ReaderTypographySettings;
  onChange: (next: ReaderTypographySettings) => void;
}) {
  const t = useTranslations('Books');

  return (
    <div className="relative flex" data-popover-root>
      <motion.div transition={spring}>
        <ToolbarButton
          icon={<Type className="h-5 w-5" />}
          label={t('Typography')}
          onClick={onToggle}
          active={open}
        />
      </motion.div>
      <Popover open={open} onClose={onClose}>
        <TypographyPanel value={value} onChange={onChange} />
      </Popover>
    </div>
  );
}
