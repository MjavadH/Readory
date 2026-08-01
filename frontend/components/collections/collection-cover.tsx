"use client";

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

type Piece = {
    /** Horizontal centre of the cover, in % of the container width. */
    x: number;
    /** Vertical centre of the cover, in % of the container height. */
    y: number;
    /** Rotation in degrees. */
    r: number;
    /** Relative scale multiplier. */
    s: number;
    /** Stacking order — higher sits on top. */
    z: number;
};


const LAYOUTS: Record<number, Piece[]> = {
    1: [{ x: 50, y: 50, r: -5, s: 1.18, z: 3 }],
    2: [
        { x: 38, y: 54, r: -9, s: 1.06, z: 2 },
        { x: 63, y: 44, r: 8, s: 0.94, z: 3 },
    ],
    3: [
        { x: 27, y: 56, r: -13, s: 0.92, z: 2 },
        { x: 51, y: 44, r: 4, s: 1.1, z: 4 },
        { x: 74, y: 58, r: 12, s: 0.86, z: 3 },
    ],
    4: [
        { x: 22, y: 48, r: -15, s: 0.84, z: 2 },
        { x: 41, y: 58, r: -4, s: 1.02, z: 3 },
        { x: 60, y: 42, r: 7, s: 1.12, z: 5 },
        { x: 78, y: 57, r: 16, s: 0.8, z: 4 },
    ],
    5: [
        { x: 18, y: 52, r: -18, s: 0.78, z: 2 },
        { x: 35, y: 41, r: -7, s: 0.94, z: 3 },
        { x: 52, y: 57, r: 3, s: 1.1, z: 6 },
        { x: 69, y: 40, r: 11, s: 0.9, z: 4 },
        { x: 84, y: 55, r: 19, s: 0.74, z: 3 },
    ],
};

export function CollectionCover({
                                    books,
                                    className,
                                    animate = true,
                                    size = "default",
                                }: CollectionCoverProps) {
    const covers = books.filter(Boolean).slice(0, 5);
    const count = covers.length;
    const compact = size === "compact";
    const hero = size === "hero";

    if (count === 0) {
        return (
            <div className={cn("group/cover relative", className)}>
                <EmptyCover compact={compact} />
            </div>
        );
    }

    const layout = LAYOUTS[count] ?? LAYOUTS[5];

    const baseWidth = count === 1 ? 34 : count === 2 ? 34 : count === 3 ? 30 : 27;

    return (
        <div
            className={cn(
                "group/cover relative w-full",
                compact ? "aspect-16/9" : hero ? "aspect-16/10" : "aspect-3/2",
                className,
            )}
        >
            {covers.map((book, index) => {
                const piece = layout[index]!;
                return (
                    <CollagePiece
                        key={book.id ?? index}
                        book={book}
                        index={index}
                        piece={piece}
                        widthPct={baseWidth * piece.s}
                        animate={animate}
                    />
                );
            })}
        </div>
    );
}

function CollagePiece({
                          book,
                          index,
                          piece,
                          widthPct,
                          animate,
                      }: {
    book: BookCardData;
    index: number;
    piece: Piece;
    widthPct: number;
    animate: boolean;
}) {
    return (
        <motion.div
            layout
            initial={
                animate
                    ? { opacity: 0, scale: 0.86, rotate: piece.r * 2.2, y: 14 }
                    : false
            }
            animate={{ opacity: 1, scale: 1, rotate: piece.r, y: 0 }}
            transition={{
                type: "spring",
                stiffness: 190,
                damping: 18,
                mass: 0.7,
                delay: animate ? index * 0.07 : 0,
            }}
            whileHover={{ rotate: 0, scale: 1.07, zIndex: 20 }}
            style={{
                left: `${piece.x}%`,
                top: `${piece.y}%`,
                width: `${widthPct}%`,
                zIndex: piece.z,
                rotate: piece.r,
            }}
            className={cn(
                "absolute -translate-x-1/2 -translate-y-1/2",
                "aspect-2/3 overflow-hidden rounded-[3px] bg-muted sm:rounded-sm",
                "ring-1 ring-foreground/10 dark:ring-background/50",
                "shadow-md shadow-foreground/15 dark:shadow-background/70",
            )}
        >
            {book?.coverImage ? (
                <Image
                    src={getBookCoverThumbnailUrl(book.coverImage)}
                    alt={book.title}
                    fill
                    sizes="(max-width: 640px) 28vw, (max-width: 1024px) 18vw, 160px"
                    className="object-cover"
                />
            ) : (
                <div className="flex h-full w-full items-center justify-center bg-muted">
                    <span className="line-clamp-3 px-1 text-center text-[9px] font-medium leading-tight text-muted-foreground sm:text-[10px]">
                        {book?.title}
                    </span>
                </div>
            )}
        </motion.div>
    );
}

function EmptyCover({ compact }: { compact: boolean }) {
    const stubs: Piece[] = [
        { x: 34, y: 52, r: -12, s: 1, z: 1 },
        { x: 52, y: 44, r: 5, s: 1, z: 3 },
        { x: 68, y: 56, r: 14, s: 1, z: 2 },
    ];

    return (
        <div
            className={cn(
                "relative w-full opacity-60",
                compact ? "aspect-16/9" : "aspect-3/2",
            )}
        >
            {stubs.map((s, i) => (
                <span
                    key={i}
                    style={{
                        left: `${s.x}%`,
                        top: `${s.y}%`,
                        transform: `translate(-50%, -50%) rotate(${s.r}deg)`,
                        zIndex: s.z,
                    }}
                    className="absolute block aspect-2/3 w-[26%] rounded-sm border border-border bg-muted/60"
                />
            ))}
            <Library
                aria-hidden
                className="absolute bottom-1 left-1/2 z-10 size-4 -translate-x-1/2 text-muted-foreground/70"
            />
        </div>
    );
}
