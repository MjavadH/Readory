'use client';

import {
  BookMarked,
  BookOpen,
  DollarSign,
  Layers,
  LayoutDashboard,
  RefreshCw,
  Users,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { ContentSection, type ContentData } from '@/components/admin/dashboard/content-section';
import {
  DashboardSkeleton,
  ChartCardSkeleton,
  ListCardSkeleton,
} from '@/components/admin/dashboard/dashboard-skeleton';
import { ErrorState, SectionError } from '@/components/admin/dashboard/error-state';
import { FinanceSection, type FinanceData } from '@/components/admin/dashboard/finance-section';
import { StatCard } from '@/components/admin/stat-card';
import { UsersSection, type UsersData } from '@/components/admin/dashboard/users-section';
import { Button } from '@/components/ui/button';
import { usePermission } from '@/hooks/use-permission';
import { apiClient, getApiErrorMessage } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import AdminPageHeader from '@/components/admin/admin-page-header';
import { EmptySection, SectionHeader } from '@/components/admin/admin-section';

interface AdminOverview {
  users: { total: number; new30d: number; growthPercent: number };
  content: { books: number; chapters: number };
  finance: { revenue30d: number; growthPercent: number } | null;
}

type SectionState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; message: string };

export default function AdminDashboardPage() {
  const t = useTranslations('AdminPage.Dashboard');
  const locale = useLocale();
  const { has, isSuperAdmin, loading: permissionLoading } = usePermission();

  const canFinance = isSuperAdmin || has('MANAGE_FINANCE');
  const canBooks = isSuperAdmin || has('MANAGE_BOOKS');
  const canUsers = isSuperAdmin || has(['MANAGE_USERS', 'MANAGE_STAFF']);

  const [overview, setOverview] = useState<SectionState<AdminOverview>>({ status: 'loading' });
  const [finance, setFinance] = useState<SectionState<FinanceData | null>>({ status: 'loading' });
  const [content, setContent] = useState<SectionState<ContentData | null>>({ status: 'loading' });
  const [users, setUsers] = useState<SectionState<UsersData | null>>({ status: 'loading' });
  const [refreshing, setRefreshing] = useState(false);

  const numberFmt = new Intl.NumberFormat(locale);

  const loadOverview = useCallback(async () => {
    setOverview((prev) => (prev.status === 'loading' ? prev : { status: 'loading' }));
    try {
      const data = await apiClient.get<AdminOverview>('/dashboard/admin/overview', {
        authRequired: true,
      });
      setOverview({ status: 'success', data });
    } catch (err) {
      setOverview({ status: 'error', message: getApiErrorMessage(err) });
    }
  }, []);

  const loadFinance = useCallback(async () => {
    if (!canFinance) {
      setFinance({ status: 'idle' });
      return;
    }
    setFinance((prev) => (prev.status === 'loading' ? prev : { status: 'loading' }));
    try {
      const data = await apiClient.get<FinanceData | null>('/dashboard/admin/finance');
      setFinance({ status: 'success', data });
    } catch (err) {
      setFinance({ status: 'error', message: getApiErrorMessage(err) });
    }
  }, [canFinance]);

  const loadContent = useCallback(async () => {
    if (!canBooks) {
      setContent({ status: 'idle' });
      return;
    }
    setContent((prev) => (prev.status === 'loading' ? prev : { status: 'loading' }));
    try {
      const data = await apiClient.get<ContentData | null>('/dashboard/admin/content');
      setContent({ status: 'success', data });
    } catch (err) {
      setContent({ status: 'error', message: getApiErrorMessage(err) });
    }
  }, [canBooks]);

  const loadUsers = useCallback(async () => {
    if (!canUsers) {
      setUsers({ status: 'idle' });
      return;
    }
    setUsers((prev) => (prev.status === 'loading' ? prev : { status: 'loading' }));
    try {
      const data = await apiClient.get<UsersData | null>('/dashboard/admin/users');
      setUsers({ status: 'success', data });
    } catch (err) {
      setUsers({ status: 'error', message: getApiErrorMessage(err) });
    }
  }, [canUsers]);

  useEffect(() => {
    if (permissionLoading) return;

    queueMicrotask(() => {
      void loadOverview();
      void loadFinance();
      void loadContent();
      void loadUsers();
    });
  }, [permissionLoading, loadOverview, loadFinance, loadContent, loadUsers]);

  const refreshAll = async () => {
    setRefreshing(true);
    await Promise.all([loadOverview(), loadFinance(), loadContent(), loadUsers()]);
    setRefreshing(false);
  };

  // Full-page loading state
  if (permissionLoading || overview.status === 'idle' || overview.status === 'loading') {
    return (
      <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
        <DashboardSkeleton />
      </div>
    );
  }

  // Full-page error (overview is the anchor)
  if (overview.status === 'error') {
    return (
      <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
        <ErrorState message={overview.message} onRetry={loadOverview} />
      </div>
    );
  }

  const o = overview.data;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8 pb-20 sm:pb-0">
      {/* Header */}
      <AdminPageHeader
        icon={LayoutDashboard}
        title={t('Title')}
        description={t('Description')}
        actions={
          <Button
            onClick={refreshAll}
            variant="outline"
            size="sm"
            disabled={refreshing}
            className="shrink-0 gap-2"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            <span className="hidden sm:inline">{t('Refresh')}</span>
          </Button>
        }
      />

      {/* KPI cards */}
      <section aria-label={t('OverviewAria')} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {canUsers && o.users && (
          <StatCard
            index={0}
            title={t('TotalUsers')}
            value={numberFmt.format(o.users.total)}
            hint={t('NewLast30d', { count: numberFmt.format(o.users.new30d) })}
            icon={Users}
            growth={o.users.growthPercent}
            accent="primary"
          />
        )}
        {canBooks && o.content && (
          <>
            <StatCard
              index={1}
              title={t('TotalBooks')}
              value={numberFmt.format(o.content.books)}
              icon={BookMarked}
              accent="emerald"
            />
            <StatCard
              index={2}
              title={t('TotalChapters')}
              value={numberFmt.format(o.content.chapters)}
              icon={Layers}
              accent="amber"
            />
          </>
        )}
        {canFinance && o.finance && (
          <StatCard
            index={3}
            title={t('Revenue30d')}
            value={numberFmt.format(o.finance.revenue30d)}
            icon={DollarSign}
            growth={o.finance.growthPercent}
            accent="rose"
          />
        )}
      </section>

      {/* Finance */}
      {canFinance && (
        <section aria-label={t('Finance.SectionAria')} className="space-y-3">
          <SectionHeader title={t('Finance.SectionTitle')} Icon={DollarSign} />
          {finance.status === 'loading' || finance.status === 'idle' ? (
            <div className="grid gap-4 lg:grid-cols-3">
              <ChartCardSkeleton className="lg:col-span-2" />
              <ListCardSkeleton />
            </div>
          ) : finance.status === 'error' ? (
            <SectionError message={finance.message} onRetry={loadFinance} />
          ) : finance.data ? (
            <FinanceSection data={finance.data} />
          ) : (
            <EmptySection message={t('Finance.NoAccess')} />
          )}
        </section>
      )}

      {/* Content */}
      {canBooks && (
        <section aria-label={t('Content.SectionAria')} className="space-y-3">
          <SectionHeader title={t('Content.SectionTitle')} Icon={BookOpen} />
          {content.status === 'loading' || content.status === 'idle' ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <ListCardSkeleton />
              <ListCardSkeleton />
            </div>
          ) : content.status === 'error' ? (
            <SectionError message={content.message} onRetry={loadContent} />
          ) : content.data ? (
            <ContentSection data={content.data} />
          ) : (
            <EmptySection message={t('Content.NoAccess')} />
          )}
        </section>
      )}

      {/* Users */}
      {canUsers && (
        <section aria-label={t('Users.SectionAria')} className="space-y-3">
          <SectionHeader title={t('Users.SectionTitle')} Icon={Users} />
          {users.status === 'loading' || users.status === 'idle' ? (
            <div className="grid gap-4 lg:grid-cols-3">
              <ChartCardSkeleton className="lg:col-span-2" />
              <ListCardSkeleton />
            </div>
          ) : users.status === 'error' ? (
            <SectionError message={users.message} onRetry={loadUsers} />
          ) : users.data ? (
            <UsersSection data={users.data} />
          ) : (
            <EmptySection message={t('Users.NoAccess')} />
          )}
        </section>
      )}
    </div>
  );
}
