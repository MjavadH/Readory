'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import {
  BellRing,
  BookOpen,
  CheckCheck,
  Megaphone,
  RefreshCw,
  Settings2,
  Sparkles,
  X,
} from 'lucide-react';

import { apiClient } from '@/lib/api-client';
import { formatUpdateTime } from '@/lib/time';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { NotificationType, type NotificationApiItem } from '@readory/shared';

type Filter = 'all' | 'unread';

const listVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
};

function iconFor(type: NotificationApiItem['type']) {
  switch (type) {
    case NotificationType.NEW_BOOK_PUBLISHED:
      return Sparkles;
    case NotificationType.NEW_CHAPTER_PUBLISHED:
      return BookOpen;
    case NotificationType.ADMIN_BROADCAST:
      return Megaphone;
    default:
      return Settings2;
  }
}

export default function NotificationsPage() {
  const t = useTranslations('Notifications');
  const ti = useTranslations('Time');

  const [items, setItems] = useState<NotificationApiItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const loadUnread = useCallback(async () => {
    try {
      const res = await apiClient.get<{ unreadCount: number }>('/notifications/unread-count', {
        cache: 'no-store',
      });
      setUnreadCount(res.unreadCount);
    } catch {
      /* count is non-critical */
    }
  }, []);

  const load = useCallback(async (next?: string | null) => {
    next ? setLoadingMore(true) : setLoading(true);
    setError(false);
    try {
      const res = await apiClient.get<{
        items: NotificationApiItem[];
        nextCursor: string | null;
      }>('/notifications', {
        query: { limit: 20, cursor: next ?? undefined },
        cache: 'no-store',
      });
      setItems((prev) => (next ? [...prev, ...res.items] : res.items));
      setCursor(res.nextCursor);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    void load();
    void loadUnread();
  }, [load, loadUnread]);

  const visible = useMemo(
    () => (filter === 'unread' ? items.filter((n) => !n.readAt) : items),
    [items, filter],
  );

  const markAll = async () => {
    if (busy || unreadCount === 0) return;
    setBusy(true);
    const now = new Date().toISOString();
    const prev = items;
    setItems((list) => list.map((n) => (n.readAt ? n : { ...n, readAt: now })));
    setUnreadCount(0);
    try {
      await apiClient.patch('/notifications/read', {});
    } catch {
      setItems(prev);
      void loadUnread();
    } finally {
      setBusy(false);
    }
  };

  const markOne = async (n: NotificationApiItem) => {
    if (n.readAt) return;
    setItems((list) =>
      list.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)),
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await apiClient.patch(`/notifications/${n.id}/read`, {});
    } catch {
      void loadUnread();
    }
  };

  const dismiss = async (n: NotificationApiItem) => {
    const prev = items;
    setItems((list) => list.filter((x) => x.id !== n.id));
    if (!n.readAt) setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await apiClient.delete(`/notifications/${n.id}`);
    } catch {
      setItems(prev);
      void loadUnread();
    }
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
      {/* Header */}
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
            <BellRing className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -inset-e-1 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">{t('title')}</h1>
            <p className="truncate text-sm text-muted-foreground">
              {unreadCount > 0 ? t('unreadSummary', { count: unreadCount }) : t('allRead')}
            </p>
          </div>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={markAll}
          disabled={busy || unreadCount === 0}
          className="shrink-0 gap-2"
        >
          <CheckCheck className="h-4 w-4" />
          <span className="hidden sm:inline">{t('markAllRead')}</span>
        </Button>
      </header>

      {/* Filters */}
      <div className="mt-5 flex items-center gap-1 rounded-xl border bg-muted/40 p-1">
        {(['all', 'unread'] as Filter[]).map((key) => {
          const active = filter === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={cn(
                'relative flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {active && (
                <motion.span
                  layoutId="notif-filter-pill"
                  transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                  className="absolute inset-0 rounded-lg bg-background shadow-sm ring-1 ring-border"
                />
              )}
              <span className="relative z-10">
                {key === 'all' ? t('filters.all') : t('filters.unread')}
                {key === 'unread' && unreadCount > 0 ? ` (${unreadCount})` : ''}
              </span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      <section className="mt-4">
        {loading ? (
          <ul className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="rounded-2xl border bg-card p-4">
                <div className="flex gap-3">
                  <div className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-muted" />
                  <div className="w-full space-y-2">
                    <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-20 animate-pulse rounded bg-muted" />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : error ? (
          <EmptyState
            icon={<RefreshCw className="h-6 w-6" />}
            title={t('error.title')}
            description={t('error.description')}
            action={
              <Button variant="outline" size="sm" onClick={() => load()}>
                {t('error.retry')}
              </Button>
            }
          />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<BellRing className="h-6 w-6" />}
            title={filter === 'unread' ? t('empty.unreadTitle') : t('empty.title')}
            description={t('empty.description')}
          />
        ) : (
          <motion.ul
            variants={listVariants}
            initial="hidden"
            animate="show"
            className="space-y-2.5"
          >
            <AnimatePresence initial={false}>
              {visible.map((n) => {
                const Icon = iconFor(n.type);
                const unread = !n.readAt;
                return (
                  <motion.li
                    key={n.id}
                    layout
                    variants={{
                      hidden: { opacity: 0, y: 8 },
                      show: { opacity: 1, y: 0, transition: { duration: 0.22, ease: 'easeOut' } },
                      exit: {
                        opacity: 0,
                        scale: 0.98,
                        transition: { duration: 0.15, ease: 'easeIn' },
                      },
                    }}
                    exit="exit"
                    className={cn(
                      'group relative overflow-hidden rounded-2xl border bg-card transition-colors',
                      unread ? 'border-primary/30 bg-primary/4' : 'hover:bg-accent/50',
                    )}
                  >
                    {unread && (
                      <span className="absolute inset-y-0 inset-s-0 w-1 bg-primary" aria-hidden />
                    )}

                    <Link
                      href={n.actionUrl || '#'}
                      onClick={() => void markOne(n)}
                      className="flex items-start gap-3 p-4 ps-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span
                        className={cn(
                          'grid h-10 w-10 shrink-0 place-items-center rounded-xl',
                          unread ? 'bg-primary/12 text-primary' : 'bg-muted text-muted-foreground',
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </span>

                      <div className="min-w-0 flex-1 text-start">
                        <div className="flex items-start gap-2">
                          <h2
                            className={cn(
                              'line-clamp-2 text-sm font-semibold sm:text-base',
                              !unread && 'text-foreground/90',
                            )}
                          >
                            {n.title}
                          </h2>
                          {unread && (
                            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                          )}
                        </div>
                        {n.body && (
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                            {n.body}
                          </p>
                        )}
                        <time
                          dateTime={n.createdAt}
                          className="mt-2 block text-xs text-muted-foreground/80"
                        >
                          {formatUpdateTime(n.createdAt, ti)}
                        </time>
                      </div>
                    </Link>

                    <button
                      type="button"
                      aria-label={t('dismiss')}
                      onClick={() => void dismiss(n)}
                      className="absolute inset-e-2 top-2 grid h-8 w-8 place-items-center rounded-lg text-muted-foreground opacity-100 transition hover:bg-accent hover:text-foreground sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </motion.ul>
        )}

        {!loading && !error && cursor && (
          <Button
            variant="outline"
            onClick={() => load(cursor)}
            disabled={loadingMore}
            className="mt-4 w-full"
          >
            {loadingMore ? t('loading') : t('loadMore')}
          </Button>
        )}
      </section>
    </main>
  );
}

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-card/50 px-6 py-14 text-center"
    >
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
        {icon}
      </span>
      <h3 className="mt-4 text-base font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </motion.div>
  );
}
