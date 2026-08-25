'use client';

import { motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowRight,
  BookDashedIcon,
  BookMarked,
  History,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import {
  ContinueReadingCard,
  ContinueReadingCardSkeleton,
} from '@/components/dashboard/ContinueReadingCard';
import { LibraryCard, LibraryCardSkeleton } from '@/components/dashboard/LibraryCard';
import { TransactionList, TransactionListSkeleton } from '@/components/dashboard/TransactionList';
import { WalletSummaryCard } from '@/components/dashboard/wallet-summary-card';
import { apiClient } from '@/lib/api-client';
import type { DashboardOverview } from '@/lib/types';

export default function OverviewPage() {
  const t = useTranslations('UserDashboard');
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void apiClient
      .get<DashboardOverview>('/dashboard')
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch(() => {
        if (!cancelled) setError(t('FailedLoadDashboard'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [t]);

  if (loading) {
    return (
      <div className="space-y-12 pb-12">
        {/* Header */}
        <section className="relative overflow-hidden p-10 rounded-[2.5rem] bg-linear-to-br from-primary/10 via-primary/5 to-transparent border border-primary/10 shadow-sm ring-1 ring-primary/5">
          <div className="relative z-10 space-y-4">
            {/* Title */}
            <div className="h-16 w-2/3 rounded-2xl bg-muted-foreground/20 animate-pulse" />
            {/* Subtitle */}
            <div className="space-y-2">
              <div className="h-6 w-full max-w-2xl rounded-xl bg-muted-foreground/20 animate-pulse" />
              <div className="h-6 w-2/4 max-w-2xl rounded-xl bg-muted-foreground/20 animate-pulse" />
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Left Column */}
          <div className="lg:col-span-8 space-y-12">
            {/* Continue Reading */}
            <section className="space-y-6">
              <div className="flex items-center justify-between px-2">
                <div className="h-8 w-48 rounded-xl bg-muted-foreground/20 animate-pulse" />
              </div>
              <div className="w-full mx-auto">
                <ContinueReadingCardSkeleton />
              </div>
            </section>

            {/* Library */}
            <section className="space-y-6">
              <div className="flex items-center justify-between px-2">
                <div className="h-8 w-48 rounded-xl bg-muted-foreground/20 animate-pulse" />
                <div className="h-10 w-32 rounded-2xl bg-muted-foreground/20 animate-pulse" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                <LibraryCardSkeleton />
              </div>
            </section>

            {/* Recent Transactions */}
            <section className="space-y-6">
              <div className="flex items-center justify-between px-2">
                <div className="h-8 w-40 rounded-xl bg-muted-foreground/20 animate-pulse" />
                <div className="h-10 w-28 rounded-2xl bg-muted-foreground/20 animate-pulse" />
              </div>
              <div className="bg-card border border-border rounded-[2.5rem] p-6 shadow-xl shadow-black/5 min-h-100">
                <TransactionListSkeleton limit={5} />
              </div>
            </section>
          </div>

          {/* Right Column (Wallet) */}
          <div className="lg:col-span-4 space-y-10">
            <section className="space-y-6 sticky top-0">
              <div className="flex items-center justify-between px-2">
                <div className="h-8 w-32 rounded-xl bg-muted-foreground/20 animate-pulse" />
              </div>

              <div className="bg-card border border-border rounded-[2.5rem] p-10 shadow-xl shadow-black/5 relative overflow-hidden group">
                <div className="relative z-10 text-center space-y-6">
                  {/* Balance */}
                  <div className="h-16 w-48 mx-auto rounded-2xl bg-muted-foreground/20 animate-pulse" />
                  {/* Button */}
                  <div className="h-20 w-full rounded-2xl bg-muted-foreground/20 animate-pulse" />
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center max-w-md mx-auto">
        <div className="p-4 bg-destructive/10 rounded-full">
          <AlertCircle className="w-12 h-12 text-destructive" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">{t('SomethingWentWrong')}</h2>
          <p className="text-muted-foreground">{error}</p>
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-6 py-2.5 bg-primary text-primary-foreground rounded-2xl font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition-opacity"
        >
          {t('TryAgain')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-12">
      {/* Header */}
      <section className="relative overflow-hidden p-10 rounded-[2.5rem] bg-linear-to-br from-primary/10 via-primary/5 to-transparent border border-primary/10 shadow-sm ring-1 ring-primary/5">
        <div className="absolute top-0 ltr:right-0 rtl:left-0 p-8 opacity-5 -rotate-12 ltr:translate-x-1/4 rtl:-translate-x-1/4 -translate-y-1/4">
          <TrendingUp className="w-64 h-64" />
        </div>
        <div className="relative z-10 space-y-2">
          <h1 className="text-5xl font-extrabold tracking-tight text-foreground">
            {t('Hello')}{' '}
            <span style={{ wordBreak: 'break-all' }} className="text-primary">
              {data.profile.username}
            </span>
            !
          </h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-muted-foreground text-lg max-w-2xl font-medium leading-relaxed"
          >
            {data.continueReading &&
              t('Description1', { DataProgressPercent: data.continueReading.progress.percent })}
          </motion.p>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 space-y-12">
          {/* Continue Reading Section */}
          {data.continueReading && (
            <section className="space-y-6">
              <div className="flex items-center justify-between px-2">
                <h2 className="text-2xl font-bold tracking-tight flex items-center gap-3">
                  <BookMarked className="w-6 h-6 text-primary" />
                  {t('ContinueReading')}
                </h2>
              </div>
              <ContinueReadingCard progress={data.continueReading} />
            </section>
          )}

          {/* Library Section */}
          <section className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-2xl font-bold tracking-tight flex items-center gap-3">
                <TrendingUp className="w-6 h-6 text-primary" />
                {t('RecentLibrary')}
              </h2>
              <Link
                href="/dashboard/library"
                className="group flex items-center gap-2 text-primary font-bold hover:gap-3 transition-all px-4 py-2 bg-primary/5 rounded-2xl hover:bg-primary/10"
              >
                {t('ViewFullLibrary')}
                <ArrowRight className="w-4 h-4 rtl:rotate-180" />
              </Link>
            </div>
            {data.recentLibrary.data.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {data.recentLibrary.data.map((item) => (
                  <LibraryCard key={item.book.id} item={item} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-87.5 text-center gap-4">
                <div className="p-4 bg-muted rounded-full">
                  <BookDashedIcon className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground font-medium">{t('NoBooks')}</p>
              </div>
            )}
          </section>

          {/* Recent Transactions Section */}
          <section className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-2xl font-bold tracking-tight flex items-center gap-3">
                <History className="w-6 h-6 text-primary" />
                {t('Transactions')}
              </h2>
              <Link
                href="/dashboard/history"
                className="group flex items-center gap-2 text-primary font-bold hover:gap-3 transition-all px-4 py-2 bg-primary/5 rounded-2xl"
              >
                {t('History')}
                <ArrowRight className="w-4 h-4 rtl:rotate-180" />
              </Link>
            </div>
            <div className="bg-card border border-border rounded-[2.5rem] p-6 shadow-xl shadow-black/5 min-h-100">
              {data.recentTransactions.data.length > 0 ? (
                <TransactionList transactions={data.recentTransactions.data} limit={5} />
              ) : (
                <div className="flex flex-col items-center justify-center h-87.5 text-center gap-4">
                  <div className="p-4 bg-muted rounded-full">
                    <History className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground font-medium">{t('NoTransactions')}</p>
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="lg:col-span-4 space-y-10">
          {/* Wallet Section */}
          <section className="space-y-6 sticky top-0">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-2xl font-bold tracking-tight flex items-center gap-3">
                <Wallet className="w-6 h-6 text-primary" />
                {t('Wallet')}
              </h2>
            </div>
            <WalletSummaryCard balance={data.wallet.balance} currency="IRR" />
          </section>
        </div>
      </div>
    </div>
  );
}
