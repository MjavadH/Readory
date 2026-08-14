'use client';
import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Bell, CheckCheck, Inbox, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { getBookCoverThumbnailUrl } from '@/lib/media';
import { cn } from '@/lib/utils';
import { NotificationType } from '@readory/shared';

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
  actionUrl?: string | null;
  readAt?: string | null;
  createdAt: string;
};

function isBookContentNotification(item: NotificationItem) {
  return (
    item.type === NotificationType.NEW_BOOK_PUBLISHED ||
    item.type === NotificationType.NEW_CHAPTER_PUBLISHED
  );
}

function getCoverImage(item: NotificationItem) {
  const coverImage = item.metadata?.coverImage;
  return isBookContentNotification(item) && typeof coverImage === 'string' && coverImage.length > 0
    ? coverImage
    : null;
}

function useRelativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  if (h < 24) return `${h}h`;
  return `${d}d`;
}

function NotificationRow({
  item,
  onRead,
  index,
}: {
  item: NotificationItem;
  onRead: (id: string) => void;
  index: number;
}) {
  const time = useRelativeTime(item.createdAt);
  const isUnread = !item.readAt;
  const href = item.actionUrl || '/notifications';
  const coverImage = getCoverImage(item);

  return (
    <motion.a
      href={href}
      onClick={() => isUnread && onRead(item.id)}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, delay: index * 0.04, ease: 'easeOut' }}
      className={cn(
        'group relative flex gap-3 rounded-xl px-3 py-3 transition-colors duration-150',
        'hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isUnread ? 'bg-primary/5 dark:bg-primary/10' : 'bg-transparent',
      )}
    >
      {/* Unread dot */}
      <div className="mt-1.5 flex shrink-0 items-start">
        <span
          className={cn(
            'block size-2 rounded-full transition-colors duration-200',
            isUnread ? 'bg-primary' : 'bg-muted-foreground/20',
          )}
        />
      </div>

      {coverImage && (
        <span className="relative h-12 w-9 shrink-0 overflow-hidden rounded-lg border bg-muted shadow-sm">
          <Image
            src={getBookCoverThumbnailUrl(coverImage)}
            alt={item.title}
            fill
            sizes="(max-width: 480px) 45vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 200px"
            className="object-cover"
          />
        </span>
      )}

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'truncate text-sm leading-snug',
            isUnread ? 'font-semibold text-foreground' : 'font-medium text-foreground/80',
          )}
        >
          {item.title}
        </p>
        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {item.body}
        </p>
      </div>

      {/* Time */}
      <span className="shrink-0 self-start pt-0.5 text-[10px] tabular-nums text-muted-foreground/60">
        {time}
      </span>
    </motion.a>
  );
}

function EmptyState({ t }: { t: (k: string) => string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="flex flex-col items-center gap-3 py-10 text-center"
    >
      <div className="flex size-14 items-center justify-center rounded-2xl border border-border bg-muted/50">
        <Inbox className="size-6 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{t('noNotifications')}</p>
        <p className="max-w-50 text-xs leading-relaxed text-muted-foreground">
          {t('noNotificationsDesc')}
        </p>
      </div>
    </motion.div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex gap-3 rounded-xl px-3 py-3">
      <Skeleton className="mt-1.5 size-2 shrink-0 rounded-full" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-3/4 rounded" />
        <Skeleton className="h-3 w-full rounded" />
        <Skeleton className="h-3 w-1/2 rounded" />
      </div>
    </div>
  );
}

export function NotificationBell() {
  const t = useTranslations('Notifications');
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [ringing, setRinging] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [list, unread] = await Promise.all([
        apiClient.get<{ items: NotificationItem[] }>('/notifications', { query: { limit: 5 } }),
        apiClient.get<{ unreadCount: number }>('/notifications/unread-count'),
      ]);
      setItems(list.items);
      setCount(unread.unreadCount);
    } catch {
      // silently fail — user may not be authenticated
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(id);
  }, [refresh]);

  useEffect(() => {
    if (count <= 0) return;
    const startId = window.setTimeout(() => setRinging(true), 0);
    const stopId = window.setTimeout(() => setRinging(false), 700);
    return () => {
      window.clearTimeout(startId);
      window.clearTimeout(stopId);
    };
  }, [count]);

  const markAllRead = useCallback(async () => {
    try {
      await apiClient.patch('/notifications/read', {});
      await refresh();
    } catch {
      /* ignore */
    }
  }, [refresh]);

  const markOneRead = useCallback(async (id: string) => {
    try {
      await apiClient.patch(`/notifications/${id}/read`, {});
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)),
      );
      setCount((c) => Math.max(0, c - 1));
    } catch {
      /* ignore */
    }
  }, []);

  const displayCount = Math.min(count, 99);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative size-9 rounded-xl"
          aria-label={t('title')}
        >
          <motion.span
            animate={
              ringing
                ? {
                    rotate: [0, -12, 12, -8, 8, -4, 4, 0],
                    transition: {
                      duration: 0.6,
                      repeatDelay: 3,
                    },
                  }
                : {
                    rotate: 0,
                  }
            }
            className="flex items-center justify-center"
          >
            <Bell className="size-4.5" />
          </motion.span>

          {/* Unread badge */}
          <AnimatePresence>
            {displayCount > 0 && (
              <motion.span
                key="badge"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                className={cn(
                  'absolute -inset-e-0.5 -top-0.5 flex min-w-4.5 items-center justify-center',
                  'rounded-full bg-primary px-1 py-px text-[10px] font-bold leading-none text-primary-foreground',
                  'ring-2 ring-background',
                )}
              >
                {displayCount > 9 ? '9+' : displayCount}
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-85 p-0 shadow-xl shadow-black/8 sm:w-95"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-4 pt-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{t('title')}</span>
            {count > 0 && (
              <Badge variant="secondary" className="h-5 rounded-full px-1.5 text-[10px] font-bold">
                {displayCount} {t('unread')}
              </Badge>
            )}
          </div>
          {count > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 rounded-lg px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={markAllRead}
            >
              <CheckCheck className="size-3.5" />
              {t('markAllRead')}
            </Button>
          )}
        </div>

        <Separator />

        {/* Body */}
        <ScrollArea className="max-h-95">
          <div className="p-2">
            {loading ? (
              <div className="space-y-0.5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <SkeletonRow key={i} />
                ))}
              </div>
            ) : items.length === 0 ? (
              <EmptyState t={t} />
            ) : (
              <div className="space-y-0.5">
                {items.map((item, i) => (
                  <NotificationRow key={item.id} item={item} onRead={markOneRead} index={i} />
                ))}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        {!loading && items.length > 0 && (
          <>
            <Separator />
            <div className="px-2 pb-2">
              <Link
                href="/notifications"
                className={cn(
                  'flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2.5',
                  'text-sm font-medium text-primary transition-colors hover:bg-primary/8',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                )}
                onClick={() => setOpen(false)}
              >
                {t('viewAll')}
                <ArrowRight className="size-3.5 rtl:rotate-180" />
              </Link>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
