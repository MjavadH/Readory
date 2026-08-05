'use client';

import { Wallet, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

interface WalletCardProps {
  balance: number;
  isLoading?: boolean;
  onAddFunds?: () => void;
  className?: string;
}

export function WalletCard({ balance, isLoading, onAddFunds, className }: WalletCardProps) {
  const t = useTranslations('UserHeader');

  if (isLoading) {
    return (
      <div className={cn('rounded-2xl bg-muted/60 p-4', className)}>
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-3 w-20 animate-pulse rounded bg-muted-foreground/20" />
            <div className="h-6 w-24 animate-pulse rounded bg-muted-foreground/20" />
          </div>
          <div className="h-10 w-10 animate-pulse rounded-xl bg-muted-foreground/20" />
        </div>
        <div className="mt-4 h-9 w-full animate-pulse rounded-xl bg-muted-foreground/20" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={cn(
        'relative overflow-hidden rounded-2xl bg-linear-to-br from-primary to-primary/85 p-4 text-primary-foreground shadow-sm ring-1 ring-inset ring-primary-foreground/10',
        className,
      )}
    >
      <div className="pointer-events-none absolute -top-10 ltr:-right-8 rtl:-left-8 h-28 w-28 rounded-full bg-primary-foreground/10 blur-2xl" />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wider text-primary-foreground/75">
            {t('WalletBalance')}
          </p>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl font-bold tabular-nums leading-none">
              {balance.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-foreground/15 backdrop-blur-sm">
          <Wallet className="h-5 w-5" />
        </div>
      </div>

      {onAddFunds && (
        <motion.button
          type="button"
          onClick={onAddFunds}
          whileTap={{ scale: 0.97 }}
          className="relative mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary-foreground/15 px-3 py-2 text-xs font-semibold text-primary-foreground backdrop-blur-sm transition-colors hover:bg-primary-foreground/25"
        >
          <Plus className="h-3.5 w-3.5" />
          {t('AddFunds')}
        </motion.button>
      )}
    </motion.div>
  );
}
