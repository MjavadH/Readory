
"use client";

import { useEffect, useRef, useState } from "react";
import { apiClient } from "@/lib/api-client";
import {FavoriteBooksResponse} from "@/lib/types";
import {LucideBookHeart, AlertCircle} from "lucide-react";
import { AnimatePresence } from "framer-motion";
import {AppPagination} from "@/components/app-pagination";
import {useTranslations} from "next-intl";
import {BookGrid, BookGridSkeleton} from "@/components/book-grid";

const ITEMS_PER_PAGE = 24

export default function LibraryPage() {
    const t = useTranslations('UserDashboard');
    const [data, setData] = useState<FavoriteBooksResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const paginationScrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            try {
                const res = await apiClient.get<FavoriteBooksResponse>("/books/favorites", {
                    query: { page, limit: ITEMS_PER_PAGE }
                });
                setData(res);
            } catch (err: any) {
                setError(t("FailedLoadLibrary"));
            } finally {
                setLoading(false);
            }
        }
        void fetchData();
    }, [page]);

    if (loading && !data) {
        return (
            <div className="space-y-10 pb-12 animate-pulse">
                {/* Header */}
                <section className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-2">
                    <div className="space-y-3">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-muted rounded-2xl">
                                <div className="w-8 h-8 bg-muted-foreground/20 rounded-md" />
                            </div>
                            <div className="h-10 w-56 bg-muted rounded-xl" />
                        </div>
                        <div className="h-5 w-80 bg-muted rounded-lg ms-16" />
                    </div>
                </section>

                {/* Grid */}
                <div>
                    <BookGridSkeleton count={6} />
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center max-w-md mx-auto">
                <div className="p-4 bg-destructive/10 rounded-full">
                    <AlertCircle className="w-12 h-12 text-destructive" />
                </div>
                <div className="space-y-2">
                    <h2 className="text-2xl font-bold">{t("SomethingWentWrong")}</h2>
                    <p className="text-muted-foreground">{error}</p>
                </div>
                <button
                    onClick={() => window.location.reload()}
                    className="px-6 py-2.5 bg-primary text-primary-foreground rounded-2xl font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition-opacity"
                >
                    {t("TryAgain")}
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-10 pb-12">
            <section className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-2">
                <div className="space-y-1">
                    <h1 className="text-4xl font-extrabold tracking-tight text-foreground flex items-center gap-4">
                        <div className="p-3 bg-primary/10 rounded-2xl">
                            <LucideBookHeart className="w-8 h-8 text-primary" />
                        </div>
                        {t("Favorites")}
                    </h1>
                    <p className="text-muted-foreground font-medium text-lg ms-16">
                        {t("ShowingTotalFavorites", {Total: data?.total || 0})}
                    </p>
                </div>
            </section>

            <div ref={paginationScrollRef}>
                {data && (
                    <AnimatePresence mode="popLayout">
                        <BookGrid
                            books={data.data}
                            priorityCount={6}
                        />
                    </AnimatePresence>
                )}
            </div>
            {data ? (
                <AppPagination
                    currentPage={page}
                    totalPages={data.lastPage}
                    totalItems={data.total}
                    pageSize={ITEMS_PER_PAGE}
                    itemLabel={t("book")}
                    onPageChange={setPage}
                    scrollTarget={paginationScrollRef}
                />
            ) : null}
        </div>
    );
}
