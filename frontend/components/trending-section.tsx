"use client";

import { TrendingUp, ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState, useEffect, useCallback } from "react";
import { BookCard } from "@/components/book-card";
import type { BookCardData, BookType } from "@/lib/types";

interface TrendingBook {
    id: number;
    title: string;
    cover: string;
    type: BookType;
    ratingAvg: number;
    ratingCount: number;
}

export function TrendingSection({ books }: { books: TrendingBook[] }) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(true);

    const checkScroll = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        setCanScrollLeft(el.scrollLeft > 4);
        setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
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
        el.scrollBy({ left: dir === "left" ? -340 : 340, behavior: "smooth" });
    };

    return (
        <section>
            <div className="mb-6 flex items-end justify-between">
                <div>
                    <div className="mb-1 flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        <span className="text-xs font-semibold uppercase tracking-widest text-primary">
              Trending
            </span>
                    </div>
                    <h2 className="text-2xl font-bold text-foreground md:text-3xl">
                        Most Popular Right Now
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
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                        onClick={() => scroll("right")}
                        disabled={!canScrollRight}
                        className="rounded-full border border-border bg-card p-2 text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-30"
                        aria-label="Scroll right"
                        type="button"
                    >
                        <ChevronRight className="h-4 w-4" />
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
                        const bookData: BookCardData = {
                            id: book.id,
                            title: book.title,
                            coverImage: book.cover
                                ? `${book.cover}`
                                : "/placeholder.svg",
                            type: book.type,
                            ratingAvg: book.ratingAvg,
                            ratingCount: book.ratingCount,
                        };

                        return (
                            <div
                                key={book.id}
                                className="w-[160px] shrink-0 snap-start first:snap-start md:w-[200px]"
                            >
                                <div className="relative">
                                    <BookCard book={bookData} priority={index < 6} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
