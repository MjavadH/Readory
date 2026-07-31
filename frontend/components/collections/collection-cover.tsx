import Image from "next/image";
import { motion } from "framer-motion";
import { Library } from "lucide-react";

import { cn } from "@/lib/utils";
import { getBookCoverThumbnailUrl } from "@/lib/media";
import type { BookCardData } from "@/lib/types";

type CollectionCoverProps = {
    books: BookCardData[];
    className?: string;
    animate?: boolean;
    /** Collage density. `compact` = list rows, `hero` = featured tiles. */
    size?: "compact" | "default" | "hero";
};

export function CollectionCover({
                                    books,
                                    className,
                                    animate = true,
                                    size = "default",
                                }: CollectionCoverProps) {
    const covers = books.filter(Boolean).slice(0, 4);
    const count = covers.length;
    const compact = size === "compact";
    const hero = size === "hero";

    return (
        <div
            className={cn(
                "group/cover relative isolate overflow-hidden rounded-2xl border border-border/60",
                "bg-gradient-to-br from-muted/70 via-background to-muted/40 sm:rounded-3xl",
                "shadow-sm ring-1 ring-inset ring-foreground/[0.04]",
                className,
            )}
        >
            {/* Ambient bloom taken from the first cover */}
            {covers[0]?.coverImage ? (
                <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
                    <Image
                        src={getBookCoverThumbnailUrl(covers[0].coverImage)}
                        alt=""
                        fill
                        aria-hidden
                        sizes="480px"
                        className="scale-125 object-cover opacity-40 blur-2xl saturate-150 dark:opacity-30"
                    />
                    <div className="absolute inset-0 bg-background/50 dark:bg-background/65" />
                </div>
            ) : null}

            {/* Fine grid texture */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 -z-10 opacity-[0.06] [background-image:linear-gradient(to_right,currentColor_1px,transparent_1px),linear-gradient(to_bottom,currentColor_1px,transparent_1px)] [background-size:14px_14px]"
            />

            {count === 0 ? (
                <EmptyCover compact={compact} />
            ) : (
                <div
                    className={cn(
                        "flex items-end justify-center",
                        compact
                            ? "px-3 pb-3 pt-4"
                            : hero
                                ? "px-5 pb-6 pt-8 sm:px-8 sm:pb-8 sm:pt-10"
                                : "px-3 pb-4 pt-5 sm:px-5 sm:pb-6 sm:pt-7",
                    )}
                >
                    {covers.map((book, index) => (
                        <CoverTile
                            key={book.id ?? index}
                            book={book}
                            index={index}
                            count={count}
                            animate={animate}
                            compact={compact}
                            hero={hero}
                        />
                    ))}
                </div>
            )}

            {/* Base shadow so the fan sits on a surface */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-x-6 bottom-3 h-4 rounded-[50%] bg-foreground/15 blur-md dark:bg-background/70"
            />
        </div>
    );
}

/** Tilt + lift per position, mirrored for RTL. */
const tilts = [
    "-rotate-6 rtl:rotate-6",
    "-rotate-2 rtl:rotate-2",
    "rotate-2 rtl:-rotate-2",
    "rotate-6 rtl:-rotate-6",
];

const lifts = ["translate-y-2", "translate-y-0", "translate-y-0", "translate-y-2"];

function CoverTile({
                       book,
                       index,
                       count,
                       animate,
                       compact,
                       hero,
                   }: {
    book: BookCardData;
    index: number;
    count: number;
    animate: boolean;
    compact: boolean;
    hero: boolean;
}) {
    // A single cover stands straight and larger; more covers overlap tighter.
    const single = count === 1;
    const overlap = single
        ? ""
        : count === 2
            ? "-ms-5 first:ms-0 sm:-ms-7"
            : count === 3
                ? "-ms-7 first:ms-0 sm:-ms-9"
                : "-ms-8 first:ms-0 sm:-ms-11";

    const widthClass = single
        ? compact
            ? "w-24"
            : hero
                ? "w-36 sm:w-44"
                : "w-30 sm:w-36"
        : count === 2
            ? compact
                ? "w-[46%]"
                : "w-[47%] sm:w-[45%]"
            : count === 3
                ? compact
                    ? "w-[39%]"
                    : "w-[39%] sm:w-[38%]"
                : compact
                    ? "w-[35%]"
                    : "w-[35%] sm:w-[34%]";

    const tilt = single ? "rotate-0" : tilts[index % tilts.length];
    const lift = single ? "translate-y-0" : lifts[index % lifts.length];

    return (
        <motion.div
            initial={animate ? { opacity: 0, y: 10 } : false}
            whileInView={animate ? { opacity: 1, y: 0 } : undefined}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.28, ease: "easeOut", delay: index * 0.05 }}
            className={cn(
                "relative aspect-[2/3] shrink-0 overflow-hidden rounded-md bg-muted sm:rounded-lg",
                "border border-border/70 shadow-md shadow-foreground/10 dark:shadow-background/60",
                "ring-1 ring-inset ring-background/30",
                "transition-transform duration-300 ease-out",
                "group-hover/cover:-translate-y-1 group-hover/cover:rotate-0",
                widthClass,
                overlap,
                tilt,
                lift,
            )}
            style={{ zIndex: index + 1 }}
        >
            {book?.coverImage ? (
                <Image
                    src={getBookCoverThumbnailUrl(book.coverImage)}
                    alt={book.title}
                    fill
                    sizes="(max-width: 640px) 38vw, (max-width: 1024px) 22vw, 200px"
                    className="object-cover"
                />
            ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/25 via-muted to-muted">
          <span className="line-clamp-3 px-1.5 text-center text-[10px] font-medium leading-tight text-muted-foreground">
            {book?.title}
          </span>
                </div>
            )}

            {/* Spine highlight + page edge, RTL aware */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 start-0 w-[6%] bg-gradient-to-r from-foreground/25 to-transparent rtl:bg-gradient-to-l dark:from-background/60"
            />
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-foreground/25 via-transparent to-background/10"
            />
        </motion.div>
    );
}

function EmptyCover({ compact }: { compact: boolean }) {
    return (
        <div
            className={cn(
                "relative flex items-center justify-center",
                compact ? "aspect-[16/9]" : "aspect-[3/2]",
            )}
        >
            <div className="flex items-end gap-1.5 opacity-60">
                {[0, 1, 2].map((i) => (
                    <span
                        key={i}
                        className={cn(
                            "block aspect-[2/3] w-9 rounded-sm border border-border bg-background/70 shadow-sm sm:w-11",
                            i === 0 && "-rotate-6 rtl:rotate-6",
                            i === 2 && "rotate-6 rtl:-rotate-6",
                        )}
                    />
                ))}
            </div>
            <Library aria-hidden className="absolute bottom-3 size-4 text-muted-foreground/70" />
        </div>
    );
}
