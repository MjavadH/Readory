"use client";

import Image from "next/image";
import Link from "next/link";
import { Clock, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BookType } from "@/lib/types";
import { formatUpdateTime } from "@/lib/time";
import {useTranslations} from "next-intl";
import { useRouter } from "next/navigation";

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

function LatestItemSkeleton() {
    return (
        <div className="group flex gap-4 rounded-xl border border-border bg-card p-3">
            {/* Cover */}
            <div className="relative aspect-2/3 w-20 shrink-0 overflow-hidden rounded-lg bg-muted ring-1 ring-border/50 md:w-24">
                <div className="h-full w-full animate-pulse bg-muted" />

                {/* FREE badge placeholder */}
                <div className="absolute left-1 top-1">
                    <div className="h-4 w-9 animate-pulse rounded bg-muted-foreground/20" />
                </div>
            </div>

            {/* Info */}
            <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
                <div>
                    {/* Title */}
                    <div className="space-y-1.5">
                        <div className="h-4 w-[90%] animate-pulse rounded bg-muted" />
                        <div className="h-4 w-[65%] animate-pulse rounded bg-muted" />
                    </div>

                    {/* Meta */}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                        <div className="h-5 w-16 animate-pulse rounded bg-muted" />
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3 opacity-50" />
                            <div className="h-3 w-20 animate-pulse rounded bg-muted" />
                        </div>
                    </div>
                </div>

                {/* Chapters */}
                <div className="mt-2.5 flex flex-col gap-1">
                    <div className="flex items-center justify-between rounded-md bg-muted px-2.5 py-1.5">
                        <div className="h-3 w-20 animate-pulse rounded bg-muted-foreground/20" />
                        <div className="h-3 w-8 animate-pulse rounded bg-muted-foreground/20" />
                    </div>
                    <div className="flex items-center justify-between rounded-md bg-muted px-2.5 py-1.5">
                        <div className="h-3 w-20 animate-pulse rounded bg-muted-foreground/20" />
                        <div className="h-3 w-8 animate-pulse rounded bg-muted-foreground/20" />
                    </div>
                </div>
            </div>
        </div>
    );
}

export function LatestSectionSkeleton({ count = 6 }: { count?: number }) {
    return (
        <section aria-label="Loading latest updates" aria-busy="true">
            <div className="mb-6 flex items-end justify-between">
                <div>
                    <div className="mb-1 flex items-center gap-2">
                        <div className="rounded-md bg-muted p-1 animate-pulse">
                            <Sparkles className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                    </div>

                    <div className="mt-2 h-8 w-56 max-w-[80vw] animate-pulse rounded bg-muted md:w-72" />
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: count }).map((_, index) => (
                    <LatestItemSkeleton key={index} />
                ))}
            </div>
        </section>
    );
}

export function LatestSection({ books }: { books: LatestBook[] }) {
    if (books.length === 0) return null;
    const router = useRouter();
    const t = useTranslations('HomePage');
    const ti = useTranslations('Time');
    const filtered = books.filter((b) => b.chapters.length > 0);

    return (
        <section>
            <div className="mb-6 flex items-end justify-between">
                <div>
                    <div className="mb-1 flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        <span className="text-xs font-semibold uppercase tracking-widest text-primary">
                            {t("FreshDrops")}
                        </span>
                    </div>
                    <h2 className="text-2xl font-bold text-foreground md:text-3xl">
                        {t("LatestUpdates")}
                    </h2>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((book) => {
                    const typeSlug = book.type.slug;
                    const typeDisplay = book.type.name;

                    return (
                        <div
                            key={book.id}
                            onClick={() => router.push(`/${typeSlug}/${book.id}`)}
                            className="group flex cursor-pointer gap-4 rounded-xl border border-border bg-card p-3 transition-all duration-300 hover:border-primary/30 hover:bg-accent/50"
                        >
                            {/* Cover */}
                            <div className="relative aspect-2/3 w-20 shrink-0 overflow-hidden rounded-lg bg-muted ring-1 ring-border/50 md:w-24">
                                <Image
                                    src={book.cover ? `/media/${book.cover}/thumbnail` : "/placeholder.svg"}
                                    alt={book.title}
                                    fill
                                    sizes="(max-width: 480px) 45vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 200px"
                                    className="object-cover transition-transform duration-500 group-hover:scale-110"
                                />
                                {book.chapters[0]?.free && (
                                    <div className="absolute left-1 top-1">
                                        <Badge className="bg-emerald-500 px-1.5 py-0 text-[10px] font-bold text-emerald-50 shadow-sm">
                                            {t("Free")}
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
                                            {formatUpdateTime(book.time , ti)}
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
                                            <span className="font-medium">{t("Chapter")} {ch.num}</span>
                                            <span className={ch.free ? "font-semibold text-emerald-600" : "text-muted-foreground"}>
                                                {ch.free ? t("Free") : t("Paid")}
                                            </span>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
