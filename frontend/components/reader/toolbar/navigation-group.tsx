'use client';

import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, CornerDownLeft, Hash } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useRef } from 'react';
import { Popover, ToolbarButton } from './primitives';

/** Prev / page counter (with go-to-page popover) / next. Always visible in both modes. */
export function NavigationGroup({
  currentPage,
  totalPages,
  onPageChange,
  hasPrevChapter,
  hasNextChapter,
  jumpOpen,
  onToggleJump,
  onCloseJump,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  hasPrevChapter: boolean;
  hasNextChapter: boolean;
  jumpOpen: boolean;
  onToggleJump: () => void;
  onCloseJump: () => void;
}) {
  const t = useTranslations('Books');
  const inputRef = useRef<HTMLInputElement | null>(null);

  const getDraftPage = () => inputRef.current?.value ?? String(currentPage);

  const setDraftPage = (value: string) => {
    if (inputRef.current) {
      inputRef.current.value = value;
    }
  };

  const clampPage = useCallback(
    (n: number) => Math.min(totalPages, Math.max(1, Math.round(n))),
    [totalPages],
  );

  const commitJump = () => {
    const parsed = Number(getDraftPage().replace(/\D/g, ''));
    if (!parsed || Number.isNaN(parsed)) {
      setDraftPage(String(currentPage));
      return;
    }
    const target = clampPage(parsed);
    setDraftPage(String(target));
    onPageChange(target);
    onCloseJump();
  };

  return (
    <div className="flex items-center justify-center gap-1 sm:gap-1.5">
      <ToolbarButton
        icon={<ChevronLeft className="h-5 w-5 rtl:rotate-180" />}
        label={t('PreviousPage')}
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage <= 1 && !hasPrevChapter}
      />

      <div className="relative" data-popover-root>
        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          onClick={onToggleJump}
          aria-label={t('GoToPage')}
          aria-expanded={jumpOpen}
          className={`inline-flex h-10 min-w-20 shrink-0 items-center justify-center rounded-xl px-3 text-xs font-semibold tabular-nums transition ${
            jumpOpen ? 'bg-primary/20 text-primary' : 'text-foreground/85 hover:bg-secondary'
          }`}
        >
          <span dir="ltr">
            {currentPage} / {totalPages}
          </span>
        </motion.button>

        <Popover open={jumpOpen} onOpened={() => inputRef.current?.select()} onClose={onCloseJump}>
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
                onClick={() =>
                  setDraftPage(String(clampPage(Number(getDraftPage() || currentPage) - 1)))
                }
                className="inline-flex h-10 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-background/70 text-foreground/70 transition hover:bg-secondary sm:hidden"
              >
                <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
              </button>

              <div className="relative min-w-0 flex-1">
                <Hash className="pointer-events-none absolute inset-y-0 inset-s-3 my-auto hidden h-4 w-4 text-muted-foreground sm:block" />
                <input
                  ref={inputRef}
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  enterKeyHint="go"
                  defaultValue={String(currentPage)}
                  key={currentPage}
                  onChange={(e) => {
                    e.currentTarget.value = e.currentTarget.value.replace(/\D/g, '');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitJump();
                    if (e.key === 'ArrowUp')
                      setDraftPage(String(clampPage(Number(getDraftPage() || 0) + 1)));
                    if (e.key === 'ArrowDown')
                      setDraftPage(String(clampPage(Number(getDraftPage() || 0) - 1)));
                  }}
                  aria-label={t('GoToPage')}
                  className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none h-10 w-full rounded-xl border border-border bg-background/70 px-2 text-center text-sm font-semibold tabular-nums text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30 sm:h-11 sm:ps-9 sm:pe-3"
                />
              </div>

              <button
                type="button"
                aria-label={t('NextPage')}
                onClick={() =>
                  setDraftPage(String(clampPage(Number(getDraftPage() || currentPage) + 1)))
                }
                className="inline-flex h-10 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-background/70 text-foreground/70 transition hover:bg-secondary sm:hidden"
              >
                <ChevronRight className="h-4 w-4 rtl:rotate-180" />
              </button>

              <motion.button
                type="button"
                whileTap={{ scale: 0.94 }}
                onClick={commitJump}
                className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 sm:h-11 sm:px-4 sm:text-sm"
              >
                <CornerDownLeft className="h-4 w-4 rtl:-scale-x-100" />
                {t('Go')}
              </motion.button>
            </div>
          </div>
        </Popover>
      </div>

      <ToolbarButton
        icon={<ChevronRight className="h-5 w-5 rtl:rotate-180" />}
        label={t('NextPage')}
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage >= totalPages && !hasNextChapter}
      />
    </div>
  );
}
