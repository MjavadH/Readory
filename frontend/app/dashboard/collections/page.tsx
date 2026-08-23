'use client';

import * as React from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  FolderPlus,
  Grid2X2,
  Loader2,
  Pencil,
  Trash2,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
import { CollectionFormFields } from '@/components/collections/collection-form-fields';
import { CollectionCover } from '@/components/collections/collection-cover';
import { CollectionVisibilityBadge } from '@/components/collections/collection-visibility-badge';
import { apiClient, getApiErrorMessage } from '@/lib/api-client';
import {
  collectionToForm,
  emptyCollectionForm,
  type Collection,
  COLLECTION_SLUG_REGEX,
  type CollectionFormState,
} from '@/lib/collection-types';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useToast } from '@/providers/toast-provider';
import { ResponsiveModal } from '@/components/responsive-modal';

/** User collections are never indexable — visibility is the only switch. */
const userDefaults: CollectionFormState = {
  ...emptyCollectionForm,
  visibility: 'PRIVATE',
  allowIndexing: false,
};

export default function DashboardCollectionsPage() {
  const t = useTranslations('Collections');
  const userDashboardT = useTranslations('UserDashboard');
  const toast = useToast();
  const { user } = useCurrentUser();

  const [collections, setCollections] = React.useState<Collection[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Collection | null>(null);
  const [form, setForm] = React.useState<CollectionFormState>(userDefaults);
  const [saving, setSaving] = React.useState(false);
  const [pendingDelete, setPendingDelete] = React.useState<Collection | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const loadCollections = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{ items: Collection[] }>('/collections/mine?limit=48');
      setCollections(res.items ?? []);
    } catch (err) {
      setError(getApiErrorMessage(err, t('Toast.LoadFailed')));
    } finally {
      setLoading(false);
    }
  }, [t]);

  React.useEffect(() => {
    let cancelled = false;

    void apiClient
      .get<{ items: Collection[] }>('/collections/mine?limit=48')
      .then((res) => {
        if (cancelled) return;
        setCollections(res.items ?? []);
      })
      .catch((error) => {
        if (cancelled) return;
        setError(getApiErrorMessage(error, t('Toast.LoadFailed')));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [t]);

  const collectionHref = React.useCallback(
    (collection: Collection) =>
      user ? `/u/${encodeURIComponent(user.username)}/collections/${collection.slug}` : '#',
    [user],
  );

  const openCreate = () => {
    setEditing(null);
    setForm(userDefaults);
    setOpen(true);
  };

  const openEdit = (collection: Collection) => {
    setEditing(collection);
    setForm({ ...collectionToForm(collection), allowIndexing: false, featured: false });
    setOpen(true);
  };

  const save = async () => {
    const title = form.title.trim();
    const slug = form.slug.trim();
    if (!title) {
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

    setSaving(true);
    try {
      const body = {
        title,
        slug,
        description: form.description.trim() || undefined,
        visibility: form.visibility,
        allowIndexing: false,
      };
      if (editing) await apiClient.patch(`/collections/${editing.id}`, body);
      else await apiClient.post('/collections', body);
      toast.success(t(editing ? 'Toast.Updated' : 'Toast.Created'));
      setOpen(false);
      await loadCollections();
    } catch (err) {
      toast.error(getApiErrorMessage(err, t('Toast.SaveFailed')));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await apiClient.delete(`/collections/${pendingDelete.id}`);
      toast.success(t('Toast.Deleted'));
      setPendingDelete(null);
      await loadCollections();
    } catch (err) {
      toast.error(getApiErrorMessage(err, t('Toast.SaveFailed')));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-2xl">
              <Grid2X2 className="w-8 h-8 text-primary" />
            </div>
            {t('pageTitle')}
          </h1>
          <p className="text-muted-foreground font-medium text-lg ms-16">{t('UserSubtitle')}</p>
        </div>
        <Button onClick={openCreate} className="gap-2 rounded-xl">
          <FolderPlus aria-hidden className="size-4" />
          <span className="hidden sm:inline">{t('Actions.NewCollection')}</span>
        </Button>
      </header>

      {/* Content */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-1 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-3xl" />
          ))}
        </div>
      ) : error ? (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-border text-center">
          <AlertCircle aria-hidden className="size-9 text-destructive" />
          <p className="max-w-sm px-6 text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={() => void loadCollections()}>
            {userDashboardT('TryAgain')}
          </Button>
        </div>
      ) : collections.length === 0 ? (
        <EmptyState
          hasCollections={collections.length > 0}
          onCreate={openCreate}
          labels={{
            title: collections.length > 0 ? t('Empty.NoResults') : t('Empty.Title'),
            action: t('Actions.NewCollection'),
          }}
        />
      ) : (
        <motion.div layout className="grid gap-4 sm:grid-cols-1 xl:grid-cols-3">
          <AnimatePresence initial={false}>
            {collections.map((collection, index) => (
              <CollectionRow
                key={collection.id}
                collection={collection}
                index={index}
                href={collectionHref(collection)}
                onEdit={() => openEdit(collection)}
                onDelete={() => setPendingDelete(collection)}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Create / edit */}
      <ResponsiveModal
        open={open}
        onOpenChange={setOpen}
        title={editing ? t('EditCollection') : t('NewCollection')}
        description={editing ? t('EditCollectionHint') : t('NewCollectionHint')}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              {t('Actions.Cancel')}
            </Button>
            <Button onClick={save} disabled={saving} className="gap-1.5">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? t('Actions.Save') : t('Actions.Create')}
            </Button>
          </div>
        }
      >
        <CollectionFormFields value={form} onChange={setForm} />
      </ResponsiveModal>

      {/* Delete */}
      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(next) => !next && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-start">{t('DeleteCollectionTitle')}</AlertDialogTitle>
            <AlertDialogDescription className="text-start">
              {t('DeleteCollectionDescription', { title: pendingDelete?.title ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t('Actions.Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              disabled={deleting}
            >
              {t('Actions.Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CollectionRow({
  collection,
  index,
  href,
  onEdit,
  onDelete,
}: {
  collection: Collection;
  index: number;
  href: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations('Collections');
  const books = collection.items?.map((item) => item.book) ?? [];

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.22, ease: 'easeOut', delay: Math.min(index, 6) * 0.03 }}
      className="group flex gap-4 rounded-3xl border border-border/70 bg-card/60 p-3 transition-colors hover:border-border hover:bg-card sm:p-4"
    >
      <Link href={href} className="w-24 shrink-0 sm:w-28" tabIndex={-1} aria-hidden>
        <CollectionCover books={books} size="compact" animate={false} />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-w-0 items-start gap-2">
          <Link
            href={href}
            className="min-w-0 flex-1 text-start text-base font-bold leading-snug text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <span className="line-clamp-2">{collection.title}</span>
          </Link>
          <CollectionVisibilityBadge visibility={collection.visibility} />
        </div>

        {collection.description ? (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {collection.description}
          </p>
        ) : null}

        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <BookOpen aria-hidden className="size-3.5" />
            {t('NBook', { count: collection.bookCount })}
          </span>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={onEdit}
              aria-label={t('Actions.Edit')}
            >
              <Pencil aria-hidden className="size-4" />
            </Button>
            {!collection.locked ? (
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-destructive"
                onClick={onDelete}
                aria-label={t('Actions.Delete')}
              >
                <Trash2 aria-hidden className="size-4" />
              </Button>
            ) : null}
            <Button asChild variant="ghost" size="icon" className="size-8">
              <Link href={href} aria-label={t('view')}>
                <ArrowRight aria-hidden className="size-4 rtl:hidden" />
                <ArrowLeft aria-hidden className="hidden size-4 rtl:inline" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

function EmptyState({
  hasCollections,
  onCreate,
  labels,
}: {
  hasCollections: boolean;
  onCreate: () => void;
  labels: { title: string; action: string };
}) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-border bg-card/30 px-6 text-center">
      <div className="grid size-12 place-items-center rounded-2xl bg-muted">
        <FolderPlus aria-hidden className="size-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">{labels.title}</p>
      {!hasCollections ? (
        <Button onClick={onCreate} className="gap-2 rounded-xl">
          <FolderPlus aria-hidden className="size-4" />
          {labels.action}
        </Button>
      ) : null}
    </div>
  );
}
