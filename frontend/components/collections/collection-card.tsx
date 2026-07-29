import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { CollectionCover } from "./collection-cover";
import type { CollectionSummary } from "@/lib/types";

type CollectionCardProps = {
    collection: CollectionSummary;
}

export function CollectionCard({ collection }: CollectionCardProps) {
    return (
        <Link href={`/collections/${collection.slug}`} className="group block space-y-4">
            <CollectionCover books={collection.items.map((item) => item.book)} className="shadow-sm transition-transform group-hover:scale-[1.02]" />
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <h2 className="line-clamp-1 text-xl font-bold">{collection.title}</h2>
                    {collection.featured ? <Badge variant="secondary">Featured</Badge> : null}
                </div>
                {collection.description ? (
                    <p className="line-clamp-2 text-sm text-muted-foreground">{collection.description}</p>
                ) : null}
                <p className="text-sm font-medium text-muted-foreground">{collection.bookCount} books</p>
            </div>
        </Link>
    )
}
