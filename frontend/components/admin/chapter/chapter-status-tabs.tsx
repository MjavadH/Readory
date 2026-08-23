'use client';

import { PublicationStatus } from '@readory/shared';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarClock, Eye, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

type Option = {
  value: PublicationStatus;
  labelKey: string;
  Icon: typeof Eye;
};

const OPTIONS: Option[] = [
  { value: PublicationStatus.PUBLISHED, labelKey: 'StatusPublished', Icon: Eye },
  { value: PublicationStatus.DRAFT, labelKey: 'StatusDraft', Icon: FileText },
  { value: PublicationStatus.SCHEDULED, labelKey: 'StatusScheduled', Icon: CalendarClock },
];

export type ChapterStatusTabsProps = {
  value: PublicationStatus;
  onChange: (value: PublicationStatus) => void;
  /** next-intl translator, e.g. useTranslations('Books') */
  t: (key: string) => string;
  disabled?: boolean;
  className?: string;
};

export function ChapterStatusTabs({
  value,
  onChange,
  t,
  disabled,
  className,
}: ChapterStatusTabsProps) {
  return (
    <div
      role="tablist"
      aria-label={t('PublishStatus')}
      className={cn(
        'relative grid w-full grid-cols-3 gap-1 rounded-xl border border-border/60 bg-muted/50 p-1',
        disabled && 'pointer-events-none opacity-60',
        className,
      )}
    >
      {OPTIONS.map(({ value: option, labelKey, Icon }) => {
        const active = value === option;

        return (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option)}
            className={cn(
              'relative z-10 flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium outline-none transition-colors sm:gap-2 sm:px-3 sm:text-sm',
              'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              active ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {active && (
              <motion.span
                layoutId="chapter-status-pill"
                transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.7 }}
                className="absolute inset-0 -z-10 rounded-lg bg-primary shadow-sm"
              />
            )}
            <motion.span
              animate={{ scale: active ? 1 : 0.94 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className="flex items-center gap-1.5 sm:gap-2"
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{t(labelKey)}</span>
            </motion.span>
          </button>
        );
      })}
    </div>
  );
}

/** Smooth height+fade reveal used for the schedule date picker. */
export function MorphReveal({ show, children }: { show: boolean; children: React.ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          key="reveal"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden"
        >
          <div className="pt-3">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
