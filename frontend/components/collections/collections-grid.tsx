"use client";

import { cn } from "@/lib/utils";
import { CollectionCard } from "./collection-card";
import type { CollectionSummary } from "@/lib/types";

type CollectionsGridProps = {
  collections: CollectionSummary[];
  className?: string;
};

export function CollectionsGrid({ collections, className }: CollectionsGridProps) {
  const heroIndex = Math.max(
    0,
    collections.findIndex((c) => c.featured),
  );

  return (
    <section
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4",
        className,
      )}
    >
      {collections.map((collection, index) => {
        const hero = index === heroIndex && collections.length >= 2 && collection.items.length === 1;
        return (
          <CollectionCard
            key={collection.id}
            collection={collection}
            index={index}
            variant={hero ? "hero" : "default"}
            className={hero ? "sm:col-span-2" : undefined}
          />
        );
      })}
    </section>
  );
}
