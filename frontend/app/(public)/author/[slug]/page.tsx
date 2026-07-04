"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import {
    BookOpen,
    Calendar,
    ChevronDown,
    UserIcon,
} from "lucide-react";

import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { BookCard, BookCardSkeleton } from "@/components/book-card";
import { AppPagination } from "@/components/app-pagination";
import type { BookCardData } from "@/lib/types";
import {AuthorGender} from "@readory/shared";

type AuthorPublic = {
    id: number;
    name: string;
    originalName: string | null;
    slug: string;
    biography: string | null;
    gender: AuthorGender;
    bookCount: number;
    updatedAt: string;
};

type AuthorPublicResponse = {
    author: AuthorPublic;
    books: BookCardData[];
    pagination: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
};

const PAGE_SIZE = 18;
const BIO_COLLAPSED_CHARS = 320;

export default function AuthorPublicPage() {
    const params = useParams<{ slug: string }>();
    const slug = params?.slug ?? "";

    const t = useTranslations("Authors");

    const [page, setPage] = useState(1);
    const [data, setData] = useState<AuthorPublicResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [bioExpanded, setBioExpanded] = useState(false);

    const booksSectionRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!slug) return;
        let cancelled = false;
        const controller = new AbortController();

        setIsLoading(true);
        setError(null);

        apiClient
            .get<AuthorPublicResponse>(`author/public/${slug}`, {
                query: { page, limit: PAGE_SIZE },
                signal: controller.signal,
            })
            .then((res) => {
                if (cancelled) return;
                setData(res);
            })
            .catch((err) => {
                if (cancelled || controller.signal.aborted) return;
                setError(getApiErrorMessage(err, t("LoadError")));
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });

        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [slug, page, t]);

    const author = data?.author;
    const pagination = data?.pagination;

    const books: BookCardData[] = useMemo(() => {
        if (!data?.books) return [];
        return data.books.map((b) => ({
            id: b.id,
            title: b.title,
            coverImage: b.coverImage,
            ratingAvg: b.ratingAvg ?? undefined,
            ratingCount: b.ratingCount ?? undefined,
            type: b.type ?? undefined,
            genres: b.genres,
            chapterCount: b.chapterCount ?? undefined,
            updatedAt: b.updatedAt,
            author: author?.name,
        })) as BookCardData[];
    }, [data?.books, author?.name]);

    if (isLoading && !data) {
        return <AuthorPageSkeleton />;
    }

    if (error && !data) {
        return (
            <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
                <div className="grid h-16 w-16 place-items-center rounded-full bg-destructive/10 text-destructive">
                    <UserIcon className="h-8 w-8" />
                </div>
                <h1 className="mt-4 text-xl font-semibold">{t("NotFoundTitle")}</h1>
                <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            </div>
        );
    }

    if (!author) return null;

    const initials = getInitials(author.name);
    const bioText = author.biography?.trim() ?? "";
    const isBioLong = bioText.length > BIO_COLLAPSED_CHARS;
    const bioDisplay =
        !isBioLong || bioExpanded ? bioText : bioText.slice(0, BIO_COLLAPSED_CHARS).trimEnd() + "…";

    return (
        <main className="relative min-h-screen bg-background text-foreground">
            {/* gradient backdrop */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-95 overflow-hidden"
            >
                <div className="absolute inset-0 bg-linear-to-b from-primary/10 via-primary/4 to-transparent" />
                <div className="absolute -top-24 inset-s-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl rtl:translate-x-1/2" />
            </div>

            <div className="relative mx-auto w-full max-w-6xl px-4 pb-16 pt-8 sm:px-6 sm:pt-12 lg:px-8">
                {/* Hero / Header */}
                <motion.section
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    className="rounded-3xl border border-border/60 bg-card/70 p-5 shadow-sm backdrop-blur-sm sm:p-8"
                >
                    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-4 sm:gap-6 md:grid-cols-[auto_minmax(0,1fr)_auto]">
                        {/* Avatar */}
                        <motion.div
                            initial={{ scale: 0.85, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.05, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                            className="relative shrink-0"
                        >
                            <div
                                className={cn(
                                    "grid place-items-center rounded-2xl",
                                    "h-20 w-20 sm:h-28 sm:w-28",
                                    "bg-linear-to-br from-primary/20 via-primary/10 to-secondary",
                                    "ring-1 ring-border/60 shadow-inner",
                                )}
                            >
                                <span className="text-2xl font-black tracking-tight text-primary sm:text-3xl">
                                    {initials}
                                </span>
                            </div>
                        </motion.div>

                        {/* Name + meta */}
                        <div className="min-w-0">
                            <motion.div
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1, duration: 0.4 }}
                                className="flex flex-wrap items-center gap-2"
                            >
                                {author.gender && author.gender !== "UNKNOWN" && (
                                    <Badge
                                        variant="outline"
                                        className="rounded-full px-2 py-0.5 text-[10px] font-medium capitalize"
                                    >
                                        {t(`AuthorGender_${author.gender}` as never, {
                                            defaultValue: author.gender.toLowerCase(),
                                        } as never)}
                                    </Badge>
                                )}
                            </motion.div>

                            <motion.h1
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.15, duration: 0.4 }}
                                className="mt-2 truncate text-2xl font-black leading-tight tracking-tight sm:text-3xl md:text-4xl"
                            >
                                {author.name}
                            </motion.h1>

                            {author.originalName && author.originalName !== author.name && (
                                <motion.p
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2, duration: 0.4 }}
                                    className="mt-1 truncate text-sm text-muted-foreground sm:text-base"
                                >
                                    {author.originalName}
                                </motion.p>
                            )}

                            {/* Stat pills */}
                            <motion.div
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.25, duration: 0.4 }}
                                className="mt-4 flex flex-wrap items-center gap-2"
                            >
                                <StatPill
                                    icon={<BookOpen className="h-3.5 w-3.5" />}
                                    label={t("BookCount", { count: pagination?.total ?? 0 })}
                                />
                                <StatPill
                                    icon={<Calendar className="h-3.5 w-3.5" />}
                                    label={t("UpdatedOn", {
                                        date: new Date(author.updatedAt).toLocaleDateString(),
                                    })}
                                />
                            </motion.div>
                        </div>
                    </div>

                    {/* Biography */}
                    {bioText && (
                        <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.35, duration: 0.4 }}
                            className="mt-6"
                        >
                            <Separator className="mb-5" />
                            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                {t("Biography")}
                            </h2>
                            <AnimatePresence initial={false} mode="wait">
                                <motion.p
                                    key={bioExpanded ? "expanded" : "collapsed"}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="whitespace-pre-line text-sm leading-relaxed text-foreground/90 sm:text-[15px]"
                                    dir="auto"
                                >
                                    {bioDisplay}
                                </motion.p>
                            </AnimatePresence>
                            {isBioLong && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setBioExpanded((v) => !v)}
                                    className="mt-2 h-8 gap-1 px-2 text-xs"
                                >
                                    {bioExpanded ? t("ShowLess") : t("ShowMore")}
                                    <ChevronDown
                                        className={cn(
                                            "h-3.5 w-3.5 transition-transform",
                                            bioExpanded && "rotate-180",
                                        )}
                                    />
                                </Button>
                            )}
                        </motion.div>
                    )}
                </motion.section>

                {/* Books */}
                <section ref={booksSectionRef} className="mt-10 scroll-mt-20 sm:mt-14">
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.4 }}
                        transition={{ duration: 0.4 }}
                        className="mb-5 flex items-end justify-between gap-4 sm:mb-6"
                    >
                        <div className="min-w-0">
                            <h2 className="truncate text-lg font-bold tracking-tight sm:text-xl">
                                {t("BooksByAuthor", { name: author.name })}
                            </h2>
                        </div>
                    </motion.div>

                    {/* Loading overlay when paginating */}
                    {isLoading && data ? (
                        <BooksGrid>
                            {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                                <BookCardSkeleton key={i} />
                            ))}
                        </BooksGrid>
                    ) : books.length === 0 ? (
                        <EmptyBooks label={t("NoBooks")} />
                    ) : (
                        <motion.div
                            key={`page-${page}`}
                            initial="hidden"
                            animate="show"
                            variants={{
                                hidden: { opacity: 0 },
                                show: {
                                    opacity: 1,
                                    transition: { staggerChildren: 0.04, delayChildren: 0.05 },
                                },
                            }}
                        >
                            <BooksGrid>
                                {books.map((book, index) => (
                                    <motion.div
                                        key={book.id}
                                        variants={{
                                            hidden: { opacity: 0, y: 14 },
                                            show: {
                                                opacity: 1,
                                                y: 0,
                                                transition: {
                                                    duration: 0.35,
                                                    ease: [0.22, 1, 0.36, 1],
                                                },
                                            },
                                        }}
                                    >
                                        <BookCard book={book} priority={index < 6} />
                                    </motion.div>
                                ))}
                            </BooksGrid>
                        </motion.div>
                    )}

                    {pagination && pagination.totalPages > 1 && (
                        <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3 }}
                            className="mt-8"
                        >
                            <AppPagination
                                currentPage={pagination.page}
                                totalPages={pagination.totalPages}
                                totalItems={pagination.total}
                                pageSize={pagination.limit}
                                itemLabel={t("Author")}
                                onPageChange={(p) => setPage(p)}
                                scrollTarget={booksSectionRef}
                            />
                        </motion.div>
                    )}
                </section>
            </div>
        </main>
    );
}

function BooksGrid({ children }: { children: React.ReactNode }) {
    return (
        <div
            className={cn(
                "grid gap-x-3 gap-y-6 sm:gap-x-4 sm:gap-y-8",
                "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6",
            )}
        >
            {children}
        </div>
    );
}

function StatPill({ icon, label }: { icon: React.ReactNode; label: string }) {
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 rounded-full",
                "border border-border/60 bg-background/60 px-2.5 py-1",
                "text-xs font-medium text-foreground/90 shadow-sm backdrop-blur-sm",
            )}
        >
            <span className="text-primary">{icon}</span>
            {label}
        </span>
    );
}

function EmptyBooks({ label }: { label: string }) {
    return (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/30 px-6 py-16 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-background text-muted-foreground shadow-sm">
                <BookOpen className="h-6 w-6" />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">{label}</p>
        </div>
    );
}

function getInitials(name: string) {
    const parts = name.trim().split(/\s+/).slice(0, 2);
    return parts.map((p) => p.charAt(0).toUpperCase()).join("") || "?";
}

function AuthorPageSkeleton() {
    return (
        <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8 sm:px-6 sm:pt-12 lg:px-8">
            <div className="rounded-3xl border border-border/60 bg-card/70 p-5 sm:p-8">
                <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-4 sm:gap-6">
                    <Skeleton className="h-20 w-20 rounded-2xl sm:h-28 sm:w-28" />
                    <div className="min-w-0 space-y-3">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-8 w-2/3" />
                        <Skeleton className="h-4 w-1/3" />
                        <div className="flex gap-2 pt-2">
                            <Skeleton className="h-6 w-24 rounded-full" />
                            <Skeleton className="h-6 w-24 rounded-full" />
                            <Skeleton className="h-6 w-28 rounded-full" />
                        </div>
                    </div>
                </div>
                <div className="mt-6 space-y-2">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-11/12" />
                    <Skeleton className="h-3 w-9/12" />
                </div>
            </div>

            <div className="mt-10 sm:mt-14">
                <Skeleton className="mb-6 h-6 w-56" />
                <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 sm:gap-y-8 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                    {Array.from({ length: 12 }).map((_, i) => (
                        <BookCardSkeleton key={i} />
                    ))}
                </div>
            </div>
        </main>
    );
}
