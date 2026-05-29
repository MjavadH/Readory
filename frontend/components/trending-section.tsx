"use client";

import { TrendingUp, ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState, useEffect, useCallback } from "react";
import { BookCard } from "@/components/book-card";
import type { BookCardData } from "@/lib/types";
import {useTranslations} from "next-intl";

function TrendingCardSkeleton() {
    return (
        <div className="w-40 shrink-0 md:w-50">
            <div className="animate-pulse">
                {/* Cover */}
                <div className="aspect-2/3 w-full overflow-hidden rounded-xl border border-border bg-muted" />

                {/* Meta */}
                <div className="mt-3 space-y-2">
                    <div className="h-4 w-[85%] rounded bg-muted" />
                    <div className="h-4 w-[60%] rounded bg-muted" />

                    <div className="pt-1">
                        <div className="h-3 w-20 rounded bg-muted" />
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                        <div className="h-3 w-10 rounded bg-muted" />
                        <div className="h-3 w-14 rounded bg-muted" />
                    </div>
                </div>
            </div>
        </div>
    );
}

export function TrendingSkeleton({ count = 8 }: { count?: number }) {
    return (
        <section aria-label="Loading trending books" aria-busy="true">
            <div className="mb-6 flex items-end justify-between">
                <div>
                    <div className="mb-1 flex items-center gap-2">
                        <div className="rounded-md bg-muted p-1 animate-pulse">
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="h-3 w-20 rounded bg-muted animate-pulse" />
                    </div>

                    <div className="mt-2 h-8 w-72 max-w-[80vw] rounded bg-muted animate-pulse md:w-96" />
                </div>

                <div className="hidden items-center gap-2 md:flex">
                    <div className="rounded-full border border-border bg-card p-2 animate-pulse">
                        <ChevronLeft className="h-4 w-4 rtl:rotate-180 text-muted-foreground" />
                    </div>
                    <div className="rounded-full border border-border bg-card p-2 animate-pulse">
                        <ChevronRight className="h-4 w-4 rtl:rotate-180 text-muted-foreground" />
                    </div>
                </div>
            </div>

            <div className="relative">
                <div className="-mx-4 flex gap-3 overflow-x-hidden px-4 pb-2 sm:gap-4">
                    {Array.from({ length: count }).map((_, index) => (
                        <TrendingCardSkeleton key={index} />
                    ))}
                </div>
            </div>
        </section>
    );
}

export function TrendingSection({ books }: { books: BookCardData[] }) {
    if (books.length === 0) return null;
    const t = useTranslations('HomePage');
    const scrollRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(true);

    const checkScroll = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        const isRtl = window.getComputedStyle(el).direction === "rtl";
        const maxScroll = el.scrollWidth - el.clientWidth;

        if (isRtl) {
            const scrollAbs = Math.abs(el.scrollLeft);
            setCanScrollLeft(scrollAbs > 4);
            setCanScrollRight(scrollAbs < maxScroll - 4);
        } else {
            setCanScrollLeft(el.scrollLeft > 4);
            setCanScrollRight(el.scrollLeft < maxScroll - 4);
        }
    }, []);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        checkScroll();
        el.addEventListener("scroll", checkScroll, { passive: true });
        return () => el.removeEventListener("scroll", checkScroll);
    }, [checkScroll]);

    const scroll = (dir: "left" | "right") => {
        const el = scrollRef.current;
        if (!el) return;

        const isRtl = window.getComputedStyle(el).direction === "rtl";
        const amount = dir === "left" ? -340 : 340;

        el.scrollBy({ left: isRtl ? -amount : amount, behavior: "smooth" });
    };

    return (
        <section>
            <div className="mb-6 flex items-end justify-between">
                <div>
                    <div className="mb-1 flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        <span className="text-xs font-semibold uppercase tracking-widest text-primary">
                            {t("Trending")}
                        </span>
                    </div>
                    <h2 className="text-2xl font-bold text-foreground md:text-3xl">
                        {t("MostPopular")}
                    </h2>
                </div>
                <div className="hidden items-center gap-2 md:flex">
                    <button
                        onClick={() => scroll("left")}
                        disabled={!canScrollLeft}
                        className="rounded-full border border-border bg-card p-2 text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-30"
                        aria-label="Scroll left"
                        type="button"
                    >
                        <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
                    </button>
                    <button
                        onClick={() => scroll("right")}
                        disabled={!canScrollRight}
                        className="rounded-full border border-border bg-card p-2 text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-30"
                        aria-label="Scroll right"
                        type="button"
                    >
                        <ChevronRight className="h-4 w-4 rtl:rotate-180" />
                    </button>
                </div>
            </div>

            <div className="relative">
                <div
                    ref={scrollRef}
                    className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide sm:gap-4"
                    style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                >
                    {books.map((book, index) => {
                        return (
                            <div
                                key={book.id}
                                className="w-40 shrink-0 snap-start first:snap-start md:w-50"
                            >
                                <div className="relative">
                                    <BookCard book={book} priority={index < 6} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
