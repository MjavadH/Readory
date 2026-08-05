'use client';
import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import type { NotificationApiItem } from '@readory/shared';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { formatUpdateTime } from '@/lib/time';
import { useTranslations } from 'next-intl';
export default function NotificationsPage() {
  const ti = useTranslations('Time');
  const [items, setItems] = useState<NotificationApiItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const load = async (next?: string | null) => {
    const res = await apiClient.get<{ items: NotificationApiItem[]; nextCursor: string | null }>(
      '/notifications',
      { query: { limit: 20, cursor: next ?? undefined }, cache: 'no-store' },
    );
    setItems((prev) => (next ? [...prev, ...res.items] : res.items));
    setCursor(res.nextCursor);
  };
  useEffect(() => {
    void load();
  }, []);
  const markAll = async () => {
    await apiClient.patch('/notifications/read', {});
    await load();
  };
  return (
    <main className="container mx-auto max-w-3xl space-y-4 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Notifications</h1>
        <Button onClick={markAll}>Mark all as read</Button>
      </div>
      {items.length === 0 ? (
        <div className="rounded-2xl border p-10 text-center text-muted-foreground">
          You are all caught up.
        </div>
      ) : (
        items.map((n) => (
          <Link
            href={n.actionUrl || '#'}
            key={n.id}
            className="block rounded-2xl border p-4 hover:bg-accent"
          >
            <div className="flex gap-3">
              <span
                className={
                  n.readAt
                    ? 'mt-2 h-2 w-2 rounded-full bg-muted'
                    : 'mt-2 h-2 w-2 rounded-full bg-primary'
                }
              />
              <div>
                <h2 className="font-semibold">{n.title}</h2>
                <p className="text-sm text-muted-foreground">{n.body}</p>
                <time className="text-xs text-muted-foreground">
                  {formatUpdateTime(n.createdAt, ti)}
                </time>
              </div>
            </div>
          </Link>
        ))
      )}
      {cursor && (
        <Button variant="outline" onClick={() => load(cursor)} className="w-full">
          Load more
        </Button>
      )}
    </main>
  );
}
