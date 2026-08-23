'use client';

import { motion } from 'framer-motion';
import { ArrowUpRight, Plus, RefreshCw, Wallet } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { AddFundsPanel } from '@/components/payments/add-funds-panel';
import { formatAmount } from '@/lib/payments';
import { cn } from '@/lib/utils';

interface WalletCardProps {
  balance: number;
  currency?: string;
  isLoading?: boolean;
  /** Called after a gateway redirect is created or the balance may have changed. */
  onBalanceRefresh?: () => void;
  /** Hide the deposit affordance (e.g. read-only contexts). */
  disableAddFunds?: boolean;
  className?: string;
}

export function WalletCard({
  balance,
  currency = 'IRR',
  isLoading,
  onBalanceRefresh,
  disableAddFunds,
  className,
}: WalletCardProps) {
  const t = useTranslations('Wallet');
  const locale = useLocale();
  const [open, setOpen] = useState(false);

  if (isLoading) {
    return (
      <div
        role="status"
        aria-label={t('loading')}
        className={cn('rounded-2xl border border-border/60 bg-muted/50 p-4', className)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="w-full space-y-2">
            <div className="h-3 w-24 animate-pulse rounded-full bg-muted-foreground/20" />
            <div className="h-7 w-32 animate-pulse rounded-lg bg-muted-foreground/20" />
          </div>
          <div className="h-11 w-11 shrink-0 animate-pulse rounded-2xl bg-muted-foreground/20" />
        </div>
        <div className="mt-4 h-10 w-full animate-pulse rounded-xl bg-muted-foreground/20" />
      </div>
    );
  }

  return (
    <>
      <motion.section
        initial={{ opacity: 0, y: 8, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        aria-label={t('walletBalance')}
        className={cn(
          'group relative isolate overflow-hidden rounded-2xl p-4 shadow-sm',
          'bg-linear-to-br from-primary via-primary to-primary/80 text-primary-foreground',
          'ring-1 ring-inset ring-primary-foreground/15',
          'dark:from-primary/90 dark:via-primary/80 dark:to-primary/60',
          className,
        )}
      >
        {/* Ambient light */}
        <motion.span
          aria-hidden
          initial={{ opacity: 0.5, scale: 0.9 }}
          animate={{ opacity: [0.45, 0.75, 0.45], scale: [0.95, 1.05, 0.95] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
          className="pointer-events-none absolute -top-12 -inset-e-10 h-32 w-32 rounded-full bg-primary-foreground/20 blur-3xl"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-16 -inset-s-12 h-36 w-36 rounded-full bg-primary-foreground/10 blur-3xl"
        />

        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wider text-primary-foreground/75">
              {t('walletBalance')}
            </p>

            <motion.div
              key={balance}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="mt-1.5 flex items-baseline gap-1.5"
            >
              <span
                dir="ltr"
                className="truncate text-2xl font-bold leading-none tabular-nums sm:text-3xl"
              >
                {formatAmount(balance, locale)}
              </span>
              <span className="shrink-0 text-[11px] font-medium text-primary-foreground/70">
                {t(`currency.${currency}`)}
              </span>
            </motion.div>
          </div>

          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-foreground/15 backdrop-blur-sm ring-1 ring-inset ring-primary-foreground/10">
            <Wallet className="h-5 w-5" aria-hidden />
          </div>
        </div>

        <div className="relative mt-4 flex items-center gap-2">
          {!disableAddFunds && (
            <motion.button
              type="button"
              onClick={() => setOpen(true)}
              whileTap={{ scale: 0.97 }}
              whileHover={{ y: -1 }}
              transition={{ type: 'spring', stiffness: 420, damping: 26 }}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5',
                'bg-primary-foreground/15 text-xs font-semibold backdrop-blur-sm',
                'ring-1 ring-inset ring-primary-foreground/15 transition-colors',
                'hover:bg-primary-foreground/25 focus-visible:outline-none',
                'focus-visible:ring-2 focus-visible:ring-primary-foreground/70',
              )}
            >
              <Plus className="h-4 w-4" aria-hidden />
              {t('addFunds')}
              <ArrowUpRight className="h-3.5 w-3.5 opacity-70 rtl:-scale-x-100" aria-hidden />
            </motion.button>
          )}

          {onBalanceRefresh && (
            <motion.button
              type="button"
              onClick={onBalanceRefresh}
              whileTap={{ scale: 0.94, rotate: -90 }}
              aria-label={t('refresh')}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-foreground/10 ring-1 ring-inset ring-primary-foreground/15 transition-colors hover:bg-primary-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/70"
            >
              <RefreshCw className="h-4 w-4" aria-hidden />
            </motion.button>
          )}
        </div>
      </motion.section>

      {!disableAddFunds && (
        <AddFundsPanel
          open={open}
          onOpenChange={setOpen}
          currency={currency}
          {...(onBalanceRefresh ? { onSuccess: onBalanceRefresh } : {})}
        />
      )}
    </>
  );
}
