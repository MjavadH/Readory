'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Bell, Inbox, Loader2, Megaphone, Send, Users, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import AdminPageHeader from '@/components/admin/admin-page-header';
import { DateTimePicker } from '@/components/admin/date-time-picker';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { apiClient, getApiErrorMessage } from '@/lib/api-client';
import { useToast } from '@/providers/toast-provider';

type AudienceType = 'ALL_USERS' | 'SELECTED_USERS' | 'USER';

type Broadcast = {
  id: string;
  title: string;
  body?: string | null;
  status: string;
  audienceType: AudienceType;
  processedRecipients: number;
  totalRecipients: number;
  createdAt?: string | null;
  expiresAt?: string | null;
};

type BroadcastListResponse = {
  data: Broadcast[];
  total: number;
  page: number;
  lastPage: number;
};

const MAX_TITLE = 120;
const MAX_BODY = 1000;

const statusBadgeVariant = (
  status: string,
): 'secondary' | 'destructive' | 'outline' | 'default' => {
  const s = status?.toUpperCase();
  if (s === 'PENDING' || s === 'QUEUED') return 'secondary';
  if (s === 'FAILED') return 'destructive';
  if (s === 'SENT' || s === 'COMPLETED') return 'default';
  return 'outline';
};

export default function AdminNotificationsPage() {
  const t = useTranslations('Notifications.AdminPage');
  const locale = useLocale();
  const toast = useToast();

  const [items, setItems] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const limit = 20;

  const [form, setForm] = useState({
    title: '',
    body: '',
    actionUrl: '',
    audienceType: 'ALL_USERS' as AudienceType,
    targetUserIds: '',
    expiresAt: undefined as Date | undefined,
  });

  const formatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    [],
  );

  const parsedIds = useMemo(
    () =>
      Array.from(
        new Set(
          form.targetUserIds
            .split(',')
            .map((v) => Number(v.trim()))
            .filter((v) => Number.isInteger(v) && v > 0),
        ),
      ),
    [form.targetUserIds],
  );

  const load = async (targetPage = page) => {
    setLoading(true);
    try {
      const res = await apiClient.get<BroadcastListResponse>(
        `/notifications/admin/broadcasts?page=${targetPage}&limit=${limit}`,
        { cache: 'no-store' },
      );
      setItems(res.data ?? []);
      setLastPage(res.lastPage ?? 1);
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('Toast.LoadFailed')));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    void apiClient
      .get<BroadcastListResponse>(`/notifications/admin/broadcasts?page=${page}&limit=${limit}`, {
        cache: 'no-store',
      })
      .then((res) => {
        if (cancelled) return;
        setItems(res.data ?? []);
        setLastPage(res.lastPage ?? 1);
      })
      .catch((error) => {
        if (cancelled) return;
        toast.error(getApiErrorMessage(error, t('Toast.LoadFailed')));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [page, t, toast]);

  const reset = () =>
    setForm({
      title: '',
      body: '',
      actionUrl: '',
      audienceType: 'ALL_USERS',
      targetUserIds: '',
      expiresAt: undefined,
    });

  const canSubmit =
    form.title.trim().length > 0 &&
    form.body.trim().length > 0 &&
    (form.audienceType === 'ALL_USERS' ? true : parsedIds.length > 0) &&
    (form.audienceType === 'USER' ? parsedIds.length === 1 : true);

  const submit = async () => {
    if (!canSubmit) {
      toast.error(t('Toast.InvalidForm'));
      return;
    }
    setSaving(true);
    try {
      await apiClient.post('/notifications/admin/broadcasts', {
        title: form.title.trim(),
        body: form.body.trim(),
        ...(form.actionUrl.trim() ? { actionUrl: form.actionUrl.trim() } : {}),
        audienceType: form.audienceType,
        ...(form.audienceType === 'ALL_USERS' ? {} : { targetUserIds: parsedIds }),
        ...(form.expiresAt ? { expiresAt: form.expiresAt.toISOString() } : {}),
        idempotencyKey: crypto.randomUUID(),
      });
      toast.success(t('Toast.Created'));
      reset();
      if (page !== 1) setPage(1);
      else await load(1);
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('Toast.SaveFailed')));
    } finally {
      setSaving(false);
    }
  };

  const statusLabel = (s: string) => {
    const key = `Status.${s}`;
    const translated = t(key as never);
    return translated === key ? s : translated;
  };

  const audienceLabel = (a: AudienceType) => {
    const key = `Form.Audience.${a}`;
    const translated = t(key as never);
    return translated === key ? a : translated;
  };

  const progress = (item: Broadcast) =>
    item.totalRecipients > 0
      ? Math.min(100, Math.round((item.processedRecipients / item.totalRecipients) * 100))
      : 0;

  const ProgressBar = ({ item }: { item: Broadcast }) => (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs text-muted-foreground">
        {item.processedRecipients}/{item.totalRecipients}
      </span>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <motion.div
          className="h-full rounded-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${progress(item)}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-linear-to-br from-muted/30 via-background to-muted/20 pb-20 sm:pb-0">
      <div className="mx-auto max-w-400 space-y-6 p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <AdminPageHeader icon={Bell} title={t('Title')} description={t('Description')} />

        {/* Form Card */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Megaphone className="h-5 w-5 text-primary" />
                {t('Form.CreateTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="broadcast-title">{t('Form.TitleLabel')}</Label>
                  <Input
                    id="broadcast-title"
                    value={form.title}
                    maxLength={MAX_TITLE}
                    placeholder={t('Form.TitlePlaceholder')}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    {form.title.length}/{MAX_TITLE}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label>{t('Form.AudienceLabel')}</Label>
                  <Select
                    value={form.audienceType}
                    onValueChange={(v) =>
                      setForm({ ...form, audienceType: v as AudienceType, targetUserIds: '' })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL_USERS">{t('Form.Audience.ALL_USERS')}</SelectItem>
                      <SelectItem value="SELECTED_USERS">
                        {t('Form.Audience.SELECTED_USERS')}
                      </SelectItem>
                      <SelectItem value="USER">{t('Form.Audience.USER')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>{t('Form.ExpiresAt')}</Label>
                  <DateTimePicker
                    showTime
                    locale={locale}
                    min={new Date()}
                    value={form.expiresAt}
                    placeholder={t('Form.ExpiresAtPlaceholder')}
                    onChange={(date) => setForm({ ...form, expiresAt: date })}
                    className="w-full"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="broadcast-body">{t('Form.BodyLabel')}</Label>
                <Textarea
                  id="broadcast-body"
                  value={form.body}
                  maxLength={MAX_BODY}
                  rows={4}
                  placeholder={t('Form.BodyPlaceholder')}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  {form.body.length}/{MAX_BODY}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="broadcast-action">{t('Form.ActionUrl')}</Label>
                  <Input
                    id="broadcast-action"
                    dir="ltr"
                    value={form.actionUrl}
                    maxLength={512}
                    placeholder="/collections/..."
                    onChange={(e) => setForm({ ...form, actionUrl: e.target.value })}
                  />
                </div>

                <AnimatePresence initial={false} mode="wait">
                  {form.audienceType !== 'ALL_USERS' && (
                    <motion.div
                      key="ids"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.18 }}
                      className="space-y-1.5"
                    >
                      <Label htmlFor="broadcast-ids">{t('Form.TargetUserIds')}</Label>
                      <Input
                        id="broadcast-ids"
                        dir="ltr"
                        value={form.targetUserIds}
                        placeholder="12, 34, 56"
                        onChange={(e) => setForm({ ...form, targetUserIds: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">
                        {t('Form.SelectedCount', { count: parsedIds.length })}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Summary + actions */}
              <div className="flex flex-col gap-3 rounded-lg border border-border/70 bg-muted/30 p-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4 shrink-0 text-primary" />
                  <span className="truncate">
                    {form.audienceType === 'ALL_USERS'
                      ? t('Form.Audience.ALL_USERS')
                      : t('Form.SelectedCount', { count: parsedIds.length })}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:ms-auto sm:flex">
                  <Button onClick={submit} disabled={saving || !canSubmit}>
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    <span className="ms-2">{t('Form.Submit')}</span>
                  </Button>
                  <Button variant="outline" onClick={reset} disabled={saving}>
                    <X className="h-4 w-4" />
                    <span className="ms-2">{t('Form.Clear')}</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* History Card */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.05 }}
        >
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Bell className="h-5 w-5 text-primary" />
                {t('List.Title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 sm:p-6 sm:pt-0">
              {loading && (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('List.Loading')}
                </div>
              )}

              {!loading && items.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                  <Inbox className="h-8 w-8 opacity-60" />
                  {t('List.Empty')}
                </div>
              )}

              {/* Desktop table */}
              {!loading && items.length > 0 && (
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-start">{t('List.Content')}</TableHead>
                        <TableHead className="text-start">{t('List.Audience')}</TableHead>
                        <TableHead className="text-start">{t('List.Status')}</TableHead>
                        <TableHead className="text-start">{t('List.Progress')}</TableHead>
                        <TableHead className="text-start">{t('List.CreatedAt')}</TableHead>
                        <TableHead className="text-start">{t('List.ExpiresAt')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <AnimatePresence initial={false}>
                        {items.map((item) => (
                          <motion.tr
                            key={item.id}
                            layout
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.18 }}
                            className="border-b transition-colors hover:bg-muted/40"
                          >
                            <TableCell>
                              <div className="flex min-w-0 flex-col">
                                <span className="w-68 truncate font-medium">{item.title}</span>
                                <span className="w-68 truncate text-xs text-muted-foreground">
                                  {item.body}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>{audienceLabel(item.audienceType)}</TableCell>
                            <TableCell>
                              <Badge variant={statusBadgeVariant(item.status)}>
                                {statusLabel(item.status)}
                              </Badge>
                            </TableCell>
                            <TableCell className="w-48">
                              <ProgressBar item={item} />
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {item.createdAt ? formatter.format(new Date(item.createdAt)) : '—'}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {item.expiresAt
                                ? formatter.format(new Date(item.expiresAt))
                                : t('List.NoExpiry')}
                            </TableCell>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Mobile / tablet cards */}
              {!loading && items.length > 0 && (
                <ul className="flex flex-col gap-3 p-3 md:hidden">
                  <AnimatePresence initial={false}>
                    {items.map((item) => (
                      <motion.li
                        key={item.id}
                        layout
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className="rounded-lg border border-border/70 bg-card p-3 shadow-xs"
                      >
                        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{item.title}</p>
                            <p className="line-clamp-2 text-xs text-muted-foreground">
                              {item.body}
                            </p>
                          </div>
                          <Badge variant={statusBadgeVariant(item.status)} className="shrink-0">
                            {statusLabel(item.status)}
                          </Badge>
                        </div>

                        <div className="mt-3 space-y-2">
                          <ProgressBar item={item} />
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span>{audienceLabel(item.audienceType)}</span>
                            <span>
                              {item.createdAt ? formatter.format(new Date(item.createdAt)) : '—'}
                            </span>
                          </div>
                        </div>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}

              {/* Pagination */}
              {!loading && lastPage > 1 && (
                <div className="flex items-center justify-between gap-2 border-t p-3 sm:mt-4 sm:px-0 sm:pb-0">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    {t('List.Previous')}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {t('List.PageOf', { page, lastPage })}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= lastPage}
                    onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
                  >
                    {t('List.Next')}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
