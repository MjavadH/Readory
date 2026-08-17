'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Check, Lock, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useLocaleInfo } from '@/hooks/use-locale-info';
import type { ReaderChapterItem } from './types';

export function ChaptersDrawer({
  open,
  onClose,
  chapters,
  currentChapter,
  bookTitle,
  onSelect,
  onLockedSelect,
}: {
  open: boolean;
  onClose: () => void;
  chapters: ReaderChapterItem[];
  currentChapter: ReaderChapterItem;
  bookTitle?: string;
  onSelect: (chapter: ReaderChapterItem) => void;
  onLockedSelect: (chapter: ReaderChapterItem) => void;
}) {
  const t = useTranslations('Books');
  const g = useTranslations('General');
  const { isRTL } = useLocaleInfo();

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-70 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
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
                {bookTitle && <p className="truncate text-xs text-muted-foreground">{bookTitle}</p>}
              </div>
              <button
                type="button"
                onClick={onClose}
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
                    type="button"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.02, 0.3) }}
                    onClick={() => (ch.locked ? onLockedSelect(ch) : onSelect(ch))}
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
  );
}
