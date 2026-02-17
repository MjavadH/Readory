"use client";

import Image from "next/image";
import Link from "next/link";
import { Clock, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BookType } from "@/lib/types";
import { formatUpdateTime } from "@/lib/time";

interface Chapter {
    id: number;
    num: number;
    free: boolean;
}

interface LatestBook {
    id: number;
    title: string;
    cover: string;
    time: string;
    type: BookType;
    chapters: Chapter[];
}

export function LatestSection({ books }: { books: LatestBook[] }) {
    if (books.length === 0) return;
    const filtered = books.filter((b) => b.chapters.length > 0);

    return (
        <section>
            <div className="mb-6 flex items-end justify-between">
                <div>
                    <div className="mb-1 flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        <span className="text-xs font-semibold uppercase tracking-widest text-primary">
              Fresh Drops
            </span>
                    </div>
                    <h2 className="text-2xl font-bold text-foreground md:text-3xl">
                        Latest Updates
                    </h2>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((book) => {
                    const typeSlug = book.type.slug;
                    const typeDisplay = book.type.name;

                    return (
                        <Link key={book.id} href={`/${typeSlug}/${book.id}`}>
                            <div className="group flex cursor-pointer gap-4 rounded-xl border border-border bg-card p-3 transition-all duration-300 hover:border-primary/30 hover:bg-accent/50">
                                {/* Cover */}
                                <div className="relative aspect-2/3 w-20 shrink-0 overflow-hidden rounded-lg bg-muted ring-1 ring-border/50 md:w-24">
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
                                        <div className="absolute left-1 top-1">
                                            <Badge className="bg-emerald-500 px-1.5 py-0 text-[10px] font-bold text-emerald-50 shadow-sm">
                                                FREE
                                            </Badge>
                                        </div>
                                    )}
                                </div>

                                {/* Info */}
                                <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
                                    <div>
                                        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
                                            {book.title}
                                        </h3>
                                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                            <Badge
                                                variant="secondary"
                                                className="px-1.5 py-0 text-[10px] font-medium"
                                            >
                                                {typeDisplay}
                                            </Badge>
                                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                                <Clock className="h-3 w-3" />
                                                {formatUpdateTime(book.time)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Chapters */}
                                    <div className="mt-2.5 flex flex-col gap-1">
                                        {book.chapters.slice(0, 2).map((ch) => (
                                            <Link
                                                key={ch.id}
                                                href={`/${typeSlug}/${book.id}/c/${ch.num}`}
                                                onClick={(e) => e.stopPropagation()}
                                                className="flex items-center justify-between rounded-md bg-muted px-2.5 py-1.5 text-xs transition-colors hover:bg-primary/10 hover:text-primary"
                                            >
                                                <span className="font-medium">Chapter {ch.num}</span>
                                                <span
                                                    className={
                                                        ch.free
                                                            ? "font-semibold text-emerald-600"
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
                    );
                })}
            </div>
        </section>
    );
}
