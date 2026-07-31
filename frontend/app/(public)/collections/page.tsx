import { getTranslations } from "next-intl/server";
import { Library } from "lucide-react";

import { CollectionsGrid } from "@/components/collections/collections-grid";
import { apiClient } from "@/lib/api-client";
import type { CollectionSummary } from "@/lib/types";

export async function generateMetadata() {
    const t = await getTranslations("Collections");
    return {
        title: t("pageTitle"),
        description: t("pageSubtitle"),
    };
}

export default async function CollectionsPage() {
    const t = await getTranslations("Collections");

    const collections = await apiClient.get<CollectionSummary[]>("/collections", {
        next: { revalidate: 120 },
    });

    const totalBooks = collections.reduce((sum, c) => sum + (c.bookCount ?? 0), 0);

    return (
        <main className="relative">
            {/* Ambient backdrop */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-gradient-to-b from-primary/10 via-primary/[0.04] to-transparent"
            />

            <div className="container mx-auto px-4 py-8 sm:py-12">
                <header className="mb-8 flex flex-col gap-4 sm:mb-12">
                    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                        <div className="min-w-0 space-y-3">
                            <h1 className="text-balance text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
                                {t("pageTitle")}
                            </h1>
                            <p className="max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
                                {t("pageSubtitle")}
                            </p>
                        </div>
                    </div>
                </header>

                {collections.length > 0 ? (
                    <CollectionsGrid collections={collections} />
                ) : (
                    <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border bg-card/40 px-6 py-16 text-center">
                        <Library aria-hidden className="size-8 text-muted-foreground/70" />
                        <p className="text-sm text-muted-foreground sm:text-base">{t("emptyState")}</p>
                    </div>
                )}
            </div>
        </main>
    );
}
