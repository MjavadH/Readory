"use client";

import * as React from "react";
import Link from "next/link";
import { AlertCircle, Edit, FolderPlus, LibraryBig, Plus } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CollectionFormFields } from "@/components/collections/collection-form-fields";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { collectionToForm, emptyCollectionForm, type Collection, type CollectionFormState } from "@/lib/collection-types";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useToast } from "@/providers/toast-provider";

export default function DashboardCollectionsPage() {
    const t = useTranslations("Collections")
    const userDashboardT = useTranslations("UserDashboard")
    const toast = useToast()
    const { user } = useCurrentUser()
    const [collections, setCollections] = React.useState<Collection[]>([])
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)
    const [open, setOpen] = React.useState(false)
    const [editing, setEditing] = React.useState<Collection | null>(null)
    const [form, setForm] = React.useState<CollectionFormState>({ ...emptyCollectionForm, visibility: "PRIVATE", allowIndexing: false })
    const [saving, setSaving] = React.useState(false)

    const loadCollections = React.useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const res = await apiClient.get<{ items: Collection[] }>("/collections/mine?limit=48")
            setCollections(res.items ?? [])
        } catch (err) {
            setError(getApiErrorMessage(err, t("Toast.LoadFailed")))
        } finally {
            setLoading(false)
        }
    }, [t])

    React.useEffect(() => {
        const timeout = window.setTimeout(() => void loadCollections(), 0)
        return () => window.clearTimeout(timeout)
    }, [loadCollections])

    const openCreate = () => {
        setEditing(null)
        setForm({ ...emptyCollectionForm, visibility: "PRIVATE", allowIndexing: false })
        setOpen(true)
    }

    const openEdit = (collection: Collection) => {
        setEditing(collection)
        setForm(collectionToForm(collection))
        setOpen(true)
    }

    const save = async () => {
        const title = form.title.trim()
        if (!title) {
            toast.error(t("Toast.TitleRequired"))
            return
        }

        setSaving(true)
        try {
            const body = {
                title,
                slug: form.slug.trim() || undefined,
                description: form.description.trim() || undefined,
                visibility: form.visibility,
                allowIndexing: form.visibility === "PUBLIC" ? form.allowIndexing : false,
            }
            if (editing) await apiClient.patch(`/collections/${editing.id}`, body)
            else await apiClient.post("/collections", body)
            toast.success(t(editing ? "Toast.Updated" : "Toast.Created"))
            setOpen(false)
            await loadCollections()
        } catch (err) {
            toast.error(getApiErrorMessage(err, t("Toast.SaveFailed")))
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="space-y-8 pb-12">
            <section className="flex flex-col gap-4 px-2 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                    <h1 className="flex items-center gap-4 text-4xl font-extrabold tracking-tight text-foreground">
                        <div className="rounded-2xl bg-primary/10 p-3">
                            <LibraryBig className="h-8 w-8 text-primary" />
                        </div>
                        {t("pageTitle")}
                    </h1>
                    <p className="text-lg font-medium text-muted-foreground md:ms-16">{t("UserSubtitle")}</p>
                </div>
                <Button onClick={openCreate} className="gap-2 rounded-2xl">
                    <Plus className="h-4 w-4" />
                    {t("Actions.NewCollection")}
                </Button>
            </section>

            {loading ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-40 animate-pulse rounded-3xl bg-muted" />)}
                </div>
            ) : error ? (
                <div className="flex min-h-[45vh] flex-col items-center justify-center gap-4 text-center">
                    <AlertCircle className="h-10 w-10 text-destructive" />
                    <p className="text-muted-foreground">{error}</p>
                    <Button onClick={() => void loadCollections()}>{userDashboardT("TryAgain")}</Button>
                </div>
            ) : collections.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {collections.map((collection) => (
                        <article key={collection.id} className="rounded-3xl border border-border bg-card p-5 shadow-sm">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 space-y-1">
                                    <Link href={user ? `/u/${encodeURIComponent(user.username)}/collections/${collection.slug}` : "#"} className="line-clamp-1 text-xl font-bold hover:text-primary">
                                        {collection.title}
                                    </Link>
                                    <p className="text-sm text-muted-foreground">{t(`Visibility.${collection.visibility}` as never)} · {collection.bookCount} {userDashboardT("book")}</p>
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => openEdit(collection)} aria-label={t("Actions.Edit")}>
                                    <Edit className="h-4 w-4" />
                                </Button>
                            </div>
                            {collection.description && <p className="mt-4 line-clamp-3 text-sm text-muted-foreground">{collection.description}</p>}
                        </article>
                    ))}
                </div>
            ) : (
                <div className="flex h-80 flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-border text-center">
                    <FolderPlus className="h-10 w-10 text-muted-foreground" />
                    <p className="font-medium text-muted-foreground">{t("Empty.Title")}</p>
                    <Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" />{t("Actions.NewCollection")}</Button>
                </div>
            )}

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editing ? t("EditCollection") : t("NewCollection")}</DialogTitle>
                    </DialogHeader>
                    <CollectionFormFields value={form} onChange={setForm} />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>{t("Actions.Cancel")}</Button>
                        <Button onClick={() => void save()} disabled={saving}>{editing ? t("Actions.Save") : t("Actions.Create")}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
