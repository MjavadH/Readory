"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { motion } from "framer-motion"
import { AlertCircle, ArrowLeft, ArrowRight, BookOpen, Eye, ListOrdered, Sparkles } from "lucide-react"

import { apiClient, getApiErrorMessage } from "@/lib/api-client"
import { formatUpdateTime } from "@/lib/time"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { StatCard } from "@/components/admin/stat-card"
import { CollectionDetail } from "@/components/collections/collection-detail"
import type { Collection } from "@/lib/collection-types"

export default function AdminCollectionDetailPage() {
    const params = useParams<{ slug: string }>()
    const slug = params?.slug ?? ""
    const router = useRouter()
    const t = useTranslations("Collections")
    const tTime = useTranslations("Time")

    const [collection, setCollection] = React.useState<Collection | null>(null)
    const [isLoading, setIsLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)

    const load = React.useCallback(async () => {
        if (!slug) return
        setError(null)
        try {
            const res = await apiClient.get<Collection>(`/collections/admin/${slug}`)
            setCollection(res)
        } catch (e) {
            setError(getApiErrorMessage(e, t("Toast.LoadFailed")))
        } finally {
            setIsLoading(false)
        }
    }, [slug, t])

    React.useEffect(() => {
        setIsLoading(true)
        void load()
    }, [load])

    return (
        <div className="w-full pb-20 sm:pb-0">
            <div className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
                <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="mb-4 h-8 gap-1.5 px-2 text-xs text-muted-foreground"
                >
                    <Link href="/admin/collections">
                        <ArrowLeft className="h-3.5 w-3.5 ltr:inline rtl:hidden" />
                        <ArrowRight className="h-3.5 w-3.5 ltr:hidden rtl:inline" />
                        {t("Actions.BackToCollections")}
                    </Link>
                </Button>

                {isLoading ? (
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <Skeleton key={i} className="h-28 w-full rounded-xl" />
                        ))}
                    </div>
                ) : collection ? (
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
                    >
                        <StatCard
                            index={0}
                            icon={BookOpen}
                            title={t("Stats.Books")}
                            value={String(collection.bookCount)}
                            hint={t("Stats.BooksHint")}
                        />
                        <StatCard
                            index={1}
                            icon={Eye}
                            accent="emerald"
                            title={t("Stats.Visibility")}
                            value={t(`Visibility.${collection.visibility}` as never)}
                            hint={
                                collection.indexable
                                    ? t("Stats.Indexable")
                                    : t("Stats.NotIndexable")
                            }
                        />
                        <StatCard
                            index={2}
                            icon={Sparkles}
                            accent="amber"
                            title={t("Stats.Featured")}
                            value={collection.featured ? t("Yes") : t("No")}
                            hint={t("Stats.FeaturedHint")}
                        />
                        <StatCard
                            index={3}
                            icon={ListOrdered}
                            accent="rose"
                            title={t("Stats.Updated")}
                            value={formatUpdateTime(collection.updatedAt, tTime)}
                            hint={t("Stats.UpdatedHint")}
                        />
                    </motion.div>
                ) : null}
            </div>

            {isLoading ? (
                <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-12 lg:px-8">
                    <Skeleton className="h-96 w-full rounded-3xl lg:col-span-4" />
                    <Skeleton className="h-96 w-full rounded-2xl lg:col-span-8" />
                </div>
            ) : error || !collection ? (
                <div className="mx-auto flex min-h-[40vh] w-full max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
                    <div className="grid h-12 w-12 place-items-center rounded-full bg-destructive/10">
                        <AlertCircle className="h-5 w-5 text-destructive" />
                    </div>
                    <p className="text-sm font-medium">{error ?? t("NotFound")}</p>
                    <Button variant="outline" size="sm" onClick={() => void load()}>
                        {t("Actions.Retry")}
                    </Button>
                </div>
            ) : (
                <CollectionDetail
                    collection={collection}
                    canEdit
                    canAddItems
                    bookHref={(book) => `/admin/books/${book.id}`}
                    onChanged={load}
                    onDeleted={() => router.push("/admin/collections")}
                />
            )}
        </div>
    )
}
