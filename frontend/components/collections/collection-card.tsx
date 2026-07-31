"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { CollectionCover } from "./collection-cover";
import type { CollectionSummary } from "@/lib/types";

type CollectionCardProps = {
    collection: CollectionSummary;
    /** `hero` is used for the first / featured tiles of the grid. */
    variant?: "default" | "hero";
    index?: number;
    className?: string;
};

export function CollectionCard({
                                     collection,
                                     variant = "default",
                                     index = 0,
                                     className,
                                 }: CollectionCardProps) {
    const t = useTranslations("Collections");
    const hero = variant === "hero";
    const books = collection.items?.map((item) => item.book) ?? [];

    return (
        <motion.article
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.28, ease: "easeOut", delay: Math.min(index, 6) * 0.04 }}
            whileHover={{ y: -4 }}
            className={cn("group h-full", className)}
        >
            <Link
                href={`/collections/${collection.slug}`}
                className={cn(
                    "relative flex h-full flex-col overflow-hidden rounded-3xl border border-border/60 text-start",
                    "bg-card/70 backdrop-blur-sm transition-colors duration-300 hover:border-border hover:bg-card",
                    "shadow-sm hover:shadow-lg hover:shadow-foreground/5 dark:hover:shadow-background/60",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    hero && "sm:flex-row sm:items-stretch",
                )}
            >
                <div className={cn("p-2 sm:p-3", hero && "sm:w-1/2 sm:shrink-0")}>
                    <CollectionCover
                        books={books}
                        size={hero ? "hero" : "default"}
                        className="h-full transition-shadow duration-300 group-hover:shadow-md"
                    />
                </div>

                <div
                    className={cn(
                        "flex flex-1 flex-col gap-2 px-4 pb-5 pt-1 sm:px-5",
                        hero && "sm:justify-center sm:py-8",
                    )}
                >
                    <div className="flex min-w-0 items-start gap-2">
                        <h2
                            className={cn(
                                "min-w-0 flex-1 font-bold leading-tight tracking-tight text-foreground",
                                hero ? "line-clamp-2 text-xl sm:text-2xl" : "line-clamp-1 text-base sm:text-lg",
                            )}
                        >
                            {collection.title}
                        </h2>
                    </div>

                    {collection.description ? (
                        <p
                            className={cn(
                                "text-xs leading-relaxed text-muted-foreground sm:text-sm",
                                hero ? "line-clamp-3" : "line-clamp-2",
                            )}
                        >
                            {collection.description}
                        </p>
                    ) : null}

                    <div className="mt-auto flex items-center justify-between gap-3 pt-3">

                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
              {t("view")}
                            <ArrowRight aria-hidden className="size-3.5 rtl:hidden" />
              <ArrowLeft aria-hidden className="hidden size-3.5 rtl:inline" />
            </span>
                    </div>
                </div>
            </Link>
        </motion.article>
    );
}
