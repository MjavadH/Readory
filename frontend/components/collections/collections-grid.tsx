"use client";

import { cn } from "@/lib/utils";
import { CollectionCard, type CollectionCardVariant } from "./collection-card";
import type { CollectionSummary } from "@/lib/types";

type CollectionsGridProps = {
  collections: CollectionSummary[];
  className?: string;
};

const pattern: { variant: CollectionCardVariant; className: string }[] = [
  { variant: "wide", className: "lg:col-span-4" },
  { variant: "tall", className: "lg:col-span-2 lg:row-span-2" },
  { variant: "default", className: "lg:col-span-2" },
  { variant: "default", className: "lg:col-span-2" },
  { variant: "tall", className: "lg:col-span-2 lg:row-span-2" },
  { variant: "wide", className: "lg:col-span-4" },
];

export function CollectionsGrid({ collections, className }: CollectionsGridProps) {
  const featuredIndex = collections.findIndex((c) => c.featured);

  return (
      <section
          className={cn(
              "grid auto-rows-auto grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-6",
              className,
          )}
      >
        {collections.map((collection, index) => {
          const isFeatured = index === featuredIndex && collections.length >= 2;
          const tile = pattern[index % pattern.length];
          const variant = isFeatured ? "hero" : tile.variant;
          const span = isFeatured ? "sm:col-span-2 lg:col-span-4" : tile.className;

          return (
              <CollectionCard
                  key={collection.id}
                  collection={collection}
                  index={index}
                  variant={variant}
                  className={span}
              />
          );
        })}
      </section>
  );
}
