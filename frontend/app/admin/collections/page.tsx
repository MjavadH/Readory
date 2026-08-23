'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  BookOpen,
  Eye,
  EyeOff,
  Grid2X2,
  Layers,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import AdminPageHeader from '@/components/admin/admin-page-header';
import { StatCard } from '@/components/admin/stat-card';
import { CollectionFormFields } from '@/components/collections/collection-form-fields';
import { ResponsiveModal } from '@/components/responsive-modal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient, getApiErrorMessage } from '@/lib/api-client';
import {
  COLLECTION_SLUG_REGEX,
  type Collection,
  type CollectionFormState,
  collectionToForm,
  emptyCollectionForm,
} from '@/lib/collection-types';
import { getBookCoverThumbnailUrl } from '@/lib/media';
import { cn } from '@/lib/utils';
import { useToast } from '@/providers/toast-provider';

export default function AdminCollectionsPage() {
  const t = useTranslations('Collections');
  const toast = useToast();

  const [collections, setCollections] = React.useState<Collection[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [nextCursor, setNextCursor] = React.useState<string | undefined>();
  const [hasMore, setHasMore] = React.useState(false);
  const loadMoreRef = React.useRef<HTMLDivElement>(null);
  const [search, setSearch] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);
  const [pendingId, setPendingId] = React.useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Collection | null>(null);

  const [modalOpen, setModalOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Collection | null>(null);
  const [form, setForm] = React.useState<CollectionFormState>(emptyCollectionForm);

  const requestCollections = React.useCallback(async () => {
    return apiClient.get<{
      items: Collection[];
      nextCursor?: string;
      hasMore?: boolean;
    }>('/collections/admin?limit=24', { authRequired: true });
  }, []);

  const load = React.useCallback(async () => {
    setIsLoading(true);

    try {
      const res = await requestCollections();
      setCollections(res.items ?? []);
      setNextCursor(res.nextCursor);
      setHasMore(Boolean(res.hasMore));
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('Toast.LoadFailed')));
    } finally {
      setIsLoading(false);
    }
  }, [requestCollections, t, toast]);

  React.useEffect(() => {
    let cancelled = false;

    void requestCollections()
      .then((res) => {
        if (cancelled) return;
        setCollections(res.items ?? []);
        setNextCursor(res.nextCursor);
        setHasMore(Boolean(res.hasMore));
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(getApiErrorMessage(error, t('Toast.LoadFailed')));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [requestCollections, t, toast]);

  const loadMore = React.useCallback(async () => {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const res = await apiClient.get<{
        items: Collection[];
        nextCursor?: string;
        hasMore?: boolean;
      }>(`/collections/admin?limit=24&cursor=${encodeURIComponent(nextCursor)}`, {
        authRequired: true,
      });
      setCollections((prev) => [...prev, ...(res.items ?? [])]);
      setNextCursor(res.nextCursor);
      setHasMore(Boolean(res.hasMore));
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('Toast.LoadFailed')));
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, nextCursor, t, toast]);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !search.trim()) void loadMore();
      },
      { threshold: 0.1, rootMargin: '100px' },
    );
    if (loadMoreRef.current) observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadMore, search]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return collections;
    return collections.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q) ||
        (c.description ?? '').toLowerCase().includes(q),
    );
  }, [collections, search]);

  const stats = React.useMemo(() => {
    const total = collections.length;
    const featured = collections.filter((c) => c.featured).length;
    const published = collections.filter((c) => c.visibility === 'PUBLIC').length;
    const privateCollection = collections.filter((c) => c.visibility === 'PRIVATE').length;
    return { total, featured, published, privateCollection };
  }, [collections]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyCollectionForm);
    setModalOpen(true);
  };

  const openEdit = (collection: Collection) => {
    setEditing(collection);
    setForm(collectionToForm(collection));
    setModalOpen(true);
  };

  const save = async () => {
    const slug = form.slug.trim();
    if (!form.title.trim()) {
      toast.error(t('Toast.TitleRequired'));
      return;
    }
    if (!slug) {
      toast.error(t('Toast.SlugRequired'));
      return;
    }
    if (!COLLECTION_SLUG_REGEX.test(slug)) {
      toast.error(t('Toast.SlugInvalid'));
      return;
    }
    setIsSaving(true);
    try {
      const body = {
        title: form.title.trim(),
        slug,
        description: form.description.trim() || undefined,
        featured: form.featured,
        visibility: form.visibility,
        allowIndexing: form.allowIndexing,
      };
      if (editing) await apiClient.patch(`/collections/${editing.id}`, body);
      else await apiClient.post('/collections/system', body);
      toast.success(editing ? t('Toast.Updated') : t('Toast.Created'));
      setModalOpen(false);
      await load();
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('Toast.SaveFailed')));
    } finally {
      setIsSaving(false);
    }
  };

  const toggleFeatured = async (collection: Collection) => {
    setPendingId(collection.id);
    try {
      await apiClient.patch(`/collections/${collection.id}`, { featured: !collection.featured });
      await load();
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('Toast.SaveFailed')));
    } finally {
      setPendingId(null);
    }
  };

  const toggleVisibility = async (collection: Collection) => {
    const next = collection.visibility === 'PUBLIC' ? 'PRIVATE' : 'PUBLIC';
    setPendingId(collection.id);
    try {
      await apiClient.patch(`/collections/${collection.id}`, { visibility: next });
      toast.success(next === 'PUBLIC' ? t('Toast.MadePublic') : t('Toast.MadePrivate'));
      await load();
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('Toast.SaveFailed')));
    } finally {
      setPendingId(null);
    }
  };

  const remove = async (collection: Collection) => {
    setPendingId(collection.id);
    try {
      await apiClient.delete(`/collections/${collection.id}`);
      toast.success(t('Toast.Deleted'));
      setDeleteTarget(null);
      await load();
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('Toast.DeleteFailed')));
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 pb-20 sm:pb-6">
      {/* header */}
      <AdminPageHeader
        icon={Grid2X2}
        title={t('AdminTitle')}
        description={t('AdminSubtitle')}
        className="mb-5"
        actions={
          <Button onClick={openCreate} className="w-full gap-1.5 sm:w-auto">
            <Plus className="h-4 w-4" />
            {t('Actions.NewCollection')}
          </Button>
        }
      />

      {/* stats */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))
        ) : (
          <>
            <StatCard
              index={0}
              icon={Layers}
              title={t('Stats.Total')}
              value={String(stats.total)}
              hint={t('Stats.TotalHint')}
            />
            <StatCard
              index={1}
              icon={Eye}
              accent="emerald"
              title={t('Stats.Public')}
              value={String(stats.published)}
              hint={t('Stats.PublicHint')}
            />
            <StatCard
              index={2}
              icon={EyeOff}
              accent="rose"
              title={t('Stats.Private')}
              value={String(stats.privateCollection)}
              hint={t('Stats.PrivateHint')}
            />
            <StatCard
              index={3}
              icon={Sparkles}
              accent="amber"
              title={t('Stats.Featured')}
              value={String(stats.featured)}
              hint={t('Stats.FeaturedHint')}
            />
          </>
        )}
      </div>

      {/* search */}
      <div className="relative mb-4">
        <Search className="absolute top-1/2 size-4 -translate-y-1/2 text-muted-foreground ltr:left-3 rtl:right-3" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('SearchPlaceholder')}
          className="h-10 bg-muted/40 ps-9 text-start focus-visible:bg-background"
        />
      </div>

      {/* list */}
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-muted">
            <Layers className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">{t('Empty.Title')}</p>
          <p className="max-w-xs px-6 text-xs text-muted-foreground">{t('Empty.Hint')}</p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <AnimatePresence initial={false}>
              {filtered.map((collection, index) => (
                <motion.div
                  key={collection.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.25, delay: Math.min(index, 8) * 0.03 }}
                  className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-3 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <MiniCovers collection={collection} />

                    <div className="min-w-0 flex-1 text-start">
                      <Link
                        href={`/admin/collections/${collection.id}`}
                        className="line-clamp-1 text-sm font-semibold outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                        dir="auto"
                      >
                        {collection.title}
                      </Link>
                      {collection.description && (
                        <p
                          dir="auto"
                          className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground"
                        >
                          {collection.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="secondary" className="gap-1 rounded-full text-[10px]">
                      <BookOpen className="h-3 w-3" />
                      {collection.bookCount}
                    </Badge>
                    {collection.featured && (
                      <Badge className="gap-1 rounded-full text-[10px]">
                        <Sparkles className="h-3 w-3" />
                        {t('Featured')}
                      </Badge>
                    )}
                    <Badge
                      variant={collection.visibility === 'PUBLIC' ? 'secondary' : 'outline'}
                      className="gap-1 rounded-full text-[10px]"
                    >
                      {collection.visibility === 'PUBLIC' ? (
                        <Eye className="h-3 w-3" />
                      ) : (
                        <EyeOff className="h-3 w-3" />
                      )}
                      {t(`Visibility.${collection.visibility}` as never)}
                    </Badge>
                    {collection.locked && (
                      <Badge variant="outline" className="gap-1 rounded-full text-[10px]">
                        <Lock className="h-3 w-3" />
                        {t('Locked')}
                      </Badge>
                    )}
                  </div>

                  <div className="mt-auto flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-2.5">
                    <Button asChild size="sm" variant="secondary" className="h-8 flex-1 text-xs">
                      <Link href={`/admin/collections/${collection.id}`}>
                        {t('Actions.ManageBooks')}
                      </Link>
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      aria-label={t('Actions.Edit')}
                      disabled={pendingId === collection.id}
                      onClick={() => openEdit(collection)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className={cn(
                        'h-8 w-8',
                        collection.featured && 'text-amber-500 hover:text-amber-500',
                      )}
                      aria-label={t('Actions.ToggleFeatured')}
                      disabled={pendingId === collection.id}
                      onClick={() => void toggleFeatured(collection)}
                    >
                      <Sparkles className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      aria-label={t('Actions.ToggleVisibility')}
                      disabled={pendingId === collection.id}
                      onClick={() => void toggleVisibility(collection)}
                    >
                      {collection.visibility === 'PUBLIC' ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      aria-label={t('Actions.Delete')}
                      disabled={pendingId === collection.id || collection.locked}
                      onClick={() => setDeleteTarget(collection)}
                    >
                      {pendingId === collection.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          {hasMore && !search.trim() && (
            <div ref={loadMoreRef} className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {isLoadingMore &&
                Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-40 w-full rounded-2xl" />
                ))}
            </div>
          )}
        </>
      )}

      {/* Drawer on mobile, Dialog on tablet/desktop */}
      <ResponsiveModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editing ? t('EditCollection') : t('NewCollection')}
        description={editing ? t('EditCollectionHint') : t('NewCollectionHint')}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={isSaving}>
              {t('Actions.Cancel')}
            </Button>
            <Button onClick={save} disabled={isSaving} className="gap-1.5">
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? t('Actions.Save') : t('Actions.Create')}
            </Button>
          </div>
        }
      >
        <CollectionFormFields value={form} onChange={setForm} isSystem />
      </ResponsiveModal>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('DeleteCollectionTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? t('DeleteCollectionDescription', { title: deleteTarget.title })
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(deleteTarget && pendingId === deleteTarget.id)}>
              {t('Actions.Cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={Boolean(deleteTarget && pendingId === deleteTarget.id)}
              onClick={(event) => {
                event.preventDefault();
                if (deleteTarget) void remove(deleteTarget);
              }}
            >
              {deleteTarget && pendingId === deleteTarget.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t('Actions.Delete')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MiniCovers({ collection }: { collection: Collection }) {
  const covers = (collection.items ?? [])
    .slice(0, 4)
    .map((item) => item.book?.coverImage)
    .filter(Boolean) as string[];

  if (covers.length === 0) {
    return (
      <div className="grid h-18 w-12 shrink-0 place-items-center rounded-lg bg-muted">
        <Layers className="h-4 w-4 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-18 shrink-0 items-center -space-x-2 rtl:space-x-reverse">
      {covers.map((cover, index) => (
        <div
          key={`${cover}-${index}`}
          className="h-18 w-12 overflow-hidden rounded-lg bg-muted ring-2 ring-card"
          style={{ zIndex: covers.length - index }}
        >
          <Image
            src={getBookCoverThumbnailUrl(cover)}
            alt=""
            loading="lazy"
            width={55}
            height={75}
            className="h-full w-full object-cover"
          />
        </div>
      ))}
    </div>
  );
}
