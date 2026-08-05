'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  CalendarClock,
  Check,
  FileText,
  Loader2,
  Pencil,
  Send,
  X,
  Inbox,
} from 'lucide-react';
import { apiClient, getApiErrorMessage } from '@/lib/api-client';
import { useToast } from '@/providers/toast-provider';
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
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { BookPicker } from '@/components/admin/book-picker';
import type { BookCardData } from '@/lib/types';
import { ChapterPicker, type ChapterItemData } from '@/components/admin/chapter-picker';
import { useTranslations } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import DateTimePicker from '@/components/admin/date-time-picker';

type TargetType = 'BOOK' | 'Chapter';

type Schedule = {
  id: number;
  targetType: TargetType;
  targetId: number;
  targetName: string;
  publishAt: string;
  status: string;
  retryCount: number;
  maxRetries: number;
  lastAttemptAt?: string | null;
  error?: string | null;
};

type BookData = {
  books: BookCardData[];
  hasMore: boolean;
  stats: {
    total: number;
    Published: number;
    Drafts: number;
  };
  page: number;
  limit: number;
};

const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
};

const statusBadgeVariant = (
  status: string,
): 'secondary' | 'destructive' | 'outline' | 'default' => {
  if (status === 'Pending') return 'secondary';
  if (status === 'FAILED') return 'destructive';
  return 'outline';
};

export default function ScheduledPublicationsPage() {
  const t = useTranslations('AdminPage.ScheduledPublications');
  const toast = useToast();
  const [items, setItems] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    targetType: 'BOOK' as TargetType,
    targetId: '',
    publishAt: '',
    maxRetries: '3',
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

  // Book Picker
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [draftBooks, setDraftBooks] = useState<BookCardData[]>([]);
  const [bookSearch, setBookSearch] = useState('');
  const [bookPage, setBookPage] = useState(1);
  const [bookTotalItems, setBookTotalItems] = useState(0);
  const [bookTotalPages, setBookTotalPages] = useState(1);
  const [isFetchingBooks, setIsFetchingBooks] = useState(false);
  const limit = 18;

  // Chapter Picker
  const [isBookForChapter, setIsBookForChapter] = useState(false);
  const [selectedBookForChapterId, setSelectedBookForChapterId] = useState<number | null>(null);

  const [isChapterPickerOpen, setIsChapterPickerOpen] = useState(false);
  const [draftChapters, setDraftChapters] = useState<ChapterItemData[]>([]);
  const [chapterSearch, setChapterSearch] = useState('');
  const [chapterPage, setChapterPage] = useState(1);
  const [chapterTotalItems, setChapterTotalItems] = useState(0);
  const [chapterTotalPages, setChapterTotalPages] = useState(1);
  const [isFetchingChapters, setIsFetchingChapters] = useState(false);

  useEffect(() => {
    if (!isChapterPickerOpen || !selectedBookForChapterId) return;

    const fetchChapters = async () => {
      setIsFetchingChapters(true);
      try {
        const res: any = await apiClient.get(
          `/books/${selectedBookForChapterId}/chapters/admin?publishStatus=DRAFT&page=${chapterPage}&limit=50&q=${chapterSearch}`,
        );
        const data = res.data || res;

        setDraftChapters(data.items || []);
        setChapterTotalItems(data.pagination?.total || 0);
        setChapterTotalPages(data.pagination?.totalPages || 1);
      } catch (e) {
        toast.error(getApiErrorMessage(e, t('Toast.LoadChaptersFailed')));
      } finally {
        setIsFetchingChapters(false);
      }
    };

    const timer = setTimeout(fetchChapters, 300);
    return () => clearTimeout(timer);
  }, [isChapterPickerOpen, chapterPage, chapterSearch, selectedBookForChapterId]);

  useEffect(() => {
    if (!isPickerOpen) return;

    const fetchBooks = async () => {
      setIsFetchingBooks(true);
      try {
        const statusFilter = isBookForChapter ? 'published' : 'draft';
        const res = await apiClient.get<BookData>(
          `/books/allBooks?status=${statusFilter}&page=${bookPage}&limit=${limit}&q=${bookSearch}`,
        );

        setDraftBooks(res.books);
        const total = isBookForChapter ? res.stats.Published : res.stats.Drafts;
        setBookTotalItems(total);
        setBookTotalPages(Math.ceil(total / limit));
      } catch (e) {
        toast.error(getApiErrorMessage(e, t('Toast.LoadBooksFailed')));
      } finally {
        setIsFetchingBooks(false);
      }
    };

    const timer = setTimeout(fetchBooks, 300);
    return () => clearTimeout(timer);
  }, [isPickerOpen, bookPage, bookSearch, isBookForChapter]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<{ data: Schedule[] }>('/scheduled-publications');
      setItems(res.data);
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('Toast.LoadFailed')));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const reset = () => {
    setEditingId(null);
    setForm({ targetType: 'BOOK', targetId: '', publishAt: '', maxRetries: '3' });
    setSelectedBookForChapterId(null);
  };

  const submit = async () => {
    setSaving(true);
    try {
      const body = {
        ...form,
        targetId: Number(form.targetId),
        publishAt: new Date(form.publishAt).toISOString(),
        maxRetries: Number(form.maxRetries),
      };
      if (editingId) await apiClient.patch(`/scheduled-publications/${editingId}`, body);
      else await apiClient.post('/scheduled-publications', body);
      toast.success(editingId ? t('Toast.Updated') : t('Toast.Created'));
      reset();
      await load();
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('Toast.SaveFailed')));
    } finally {
      setSaving(false);
    }
  };

  const action = async (id: number, path: 'cancel' | 'publish-now') => {
    try {
      await apiClient.post(`/scheduled-publications/${id}/${path}`);
      toast.success(path === 'cancel' ? t('Toast.Cancelled') : t('Toast.PublishedNow'));
      await load();
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('Toast.ActionFailed')));
    }
  };

  // Derived: currently selected target label (from picker caches, no new fetch)
  const selectedTargetLabel = useMemo(() => {
    const id = Number(form.targetId);
    if (!id) return null;
    if (form.targetType === 'BOOK') {
      const b = draftBooks.find((x) => x.id === id);
      return b
        ? { name: (b as any).title ?? (b as any).name ?? `#${id}`, id }
        : { name: `#${id}`, id };
    }
    const c = draftChapters.find((x) => x.id === id);
    return c
      ? { name: (c as any).title ?? (c as any).name ?? `#${id}`, id }
      : { name: `#${id}`, id };
  }, [form.targetId, form.targetType, draftBooks, draftChapters]);

  const statusLabel = (s: string) => {
    const key = `Status.${s}`;
    const translated = t(key as any);
    return translated === key ? s : translated;
  };

  const renderActions = (item: Schedule, size: 'sm' | 'default' = 'sm', full = false) => (
    <div className={full ? 'grid grid-cols-1 gap-2' : 'flex justify-end gap-2'}>
      <Button
        size={size}
        variant="outline"
        className={full ? 'w-full' : ''}
        onClick={() => {
          setEditingId(item.id);
          setForm({
            targetType: item.targetType,
            targetId: String(item.targetId),
            publishAt: toLocalInput(item.publishAt),
            maxRetries: String(item.maxRetries),
          });
        }}
        disabled={item.status !== 'Pending'}
        title={t('Form.EditTitle')}
        aria-label={t('Form.EditTitle')}
      >
        <Pencil className="h-4 w-4" />
        {full && <span className="ms-1">{t('Form.EditTitle')}</span>}
      </Button>
      <Button
        size={size}
        variant="outline"
        className={full ? 'w-full' : ''}
        onClick={() => action(item.id, 'publish-now')}
        disabled={item.status !== 'Pending'}
        title={t('Toast.PublishedNow')}
        aria-label={t('Toast.PublishedNow')}
      >
        <Send className="h-4 w-4" />
        {full && <span className="ms-1">{t('Toast.PublishedNow')}</span>}
      </Button>
      <Button
        size={size}
        variant="destructive"
        className={full ? 'w-full' : ''}
        onClick={() => action(item.id, 'cancel')}
        disabled={!['Pending', 'FAILED'].includes(item.status)}
        title={t('Toast.Cancelled')}
        aria-label={t('Toast.Cancelled')}
      >
        <X className="h-4 w-4" />
        {full && <span className="ms-1">{t('Toast.Cancelled')}</span>}
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-linear-to-br from-muted/30 via-background to-muted/20 pb-20 sm:pb-0">
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-400 mx-auto">
        <motion.div
          className="space-y-1"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <h1 className="bg-linear-to-r from-foreground to-foreground/70 bg-clip-text text-2xl font-bold tracking-tight text-transparent sm:text-3xl lg:text-4xl">
            {t('Title')}
          </h1>
          <p className="text-sm text-muted-foreground sm:text-base">{t('Description')}</p>
        </motion.div>

        {/* Form Card */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <CalendarClock className="h-5 w-5 text-primary" />
                {editingId ? t('Form.EditTitle') : t('Form.CreateTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {/* Type */}
                <div className="space-y-1.5">
                  <Label>{t('Form.Type')}</Label>
                  <Select
                    value={form.targetType}
                    onValueChange={(v) => {
                      setForm({ ...form, targetType: v as TargetType, targetId: '' });
                      setSelectedBookForChapterId(null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BOOK">{t('Form.TargetType.Book')}</SelectItem>
                      <SelectItem value="Chapter">{t('Form.TargetType.Chapter')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Publish Date */}
                <div className="space-y-1.5">
                  <Label>{t('Form.PublishDate')}</Label>
                  <DateTimePicker
                    onChange={(e) => setForm({ ...form, publishAt: e.toString() })}
                    showTime={true}
                    placeholder={'Pick a date & time'}
                  />
                </div>

                {/* Max Retries */}
                <div className="space-y-1.5">
                  <Label>{t('Form.MaxRetries')}</Label>
                  <Input
                    type="number"
                    min={0}
                    max={10}
                    value={form.maxRetries}
                    onChange={(e) => setForm({ ...form, maxRetries: e.target.value })}
                  />
                </div>

                {/* Save */}
                <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-1">
                  <Button
                    onClick={submit}
                    disabled={saving || !form.targetId || !form.publishAt}
                    className="flex-1"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    <span className="ms-2">{t('Form.Save')}</span>
                  </Button>
                  {editingId && (
                    <Button variant="outline" onClick={reset}>
                      {t('Form.CancelEdit')}
                    </Button>
                  )}
                </div>
              </div>

              {/* Target selector row */}
              <div className="space-y-1.5">
                <Label>{t('Form.Target')}</Label>
                <div className="flex flex-col gap-2 rounded-lg border border-border/70 bg-muted/30 p-3 sm:flex-row sm:items-center">
                  <div className="flex flex-wrap gap-2">
                    {!editingId && form.targetType === 'BOOK' && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setIsBookForChapter(false);
                          setIsPickerOpen(true);
                        }}
                      >
                        <BookOpen className="h-4 w-4" />
                        <span className="ms-2">{t('Form.SelectBook')}</span>
                      </Button>
                    )}

                    {!editingId && form.targetType === 'Chapter' && (
                      <>
                        <Button
                          type="button"
                          variant={selectedBookForChapterId ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => {
                            setIsBookForChapter(true);
                            setIsPickerOpen(true);
                          }}
                        >
                          <BookOpen className="h-4 w-4" />
                          <span className="ms-2">{t('Form.SelectBook')}</span>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!selectedBookForChapterId}
                          onClick={() => setIsChapterPickerOpen(true)}
                        >
                          <FileText className="h-4 w-4" />
                          <span className="ms-2">{t('Form.SelectChapter')}</span>
                        </Button>
                      </>
                    )}
                  </div>

                  <div className="sm:ms-auto">
                    <AnimatePresence mode="wait" initial={false}>
                      {selectedTargetLabel ? (
                        <motion.div
                          key={`sel-${selectedTargetLabel.id}`}
                          initial={{ opacity: 0, scale: 0.96 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.96 }}
                          transition={{ duration: 0.18 }}
                          className="inline-flex max-w-full items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                        >
                          <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="truncate">{selectedTargetLabel.name}</span>
                          <span className="text-xs text-muted-foreground shrink-0">
                            #{selectedTargetLabel.id}
                          </span>
                        </motion.div>
                      ) : (
                        <motion.span
                          key="empty"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className="text-sm text-muted-foreground"
                        >
                          {t('Form.NotSelected')}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Management Card */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.05 }}
        >
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base sm:text-lg">{t('List.Title')}</CardTitle>
            </CardHeader>
            <CardContent className="p-0 sm:p-6 sm:pt-0">
              {/* Loading */}
              {loading && (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('List.Loading')}
                </div>
              )}

              {/* Empty */}
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
                        <TableHead className="text-start">{t('List.Type')}</TableHead>
                        <TableHead className="text-start">{t('List.PublishDate')}</TableHead>
                        <TableHead className="text-start">{t('List.Status')}</TableHead>
                        <TableHead className="text-start">{t('List.Retry')}</TableHead>
                        <TableHead className="text-start">{t('List.Error')}</TableHead>
                        <TableHead className="text-end">{t('List.Actions')}</TableHead>
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
                              <div className="flex flex-col">
                                <span className="font-medium truncate w-68">{item.targetName}</span>
                                <span className="text-xs text-muted-foreground">
                                  #{item.targetId}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {item.targetType === 'BOOK'
                                ? t('Form.TargetType.Book')
                                : t('Form.TargetType.Chapter')}
                            </TableCell>
                            <TableCell>{formatter.format(new Date(item.publishAt))}</TableCell>
                            <TableCell>
                              <Badge variant={statusBadgeVariant(item.status)}>
                                {statusLabel(item.status)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span>
                                  {item.retryCount}/{item.maxRetries}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {item.lastAttemptAt
                                    ? formatter.format(new Date(item.lastAttemptAt))
                                    : t('List.NoAttempts')}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="max-w-xs truncate text-muted-foreground">
                              {item.error || t('List.NoError')}
                            </TableCell>
                            <TableCell>{renderActions(item, 'sm', false)}</TableCell>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Mobile cards */}
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
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{item.targetName}</p>
                            <p className="text-xs text-muted-foreground">
                              #{item.targetId} ·{' '}
                              {item.targetType === 'BOOK'
                                ? t('Form.TargetType.Book')
                                : t('Form.TargetType.Chapter')}
                            </p>
                          </div>
                          <Badge variant={statusBadgeVariant(item.status)} className="shrink-0">
                            {statusLabel(item.status)}
                          </Badge>
                        </div>

                        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                          <div className="min-w-0">
                            <dt className="text-muted-foreground">{t('List.PublishDate')}</dt>
                            <dd className="truncate">
                              {formatter.format(new Date(item.publishAt))}
                            </dd>
                          </div>
                          <div className="min-w-0">
                            <dt className="text-muted-foreground">{t('List.Retry')}</dt>
                            <dd className="truncate">
                              {item.retryCount}/{item.maxRetries}
                              <span className="ms-1 text-muted-foreground">
                                (
                                {item.lastAttemptAt
                                  ? formatter.format(new Date(item.lastAttemptAt))
                                  : t('List.NoAttempts')}
                                )
                              </span>
                            </dd>
                          </div>
                          {item.error && (
                            <div className="col-span-2 min-w-0">
                              <dt className="text-muted-foreground">{t('List.Error')}</dt>
                              <dd className="truncate text-destructive">{item.error}</dd>
                            </div>
                          )}
                        </dl>

                        <div className="mt-3">{renderActions(item, 'sm', true)}</div>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Book Picker */}
      <BookPicker
        open={isPickerOpen}
        onOpenChange={setIsPickerOpen}
        books={draftBooks}
        value={isBookForChapter ? selectedBookForChapterId : Number(form.targetId) || null}
        onSelect={(book) => {
          if (book) {
            if (isBookForChapter) {
              setSelectedBookForChapterId(book.id);
              setForm({ ...form, targetId: '' });
            } else {
              setForm({ ...form, targetId: String(book.id) });
            }
          }
        }}
        isLoading={isFetchingBooks}
        title={
          isBookForChapter ? t('Picker.SelectBookForChapters') : t('Picker.SelectBookForPublishing')
        }
        searchQuery={bookSearch}
        onSearchChange={(q) => {
          setBookSearch(q);
          setBookPage(1);
        }}
        page={bookPage}
        onPageChange={setBookPage}
        totalItems={bookTotalItems}
        totalPages={bookTotalPages}
        limit={limit}
      />

      {/* Chapter Picker */}
      <ChapterPicker
        open={isChapterPickerOpen}
        onOpenChange={setIsChapterPickerOpen}
        chapters={draftChapters}
        value={Number(form.targetId) || null}
        onSelect={(chapter) => {
          if (chapter) {
            setForm({ ...form, targetId: String(chapter.id) });
          }
        }}
        isLoading={isFetchingChapters}
        searchQuery={chapterSearch}
        onSearchChange={(q) => {
          setChapterSearch(q);
          setChapterPage(1);
        }}
        page={chapterPage}
        onPageChange={setChapterPage}
        totalItems={chapterTotalItems}
        totalPages={chapterTotalPages}
      />
    </div>
  );
}
