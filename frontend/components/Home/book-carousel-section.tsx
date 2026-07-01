"use client";

import {
    ChevronLeft,
    ChevronRight,
    type LucideIcon,
} from "lucide-react";
import {
    useRef,
    useState,
    useEffect,
    useCallback,
} from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { BookCard } from "@/components/book-card";
import type { BookCardData } from "@/lib/types";
import { useLocaleInfo } from "@/hooks/use-locale-info";

export interface BookCarouselSectionProps {
    /** Books to render. If empty, the section renders nothing. */
    books: BookCardData[];
    /** Lucide icon shown beside the eyebrow. */
    icon: LucideIcon;
    /** Small eyebrow text above the title (already translated). */
    eyebrow: string;
    /** Main heading (already translated). */
    title: string;
    /** aria-label for the section landmark. */
    ariaLabel?: string;
}

interface SkeletonProps {
    icon: LucideIcon;
    count?: number;
    ariaLabel?: string;
}

function BookCardSkeleton() {
    return (
        <div className="w-40 shrink-0 md:w-50">
            <div className="animate-pulse">
                <div className="aspect-2/3 w-full overflow-hidden rounded-xl border border-border bg-muted" />
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

export function BookCarouselSkeleton({
    icon: Icon,
    count = 8,
    ariaLabel = "Loading books",
}: SkeletonProps) {
    return (
        <section aria-label={ariaLabel} aria-busy="true">
            <div className="mb-6 flex items-end justify-between">
                <div>
                    <div className="mb-1 flex items-center gap-2">
                        <div className="rounded-md bg-muted p-1 animate-pulse">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="h-3 w-20 rounded bg-muted animate-pulse" />
                    </div>
                    <div className="mt-2 h-8 w-72 max-w-[80vw] rounded bg-muted animate-pulse md:w-96" />
                </div>

                <div className="hidden items-center gap-2 md:flex">
                    <div className="rounded-full border border-border bg-card p-2 animate-pulse">
                        <ChevronLeft className="h-4 w-4 text-muted-foreground rtl:rotate-180" />
                    </div>
                    <div className="rounded-full border border-border bg-card p-2 animate-pulse">
                        <ChevronRight className="h-4 w-4 text-muted-foreground rtl:rotate-180" />
                    </div>
                </div>
            </div>

            <div className="relative">
                <div className="-mx-4 flex gap-3 overflow-x-hidden px-4 pb-2 sm:gap-4">
                    {Array.from({ length: count }).map((_, i) => (
                        <BookCardSkeleton key={i} />
                    ))}
                </div>
            </div>
        </section>
    );
}

export function BookCarouselSection({
    books,
    icon: Icon,
    eyebrow,
    title,
    ariaLabel,
}: BookCarouselSectionProps) {
    if (books.length === 0) return null;

    const scrollRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(true);
    const { isRTL } = useLocaleInfo();
    const prefersReducedMotion = useReducedMotion();

    const checkScroll = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        const maxScroll = el.scrollWidth - el.clientWidth;
        const pos = isRTL ? Math.abs(el.scrollLeft) : el.scrollLeft;
        setCanScrollLeft(pos > 4);
        setCanScrollRight(pos < maxScroll - 4);
    }, [isRTL]);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        checkScroll();
        el.addEventListener("scroll", checkScroll, { passive: true });
        window.addEventListener("resize", checkScroll);
        return () => {
            el.removeEventListener("scroll", checkScroll);
            window.removeEventListener("resize", checkScroll);
        };
    }, [checkScroll]);

    const scroll = (dir: "left" | "right") => {
        const el = scrollRef.current;
        if (!el) return;
        const amount = dir === "left" ? -340 : 340;
        el.scrollBy({
            left: isRTL ? -amount : amount,
            behavior: prefersReducedMotion ? "auto" : "smooth",
        });
    };

    return (
        <section aria-label={ariaLabel ?? title}>
            <motion.div
                className="mb-6 flex items-end justify-between gap-4"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-80px" }}
                variants={{
                    hidden: { opacity: 0, y: 12 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
                }}
            >
                <div className="min-w-0">
                    <div className="mb-1 flex items-center gap-2">
                        <Icon className="h-5 w-5 shrink-0 text-primary" />
                        <span className="truncate text-xs font-semibold uppercase tracking-widest text-primary">
                            {eyebrow}
                        </span>
                    </div>
                    <h2 className="truncate text-2xl font-bold text-foreground md:text-3xl">
                        {title}
                    </h2>
                </div>

                <div className="hidden shrink-0 items-center gap-2 md:flex">
                    <ScrollButton
                        direction="left"
                        disabled={!canScrollLeft}
                        onClick={() => scroll("left")}
                    />
                    <ScrollButton
                        direction="right"
                        disabled={!canScrollRight}
                        onClick={() => scroll("right")}
                    />
                </div>
            </motion.div>

            <div className="relative">
                <motion.div
                    ref={scrollRef}
                    className="scrollbar-hide -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:gap-4"
                    style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-60px" }}
                    variants={{
                        hidden: {},
                        visible: {
                            transition: {
                                staggerChildren: prefersReducedMotion ? 0 : 0.06,
                                delayChildren: 0.1,
                            },
                        },
                    }}
                >
                    <AnimatePresence initial={false}>
                        {books.map((book, index) => (
                            <motion.div
                                key={book.id}
                                className="w-40 shrink-0 snap-start first:snap-start md:w-50"
                                variants={{
                                    hidden: { opacity: 0, y: 20, scale: 0.97 },
                                    visible: {
                                        opacity: 1,
                                        y: 0,
                                        scale: 1,
                                        transition: { duration: 0.35, ease: "easeOut" },
                                    },
                                }}
                                whileHover={
                                    prefersReducedMotion
                                        ? undefined
                                        : { y: -4, transition: { duration: 0.2 } }
                                }
                            >
                                <div className="relative">
                                    <BookCard book={book} priority={index < 6} />
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </motion.div>
            </div>
        </section>
    );
}

function ScrollButton({
    direction,
    disabled,
    onClick,
}: {
    direction: "left" | "right";
    disabled: boolean;
    onClick: () => void;
}) {
    const Icon = direction === "left" ? ChevronLeft : ChevronRight;
    return (
        <motion.button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={`Scroll ${direction}`}
            whileTap={disabled ? undefined : { scale: 0.9 }}
            whileHover={disabled ? undefined : { scale: 1.05 }}
            className="rounded-full border border-border bg-card p-2 text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-30"
        >
            <Icon className="h-4 w-4 rtl:rotate-180" />
        </motion.button>
    );
}
