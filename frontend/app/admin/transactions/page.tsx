'use client';

import { Activity, ArrowDownCircle, ArrowUpCircle, Banknote, Wallet } from 'lucide-react';
import { useTranslations } from 'next-intl';
import React, { useEffect, useRef, useState } from 'react';
import AdminPageHeader from '@/components/admin/admin-page-header';
import { StatCard } from '@/components/admin/stat-card';
import { AppPagination } from '@/components/app-pagination';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiClient } from '@/lib/api-client';

interface Transaction {
  id: number;
  walletId: number;
  amount: string | number;
  type: 'CREDIT' | 'DEBIT';
  createdAt: string;
  reference?: string | null;
  wallet?: {
    userId: number;
    user?: {
      username: string;
    };
  };
}

interface TransactionStats {
  total: number;
  credits: number;
  debits: number;
  creditAmount: number;
  debitAmount: number;
  growth?: {
    totalTransactions: number;
    creditAmount: number;
    debitAmount: number;
  };
}

export default function AdminTransactions() {
  const t = useTranslations('AdminPage.Transactions');
  const g = useTranslations('General');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<TransactionStats>({
    total: 0,
    credits: 0,
    debits: 0,
    creditAmount: 0,
    debitAmount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const paginationScrollRef = useRef<HTMLDivElement>(null);
  const [hasMore, setHasMore] = useState(false);
  const ITEMS_PER_PAGE = 20;
  const totalPages = Math.ceil(stats.total / ITEMS_PER_PAGE);

  useEffect(() => {
    async function fetchTransactions() {
      setLoading(true);
      try {
        const data = await apiClient.get<{
          transactions?: Transaction[];
          stats?: TransactionStats;
          hasMore?: boolean;
        }>('/wallet/transactions', {
          query: { page, limit: ITEMS_PER_PAGE },
        });

        if (data.transactions && Array.isArray(data.transactions)) {
          setTransactions(data.transactions);
          setHasMore(data.hasMore || false);

          if (data.stats) {
            setStats({
              total: data.stats.total || 0,
              credits: data.stats.credits || 0,
              debits: data.stats.debits || 0,
              creditAmount: data.stats.creditAmount || 0,
              debitAmount: data.stats.debitAmount || 0,
              growth: data.stats.growth,
            });
          }
        }
      } catch (err) {
        console.error('Error fetching transactions', err);
      } finally {
        setLoading(false);
      }
    }
    void fetchTransactions();
  }, [page]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(g('locale'), {
      style: 'currency',
      currency: g('CurrencyName'),
    }).format(amount);
  };

  if (loading && transactions.length === 0) {
    return (
      <div className="min-h-screen bg-linear-to-br from-muted/30 via-background to-muted/20">
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-400 mx-auto">
          <div className="space-y-2 p-3 md:p-0">
            <div className="h-8 w-72 rounded-lg bg-muted animate-pulse" />
            <div className="h-4 w-48 rounded-md bg-muted animate-pulse" />
          </div>
          <div className="animate-pulse space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="h-32 bg-muted rounded-xl" />
              <div className="h-32 bg-muted rounded-xl" />
              <div className="h-32 bg-muted rounded-xl" />
            </div>
            <div className="h-96 bg-muted rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-muted/30 via-background to-muted/20 pb-20 sm:pb-0">
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-400 mx-auto">
        <AdminPageHeader icon={Banknote} title={t('Title')} description={t('Description')} />

        {/* Stats Cards */}
        <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            index={0}
            title={t('TotalTransactions')}
            value={stats.total.toLocaleString()}
            icon={Activity}
            accent="primary"
            growth={stats.growth?.totalTransactions}
          />
          <StatCard
            index={1}
            title={t('Deposits')}
            value={formatCurrency(stats.creditAmount)}
            icon={ArrowUpCircle}
            accent="emerald"
            growth={stats.growth?.creditAmount}
          />
          <StatCard
            index={2}
            title={t('Withdrawals')}
            value={formatCurrency(stats.debitAmount)}
            icon={ArrowDownCircle}
            accent="rose"
            growth={stats.growth?.debitAmount}
          />
        </div>

        <Card ref={paginationScrollRef} className="border-none shadow-lg overflow-hidden bg-card">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border/50">
                    <TableHead className="font-semibold rtl:text-right">{t('User')}</TableHead>
                    <TableHead className="font-semibold rtl:text-right">{t('Type')}</TableHead>
                    <TableHead className="ltr:text-right font-semibold rtl:text-left">
                      {t('Amount')}
                    </TableHead>
                    <TableHead className="font-semibold rtl:text-right">{t('Reference')}</TableHead>
                    <TableHead className="font-semibold rtl:text-right">{t('DateTime')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-32">
                        <div className="flex flex-col items-center justify-center text-muted-foreground py-8">
                          <div className="size-16 sm:size-20 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                            <Wallet className="size-8 sm:size-10 text-muted-foreground/50" />
                          </div>
                          <p className="text-base sm:text-lg font-semibold mb-1">
                            {t('NoTransactionsFound')}
                          </p>
                          <p className="text-xs sm:text-sm text-muted-foreground/60">
                            {t('NoTransactionsFoundDescription')}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    transactions.map((transaction) => (
                      <TableRow
                        key={transaction.id}
                        className="hover:bg-muted/20 transition-colors"
                      >
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm sm:text-base">
                              {transaction.wallet?.user?.username}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell>
                          {transaction.type === 'CREDIT' ? (
                            <Badge
                              variant="outline"
                              className="gap-1.5 border-emerald-600/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 hover:bg-emerald-500/20"
                            >
                              <ArrowUpCircle className="size-3" />
                              {t('Credit')}
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="gap-1.5 border-red-600/30 bg-red-500/10 text-red-600 dark:text-red-500 hover:bg-red-500/20"
                            >
                              <ArrowDownCircle className="size-3" />
                              {t('Debit')}
                            </Badge>
                          )}
                        </TableCell>

                        <TableCell className="text-right rtl:text-left">
                          <span
                            className={`text-base sm:text-lg font-bold tabular-nums
                                                    ${
                                                      transaction.type === 'CREDIT'
                                                        ? 'text-emerald-600 dark:text-emerald-500'
                                                        : 'text-red-600 dark:text-red-500'
                                                    }`}
                          >
                            {formatCurrency(Number(transaction.amount)).replace('-', '')}
                          </span>
                        </TableCell>

                        <TableCell>
                          {transaction.reference ? (
                            <Badge variant="secondary" className="font-mono text-xs">
                              {transaction.reference}
                            </Badge>
                          ) : (
                            <span className="text-xs sm:text-sm text-muted-foreground italic">
                              {t('NoReference')}
                            </span>
                          )}
                        </TableCell>

                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs sm:text-sm font-medium">
                              {new Date(transaction.createdAt).toLocaleDateString(g('locale'), {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </span>
                            <span className="text-[10px] sm:text-xs text-muted-foreground">
                              {new Date(transaction.createdAt).toLocaleTimeString(g('locale'), {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        <AppPagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={stats.total}
          pageSize={ITEMS_PER_PAGE}
          itemLabel={t('transactions')}
          onPageChange={setPage}
          canGoPrevious={page > 1}
          canGoNext={hasMore}
          scrollTarget={paginationScrollRef}
        />
      </div>
    </div>
  );
}
