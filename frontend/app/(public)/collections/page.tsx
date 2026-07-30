import { CollectionCard } from "@/components/collections/collection-card";
import { apiClient } from "@/lib/api-client";
import type { CollectionSummary } from "@/lib/types";

export const metadata = {
    title: "Collections",
    description: "Curated book collections",
}

export default async function CollectionsPage() {
    const collections = await apiClient.get<CollectionSummary[]>("/collections", {
        next: { revalidate: 120 },
    });

    return (
        <main className="container mx-auto space-y-10 px-4 py-10">
            <section className="space-y-3">
                <h1 className="text-4xl font-extrabold tracking-tight">Collections</h1>
                <p className="max-w-2xl text-muted-foreground">
                    Explore curated collections of books grouped by topic, purpose, and reading taste.
                </p>
            </section>

            {collections.length > 0 ? (
                <section className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {collections.map((collection) => (
                        <CollectionCard key={collection.id} collection={collection} />
                    ))}
                </section>
            ) : (
                <div className="rounded-3xl border border-dashed p-10 text-center text-muted-foreground">
                    No collections have been published yet.
                </div>
            )}
        </main>
    )
}
