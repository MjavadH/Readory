'use client';

import { useState } from 'react';
import { Plus, Wallet } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLocale, useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';
import { formatAmount } from '@/lib/payments';
import { AddFundsPanel } from '@/components/payments/add-funds-panel';

interface WalletSummaryCardProps {
  balance: number;
  currency?: string;
  isLoading?: boolean;
  className?: string;
}

export function WalletSummaryCard({
  balance,
  currency = 'IRR',
  isLoading,
  className,
}: WalletSummaryCardProps) {
  const t = useTranslations('Wallet');
  const locale = useLocale();
  const [open, setOpen] = useState(false);

  if (isLoading) {
    return (
      <div
        role="status"
        aria-label={t('loading')}
        className={cn(
          'rounded-[2.5rem] border border-border bg-card p-10 shadow-xl shadow-black/5',
          className,
        )}
      >
        <div className="mx-auto h-10 w-40 animate-pulse rounded-2xl bg-muted-foreground/20" />
        <div className="mt-6 h-14 w-full animate-pulse rounded-2xl bg-muted-foreground/20" />
      </div>
    );
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          'group relative isolate overflow-hidden rounded-[2.5rem] border border-border bg-card p-8 shadow-xl shadow-black/5 sm:p-10',
          className,
        )}
      >
        {/* Logical inset so the watermark flips correctly in RTL */}
        <div aria-hidden className="pointer-events-none absolute top-0 inset-e-0 p-8 opacity-5">
          <Wallet className="h-32 w-32 transition-transform duration-700 group-hover:scale-110" />
        </div>

        <div className="relative z-10 space-y-6 text-center">
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {t('walletBalance')}
            </p>
            <motion.div
              key={balance}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="flex items-baseline justify-center gap-2"
            >
              <span
                dir="ltr"
                className="text-3xl font-extrabold tracking-tight tabular-nums text-foreground drop-shadow-sm sm:text-4xl"
              >
                {formatAmount(balance, locale)}
              </span>
              <span className="text-xs font-medium text-muted-foreground">
                {t(`currency.${currency}`)}
              </span>
            </motion.div>
          </div>

          <div className="flex items-center gap-2">
            <motion.button
              type="button"
              onClick={() => setOpen(true)}
              whileTap={{ scale: 0.96 }}
              whileHover={{ y: -1 }}
              transition={{ type: 'spring', stiffness: 420, damping: 26 }}
              className="group/btn flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 text-base font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-colors hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <Plus
                className="h-5 w-5 transition-transform group-hover/btn:rotate-90"
                aria-hidden
              />
              {t('addFunds')}
            </motion.button>
          </div>
        </div>
      </motion.div>

      <AddFundsPanel open={open} onOpenChange={setOpen} currency={currency} />
    </>
  );
}
