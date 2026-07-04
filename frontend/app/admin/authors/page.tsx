"use client"

import React, {useCallback, useEffect, useMemo, useRef, useState} from "react"
import {useTranslations} from "next-intl"
import {AnimatePresence, motion} from "framer-motion"
import {Loader2, Plus, Search, UserX} from "lucide-react"

import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {apiClient} from "@/lib/api-client"
import {AuthorEditor, type AuthorEditorValue, type AuthorFieldErrors,} from "@/components/admin/authors/author-editor"
import {type AuthorRow, AuthorsGrid, AuthorsGridSkeleton} from "@/components/admin/authors/authors-grid"
import {useToast} from "@/providers/toast-provider";
import {AuthorGender} from "@shared/author-metadata";
import {AppPagination} from "@/components/app-pagination";

const PAGE_SIZE = 24

type ListEnvelope = {
  data: AuthorRow[]
  meta: { total: number; page: number; lastPage: number }
}

const emptyValue: AuthorEditorValue = {
  name: "",
  originalName: "",
  slug: "",
  biography: "",
  gender: AuthorGender.UNKNOWN,
}

function toEditorValue(a: AuthorRow): AuthorEditorValue {
  return {
    name: a.name ?? "",
    originalName: a.originalName ?? "",
    slug: a.slug ?? "",
    biography: a.biography ?? "",
    gender: a.gender ?? AuthorGender.UNKNOWN,
  }
}

function toPayload(v: AuthorEditorValue) {
  return {
    name: v.name.trim(),
    slug: v.slug.trim(),
    originalName: v.originalName.trim() || undefined,
    biography: v.biography.trim() || undefined,
    gender: v.gender.trim() || undefined,
  }
}

export default function AdminAuthorsPage() {
  const t = useTranslations("Authors")
  const g = useTranslations("General")
  const toast = useToast();
  const authorsSectionRef = useRef<HTMLDivElement | null>(null);

  const [q, setQ] = useState("")
  const [debouncedQ, setDebouncedQ] = useState("")
  const [page, setPage] = useState(1)

  const [rows, setRows] = useState<AuthorRow[]>([])
  const [meta, setMeta] = useState<ListEnvelope["meta"] | null>(null)
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)

  // Editor state
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editorValue, setEditorValue] = useState<AuthorEditorValue>(emptyValue)
  const [submitting, setSubmitting] = useState(false)
  const [serverErrors, setServerErrors] = useState<AuthorFieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<AuthorRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Debounce search
  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedQ(q.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(id)
  }, [q])

  const abortRef = useRef<AbortController | null>(null)

  const fetchList = useCallback(async () => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setLoading(true)
    setListError(null)
    try {
      const params = new URLSearchParams()
      if (debouncedQ) params.set("q", debouncedQ)
      params.set("page", String(page))
      params.set("limit", String(PAGE_SIZE))
      const res = await apiClient.get<ListEnvelope>(`/author?${params.toString()}`, {
        signal: ctrl.signal,
      })
      setRows(res.data)
      setMeta(res.meta)
    } catch (err: any) {
      if (err?.name === "AbortError") return
      setListError(err?.message || t("LoadFailed"))
    } finally {
      if (!ctrl.signal.aborted) setLoading(false)
    }
  }, [debouncedQ, page, t])

  useEffect(() => {
    fetchList()
    return () => abortRef.current?.abort()
  }, [fetchList])

  const openCreate = () => {
    setEditorMode("create")
    setEditingId(null)
    setEditorValue(emptyValue)
    setServerErrors({})
    setFormError(null)
    setEditorOpen(true)
  }

  const openEdit = (author: AuthorRow) => {
    setEditorMode("edit")
    setEditingId(author.id)
    setEditorValue(toEditorValue(author))
    setServerErrors({})
    setFormError(null)
    setEditorOpen(true)
  }

  const handlePatch = (patch: Partial<AuthorEditorValue>) => {
    setEditorValue((v: any) => ({ ...v, ...patch }))
    const keys = Object.keys(patch) as (keyof AuthorEditorValue)[]
    if (keys.some((k) => serverErrors[k])) {
      setServerErrors((s: any) => {
        const next = { ...s }
        for (const k of keys) delete next[k]
        return next
      })
    }
  }

  const parseApiError = (err: any): { field: AuthorFieldErrors; message: string } => {
    const status: number | undefined = err?.status
    const body = err?.body ?? err?.data
    const fieldErrors: AuthorFieldErrors = {}
    let message = err?.message || t("SaveFailed")

    if (status === 401 || status === 403) {
      message = t("Unauthorized")
    } else if (status === 400 || status === 422) {
      if (body?.errors && typeof body.errors === "object") {
        for (const [k, v] of Object.entries(body.errors)) {
          if (k in emptyValue) {
            fieldErrors[k as keyof AuthorEditorValue] = Array.isArray(v)
                ? String(v[0])
                : String(v)
          }
        }
      }
      if (body?.message) message = String(body.message)
    } else if (status === 409) {
      // slug conflict most likely
      fieldErrors.slug = t("SlugConflict")
      message = t("SlugConflict")
    }
    return { field: fieldErrors, message }
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setServerErrors({})
    setFormError(null)
    try {
      const payload = toPayload(editorValue)
      if (editorMode === "create") {
        const created = await apiClient.post<AuthorRow>("/author", payload)
        toast.success(t("SaveSuccess_Create"))
        setEditorOpen(false)
        // Optimistically prepend if on page 1 & no filter, else refresh
        if (page === 1 && !debouncedQ) {
          setRows((r) => [created, ...r].slice(0, PAGE_SIZE))
          setMeta((m) => (m ? { ...m, total: m.total + 1 } : m))
        } else {
          fetchList()
        }
      } else if (editingId) {
        const updated = await apiClient.patch<AuthorRow>(`/author/${editingId}`, payload)
        toast.success(t("SaveSuccess_Update"))
        setEditorOpen(false)
        setRows((r) => r.map((a) => (a.id === updated.id ? updated : a)))
      }
    } catch (err: any) {
      const { field, message } = parseApiError(err)
      setServerErrors(field)
      setFormError(message)
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await apiClient.delete(`/author/${deleteTarget.id}`)
      toast.success(t("DeleteSuccess"))
      setRows((r) => r.filter((a) => a.id !== deleteTarget.id))
      setMeta((m) => (m ? { ...m, total: Math.max(0, m.total - 1) } : m))
      setDeleteTarget(null)
    } catch (err: any) {
      const status = err?.status
      let msg = err?.message || t("DeleteFailed")
      if (status === 409) msg = t("DeleteBlockedHasBooks")
      else if (status === 404) msg = t("NotFoundTitle")
      else if (status === 401 || status === 403) msg = t("Unauthorized")
      toast.error(msg)
    } finally {
      setDeleting(false)
    }
  }

  const totalPages = meta?.lastPage ?? 1
  const isEmpty = !loading && !listError && rows.length === 0

  return (
      <div ref={authorsSectionRef} className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
        {/* Header */}
        <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
        >
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("Title")}</h1>
            <p className="text-sm text-muted-foreground">{t("Description")}</p>
          </div>
          <Button onClick={openCreate} className="sm:self-end">
            <Plus className="me-2 h-4 w-4" />
            {t("NewAuthor")}
          </Button>
        </motion.div>

        {/* Search */}
        <div className="relative">
          <Search className="pointer-events-none absolute inset-s-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("SearchPlaceholder")}
              aria-label={t("SearchPlaceholder")}
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
                  <AuthorsGridSkeleton count={8} />
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
                    {t("Retry")}
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
                    {debouncedQ ? t("NoResults") : t("NoAuthors")}
                  </p>
                  {!debouncedQ ? (
                      <Button size="sm" onClick={openCreate}>
                        <Plus className="me-2 h-4 w-4" />
                        {t("NewAuthor")}
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
                  <AuthorsGrid authors={rows} onEdit={openEdit} onDelete={setDeleteTarget} />
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
                itemLabel={t("Author")}
                onPageChange={(p) => setPage(p)}
                scrollTarget={authorsSectionRef}
            />
        ) : null}

        {/* Create / Edit dialog */}
        <Dialog
            open={editorOpen}
            onOpenChange={(open) => {
              if (!submitting) setEditorOpen(open)
            }}
        >
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editorMode === "create" ? t("NewAuthor") : t("EditAuthor")}
              </DialogTitle>
              <DialogDescription>
                {editorMode === "create" ? t("CreateDescription") : t("EditDescription")}
              </DialogDescription>
            </DialogHeader>
            <AuthorEditor
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
              if (!open && !deleting) setDeleteTarget(null)
            }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("DeleteConfirmTitle")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("DeleteConfirmDescription", { name: deleteTarget?.name ?? "" })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>{g("Cancel")}</AlertDialogCancel>
              <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault()
                    handleDelete()
                  }}
                  disabled={deleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? (
                    <>
                      <Loader2 className="me-2 h-4 w-4 animate-spin" />
                      {t("Deleting")}
                    </>
                ) : (
                    g("Delete")
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
  )
}
