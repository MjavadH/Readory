'use client';

import { ContributorGender } from '@shared/contributor-metadata';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, Plus, Search, UserRoundPen, UserX } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import AdminPageHeader from '@/components/admin/admin-page-header';
import {
  type ContributorEditorValue,
  type ContributorFieldErrors,
  ContributorsEditor,
} from '@/components/admin/contributors/contributors-editor';
import {
  type ContributorRow,
  ContributorsGrid,
  ContributorsGridSkeleton,
} from '@/components/admin/contributors/contributors-grid';
import { AppPagination } from '@/components/app-pagination';
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
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ApiError, apiClient } from '@/lib/api-client';
import { useToast } from '@/providers/toast-provider';

const PAGE_SIZE = 24;

type ListEnvelope = {
  data: ContributorRow[];
  meta: { total: number; page: number; lastPage: number };
};

const emptyValue: ContributorEditorValue = {
  name: '',
  originalName: '',
  slug: '',
  biography: '',
  gender: ContributorGender.UNKNOWN,
};

function toEditorValue(a: ContributorRow): ContributorEditorValue {
  return {
    name: a.name ?? '',
    originalName: a.originalName ?? '',
    slug: a.slug ?? '',
    biography: a.biography ?? '',
    gender: a.gender ?? ContributorGender.UNKNOWN,
  };
}

function toPayload(v: ContributorEditorValue) {
  return {
    name: v.name.trim(),
    slug: v.slug.trim(),
    originalName: v.originalName.trim() || undefined,
    biography: v.biography.trim() || undefined,
    gender: v.gender.trim() || undefined,
  };
}

export default function AdminContributorsPage() {
  const t = useTranslations('Contributors');
  const g = useTranslations('General');
  const toast = useToast();
  const contributorsSectionRef = useRef<HTMLDivElement | null>(null);

  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState<ContributorRow[]>([]);
  const [meta, setMeta] = useState<ListEnvelope['meta'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  // Editor state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorValue, setEditorValue] = useState<ContributorEditorValue>(emptyValue);
  const [submitting, setSubmitting] = useState(false);
  const [serverErrors, setServerErrors] = useState<ContributorFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<ContributorRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Debounce search
  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedQ(q.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [q]);

  const abortRef = useRef<AbortController | null>(null);

  const fetchListData = useCallback(
    async (signal: AbortSignal): Promise<ListEnvelope> => {
      const params = new URLSearchParams();
      if (debouncedQ) params.set('q', debouncedQ);
      params.set('page', String(page));
      params.set('limit', String(PAGE_SIZE));

      return apiClient.get<ListEnvelope>(`/contributor?${params.toString()}`, {
        signal,
      });
    },
    [debouncedQ, page],
  );

  const fetchList = useCallback(async () => {
    abortRef.current?.abort();

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setListError(null);

    try {
      const res = await fetchListData(ctrl.signal);
      if (ctrl.signal.aborted) return;

      setRows(res.data);
      setMeta(res.meta);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;

      setListError(err instanceof Error ? err.message : t('LoadFailed'));
    } finally {
      if (!ctrl.signal.aborted) {
        setLoading(false);
      }
    }
  }, [fetchListData, t]);

  useEffect(() => {
    abortRef.current?.abort();

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    void fetchListData(ctrl.signal)
      .then((res) => {
        if (ctrl.signal.aborted) return;
        setRows(res.data);
        setMeta(res.meta);
        setListError(null);
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return;
        setListError(err instanceof Error ? err.message : t('LoadFailed'));
      })
      .finally(() => {
        if (!ctrl.signal.aborted) {
          setLoading(false);
        }
      });

    return () => {
      ctrl.abort();
    };
  }, [fetchListData, t]);

  const openCreate = () => {
    setEditorMode('create');
    setEditingId(null);
    setEditorValue(emptyValue);
    setServerErrors({});
    setFormError(null);
    setEditorOpen(true);
  };

  const openEdit = (contributors: ContributorRow) => {
    setEditorMode('edit');
    setEditingId(contributors.id);
    setEditorValue(toEditorValue(contributors));
    setServerErrors({});
    setFormError(null);
    setEditorOpen(true);
  };

  const handlePatch = (patch: Partial<ContributorEditorValue>) => {
    setEditorValue((v) => ({ ...v, ...patch }));
    const keys = Object.keys(patch) as (keyof ContributorEditorValue)[];
    if (keys.some((k) => serverErrors[k])) {
      setServerErrors((s) => {
        const next = { ...s };
        for (const k of keys) delete next[k];
        return next;
      });
    }
  };

  const parseApiError = (err: unknown): { field: ContributorFieldErrors; message: string } => {
    const fieldErrors: ContributorFieldErrors = {};

    if (err instanceof ApiError) {
      const status = err.status;
      let message = err.message || t('SaveFailed');
      const data = err.data as { errors?: Record<string, unknown>; message?: string } | undefined;

      if (status === 401 || status === 403) {
        message = t('Unauthorized');
      } else if (status === 400 || status === 422) {
        if (data?.errors && typeof data.errors === 'object') {
          for (const [k, v] of Object.entries(data.errors)) {
            if (k in emptyValue) {
              fieldErrors[k as keyof ContributorEditorValue] = Array.isArray(v)
                ? String(v[0])
                : String(v);
            }
          }
        }
        if (data?.message) message = String(data.message);
      } else if (status === 409) {
        fieldErrors.slug = t('SlugConflict');
        message = t('SlugConflict');
      }
      return { field: fieldErrors, message };
    }

    return {
      field: fieldErrors,
      message: err instanceof Error ? err.message : t('SaveFailed'),
    };
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setServerErrors({});
    setFormError(null);
    try {
      const payload = toPayload(editorValue);
      if (editorMode === 'create') {
        const created = await apiClient.post<ContributorRow>('/contributor', payload);
        toast.success(t('SaveSuccess_Create'));
        setEditorOpen(false);
        // Optimistically prepend if on page 1 & no filter, else refresh
        if (page === 1 && !debouncedQ) {
          setRows((r) => [created, ...r].slice(0, PAGE_SIZE));
          setMeta((m) => (m ? { ...m, total: m.total + 1 } : m));
        } else {
          fetchList();
        }
      } else if (editingId) {
        const updated = await apiClient.patch<ContributorRow>(`/contributor/${editingId}`, payload);
        toast.success(t('SaveSuccess_Update'));
        setEditorOpen(false);
        setRows((r) => r.map((a) => (a.id === updated.id ? updated : a)));
      }
    } catch (err: unknown) {
      const { field, message } = parseApiError(err);
      setServerErrors(field);
      setFormError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiClient.delete(`/contributor/${deleteTarget.id}`);
      toast.success(t('DeleteSuccess'));
      setRows((r) => r.filter((a) => a.id !== deleteTarget.id));
      setMeta((m) => (m ? { ...m, total: Math.max(0, m.total - 1) } : m));
      setDeleteTarget(null);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        const status = err?.status;
        let msg = err?.message || t('DeleteFailed');
        if (status === 409) msg = t('DeleteBlockedHasBooks');
        else if (status === 404) msg = t('NotFoundTitle');
        else if (status === 401 || status === 403) msg = t('Unauthorized');
        toast.error(msg);
      }
    } finally {
      setDeleting(false);
    }
  };

  const totalPages = meta?.lastPage ?? 1;
  const isEmpty = !loading && !listError && rows.length === 0;

  return (
    <div
      ref={contributorsSectionRef}
      className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-400 mx-auto pb-20 sm:pb-0"
    >
      {/* Header */}
      <AdminPageHeader
        icon={UserRoundPen}
        title={t('Title')}
        description={t('Description')}
        actions={
          <Button onClick={openCreate} className="sm:self-end">
            <Plus className="me-2 h-4 w-4" />
            {t('NewContributor')}
          </Button>
        }
      />

      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute inset-s-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('SearchPlaceholder')}
          aria-label={t('SearchPlaceholder')}
          className="ps-9"
        />
      </div>

      {/* Content */}
      <div className="min-h-50">
        <AnimatePresence mode="wait" initial={false}>
          {loading ? (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <ContributorsGridSkeleton count={8} />
            </motion.div>
          ) : listError ? (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-10 text-center"
            >
              <p className="text-sm text-destructive">{listError}</p>
              <Button variant="outline" size="sm" onClick={fetchList}>
                {t('Retry')}
              </Button>
            </motion.div>
          ) : isEmpty ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-10 text-center"
            >
              <UserX className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {debouncedQ ? t('NoResults') : t('NoContributors')}
              </p>
              {!debouncedQ ? (
                <Button size="sm" onClick={openCreate}>
                  <Plus className="me-2 h-4 w-4" />
                  {t('NewContributor')}
                </Button>
              ) : null}
            </motion.div>
          ) : (
            <motion.div
              key="grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <ContributorsGrid contributors={rows} onEdit={openEdit} onDelete={setDeleteTarget} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Pagination */}
      {!loading && !listError && meta && totalPages > 1 ? (
        <AppPagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={meta.total}
          pageSize={PAGE_SIZE}
          itemLabel={t('Contributor')}
          onPageChange={(p) => setPage(p)}
          scrollTarget={contributorsSectionRef}
        />
      ) : null}

      {/* Create / Edit dialog */}
      <Dialog
        open={editorOpen}
        onOpenChange={(open) => {
          if (!submitting) setEditorOpen(open);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editorMode === 'create' ? t('NewContributor') : t('EditContributor')}
            </DialogTitle>
            <DialogDescription>
              {editorMode === 'create' ? t('CreateDescription') : t('EditDescription')}
            </DialogDescription>
          </DialogHeader>
          <ContributorsEditor
            mode={editorMode}
            value={editorValue}
            onChange={handlePatch}
            onSubmit={handleSubmit}
            onCancel={() => !submitting && setEditorOpen(false)}
            submitting={submitting}
            serverErrors={serverErrors}
            formError={formError}
          />
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('DeleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('DeleteConfirmDescription', { name: deleteTarget?.name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{g('Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                  {t('Deleting')}
                </>
              ) : (
                g('Delete')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
