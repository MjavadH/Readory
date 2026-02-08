"use client"

import Image from "next/image"
import Link from "next/link"
import { Star, TrendingUp, ChevronLeft, ChevronRight } from "lucide-react"
import { useRef, useState, useEffect, useCallback } from "react"

interface TrendingBook {
    id: number
    title: string
    cover: string
    type: string
    ratingAvg: number
    ratingCount: number
}

function RatingStars({ avg, count }: { avg: number; count: number }) {
    if (!count) return null
    const rounded = Math.round(avg * 10) / 10
    const full = Math.floor(rounded)
    const half = rounded - full >= 0.5

    return (
        <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-px">
                {Array.from({ length: 5 }).map((_, i) => {
                    const filled = i < full
                    const isHalf = i === full && half
                    return (
                        <Star
                            key={i}
                            className={[
                                "h-3 w-3",
                                filled
                                    ? "fill-amber-400 text-amber-400"
                                    : isHalf
                                        ? "fill-amber-400/60 text-amber-400"
                                        : "text-muted-foreground/30",
                            ].join(" ")}
                        />
                    )
                })}
            </div>
            <span className="text-xs font-medium text-foreground tabular-nums">
        {rounded.toFixed(1)}
      </span>
            <span className="text-xs text-muted-foreground">({count})</span>
        </div>
    )
}

function getRankStyle(rank: number) {
    if (rank === 1) return "bg-amber-400 text-amber-950"
    if (rank === 2) return "bg-zinc-300 text-zinc-800"
    if (rank === 3) return "bg-amber-600 text-amber-50"
    return "bg-muted text-muted-foreground"
}

export function TrendingSection({ books }: { books: TrendingBook[] }) {
    const scrollRef = useRef<HTMLDivElement>(null)
    const [canScrollLeft, setCanScrollLeft] = useState(false)
    const [canScrollRight, setCanScrollRight] = useState(true)

    const checkScroll = useCallback(() => {
        const el = scrollRef.current
        if (!el) return
        setCanScrollLeft(el.scrollLeft > 4)
        setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4)
    }, [])

    useEffect(() => {
        const el = scrollRef.current
        if (!el) return
        checkScroll()
        el.addEventListener("scroll", checkScroll, { passive: true })
        return () => el.removeEventListener("scroll", checkScroll)
    }, [checkScroll])

    const scroll = (dir: "left" | "right") => {
        const el = scrollRef.current
        if (!el) return
        el.scrollBy({ left: dir === "left" ? -340 : 340, behavior: "smooth" })
    }

    return (
        <section>
            <div className="flex items-end justify-between mb-6">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        <span className="text-xs font-semibold uppercase tracking-widest text-primary">
              Trending
            </span>
                    </div>
                    <h2 className="text-2xl md:text-3xl font-bold text-foreground">
                        Most Popular Right Now
                    </h2>
                </div>
                <div className="hidden md:flex items-center gap-2">
                    <button
                        onClick={() => scroll("left")}
                        disabled={!canScrollLeft}
                        className="p-2 rounded-full border border-border bg-card text-foreground hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        aria-label="Scroll left"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                        onClick={() => scroll("right")}
                        disabled={!canScrollRight}
                        className="p-2 rounded-full border border-border bg-card text-foreground hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        aria-label="Scroll right"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>
            </div>

            <div
                ref={scrollRef}
                className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 snap-x snap-mandatory -mx-4 px-4"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
                {books.map((book, index) => {
                    const rank = index + 1
                    return (
                        <Link
                            key={book.id}
                            href={`/${book.type.toLowerCase()}/${book.id}`}
                            className="shrink-0 snap-start first:snap-start"
                        >
                            <div className="group relative w-[160px] md:w-[200px] flex flex-col">
                                {/* Cover with rank */}
                                <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-muted ring-1 ring-border/50">
                                    <Image
                                        src={
                                            book.cover
                                                ? `/media/${book.cover}/thumbnail`
                                                : "/placeholder.svg"
                                        }
                                        alt={book.title}
                                        fill
                                        className="object-cover transition-transform duration-500 group-hover:scale-110"
                                    />

                                    {/* Rank badge */}
                                    <div
                                        className={`absolute top-2.5 left-2.5 h-8 w-8 rounded-lg flex items-center justify-center text-sm font-black shadow-lg ${getRankStyle(rank)}`}
                                    >
                                        {rank}
                                    </div>

                                    {/* Hover overlay */}
                                    <div className="absolute inset-0 bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col items-center justify-center gap-3 p-4">
                    <span className="text-sm font-semibold text-foreground text-center line-clamp-2 text-balance">
                      {book.title}
                    </span>
                                        <RatingStars avg={book.ratingAvg} count={book.ratingCount} />
                                        <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full border border-border bg-muted">
                      {book.type.replace("_", " ").toLowerCase()}
                    </span>
                                    </div>
                                </div>

                                {/* Info */}
                                <div className="mt-3 px-0.5">
                                    <p className="text-sm font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                                        {book.title}
                                    </p>
                                    <div className="mt-1">
                                        <RatingStars avg={book.ratingAvg} count={book.ratingCount} />
                                    </div>
                                </div>
                            </div>
                        </Link>
                    )
                })}
            </div>
        </section>
    )
}
