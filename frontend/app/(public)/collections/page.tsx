import { getTranslations } from "next-intl/server";
import { CollectionsClient } from "./CollectionsClient";
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

    const collections = await apiClient.get<{ items: CollectionSummary[]; nextCursor?: string; hasMore?: boolean }>("/collections?limit=24", {
        next: { revalidate: 120 },
    });

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

                <CollectionsClient initialData={collections} />
            </div>
        </main>
    );
}
