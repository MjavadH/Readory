"use client"

import Image from "next/image"
import Link from "next/link"
import { Clock, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface Chapter {
    id: number
    num: number
    free: boolean
}

interface LatestBook {
    id: number
    title: string
    cover: string
    time: string
    type: string
    chapters: Chapter[]
}

function TimeAgo({ time }: { time: string }) {
    const diff = Date.now() - new Date(time).getTime()
    const mins = Math.floor(diff / 60000)
    const hours = Math.floor(mins / 60)
    const days = Math.floor(hours / 24)

    let label: string
    if (mins < 60) label = `${mins}m ago`
    else if (hours < 24) label = `${hours}h ago`
    else if (days < 7) label = `${days}d ago`
    else label = new Date(time).toLocaleDateString("en-US", { month: "short", day: "numeric" })

    return (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <Clock className="h-3 w-3" />
            {label}
    </span>
    )
}

export function LatestSection({ books }: { books: LatestBook[] }) {
    const filtered = books.filter((b) => b.chapters.length > 0)

    return (
        <section>
            <div className="flex items-end justify-between mb-6">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Sparkles className="h-5 w-5 text-primary" />
                        <span className="text-xs font-semibold uppercase tracking-widest text-primary">
              Fresh Drops
            </span>
                    </div>
                    <h2 className="text-2xl md:text-3xl font-bold text-foreground">
                        Latest Updates
                    </h2>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((book) => (
                    <Link key={book.id} href={`/${book.type.toLowerCase()}/${book.id}`}>
                        <div className="group flex gap-4 p-3 rounded-xl border border-border bg-card hover:bg-accent/50 hover:border-primary/30 transition-all duration-300 cursor-pointer">
                            {/* Cover */}
                            <div className="relative w-20 md:w-24 shrink-0 aspect-[2/3] rounded-lg overflow-hidden bg-muted ring-1 ring-border/50">
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
                                {book.chapters[0]?.free && (
                                    <div className="absolute top-1 left-1">
                                        <Badge className="bg-emerald-500 text-emerald-50 text-[10px] px-1.5 py-0 font-bold shadow-sm">
                                            FREE
                                        </Badge>
                                    </div>
                                )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                                <div>
                                    <h3 className="text-sm font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors leading-snug">
                                        {book.title}
                                    </h3>
                                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                        <Badge
                                            variant="secondary"
                                            className="text-[10px] px-1.5 py-0 font-medium"
                                        >
                                            {book.type.replace("_", " ").toLowerCase()}
                                        </Badge>
                                        <TimeAgo time={book.time} />
                                    </div>
                                </div>

                                {/* Chapters */}
                                <div className="flex flex-col gap-1 mt-2.5">
                                    {book.chapters.slice(0, 2).map((ch) => (
                                        <Link
                                            key={ch.id}
                                            href={`/${book.type.toLowerCase()}/${book.id}/chapter/${ch.num}`}
                                            onClick={(e) => e.stopPropagation()}
                                            className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-md bg-muted hover:bg-primary/10 hover:text-primary transition-colors"
                                        >
                                            <span className="font-medium">Chapter {ch.num}</span>
                                            <span
                                                className={
                                                    ch.free
                                                        ? "text-emerald-600 font-semibold"
                                                        : "text-muted-foreground"
                                                }
                                            >
                        {ch.free ? "Free" : "Paid"}
                      </span>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </section>
    )
}
