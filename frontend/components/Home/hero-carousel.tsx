import { getBookCoverThumbnailUrl } from "@/lib/media"
import { useState, useEffect, useCallback, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, ChevronLeft, ChevronRight, Star } from "lucide-react";
import {BookCardData} from "@/lib/types";
import Link from "next/link";
import {AppIcon} from "@/components/AppIcon";
import {useTranslations} from "next-intl";

export function HeroSkeleton() {
    return (
        <div className="relative w-full min-h-105 md:min-h-120 rounded-3xl bg-secondary/40 overflow-hidden">
            <div className="absolute inset-0 bg-linear-to-r from-secondary via-secondary/80 to-transparent" />
            <div className="relative flex flex-col-reverse md:flex-row items-center h-full p-6 md:p-12 lg:p-16 gap-6 md:gap-12">
                <div className="flex-1 space-y-5">
                    <div className="h-5 bg-slate-400/50 dark:bg-muted animate-pulse rounded-full w-24" />
                    <div className="h-10 bg-slate-400/50 dark:bg-muted animate-pulse rounded-lg w-4/5" />
                    <div className="h-4 bg-slate-400/50 dark:bg-muted animate-pulse rounded w-1/5" />
                    <div className="space-y-2">
                        <div className="h-4 bg-slate-400/50 dark:bg-muted animate-pulse rounded w-2/4" />
                        <div className="h-4 bg-slate-400/50 dark:bg-muted animate-pulse rounded w-2/4" />
                        <div className="h-4 bg-slate-400/50 dark:bg-muted animate-pulse rounded w-2/5" />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <div className="h-5 w-15 bg-slate-400/50 dark:bg-muted animate-pulse rounded-full" />
                        <div className="h-5 w-25 bg-slate-400/50 dark:bg-muted animate-pulse rounded-full" />
                        <div className="h-5 w-20 bg-slate-400/50 dark:bg-muted animate-pulse rounded-full" />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <div className="h-10 w-36 bg-slate-400/50 dark:bg-muted animate-pulse rounded-full" />
                    </div>
                </div>
                <div className="w-48 md:w-56 aspect-2/3 bg-slate-400/50 dark:bg-slate-600/30 animate-pulse rounded-2xl shrink-0" />
            </div>
        </div>
    );
}

export function HeroCarousel({ books }: { books: BookCardData[] }) {
    const t = useTranslations('HomePage');
    const [current, setCurrent] = useState(0);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    const goTo = useCallback(
        (idx: number) => {
            if (idx === current || isTransitioning) return;
            setIsTransitioning(true);
            setTimeout(() => {
                setCurrent(idx);
                setIsTransitioning(false);
            }, 350);
        },
        [current, isTransitioning]
    );

    const next = useCallback(() => {
        goTo((current + 1) % books.length);
    }, [current, books.length, goTo]);

    const prev = useCallback(() => {
        goTo((current - 1 + books.length) % books.length);
    }, [current, books.length, goTo]);

    useEffect(() => {
        if (books.length <= 1 || isHovered) return;
        const timer = setInterval(next, 7000);
        return () => clearInterval(timer);
    }, [books.length, isHovered, next]);

    if (books.length === 0) return null;

    const book = books[current];
    const bookTypeSlug = book.type.slug;
    const coverSrc = book.coverImage
        ? getBookCoverThumbnailUrl(book.coverImage)
        : "/placeholder.svg";

    return (
        <div
            className="relative w-full min-h-105 md:min-h-120 rounded-3xl overflow-hidden group"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Background image with overlay */}
            <div
                className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                    isTransitioning ? "opacity-0" : "opacity-100"
                }`}
            >
                <img
                    src={coverSrc}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover scale-110 blur-sm"
                />
                <div className="absolute inset-0 bg-linear-to-r from-secondary/95 via-secondary/85 to-secondary/50" />
                <div className="absolute inset-0 bg-linear-to-t from-secondary/80 via-transparent to-secondary/30" />
            </div>

            {/* Content */}
            <div
                className={`relative flex flex-col-reverse md:flex-row items-center md:items-center h-full min-h-105 md:min-h-120 p-6 md:p-12 lg:p-16 gap-6 md:gap-12 transition-all duration-500 ease-out ${
                    isTransitioning
                        ? "opacity-0 translate-y-3"
                        : "opacity-100 translate-y-0"
                }`}
            >
                {/* Text content */}
                <div className="flex-1 flex flex-col justify-center min-w-0">
                    {/* Label */}
                    <div className="flex items-center gap-2 mb-4">
                        <span className="text-xl font-medium text-muted-foreground/80">
                            <AppIcon name={book.type.iconKey} className="h-5 inline me-1.5" />
                            {book.type.name}
                        </span>
                    </div>

                    {/* Title */}
                    <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-secondary-foreground leading-tight mb-3 line-clamp-2">
                        {book.title}
                    </h1>

                    {/* Author & Rating */}
                    <div className="flex items-center gap-3 mb-4">
                        <span className="text-sm font-medium text-secondary-foreground/70">
                            {t("By")} {book.author}
                        </span>
                        <span className="w-1 h-1 rounded-full bg-secondary-foreground/30" />
                        <div className="flex items-center gap-1">
                            <Star className="w-3.5 h-3.5 fill-primary text-primary" />
                            <span className="text-sm font-medium text-secondary-foreground/70">
                                {book.ratingAvg}
                            </span>
                        </div>
                    </div>

                    {/* Description */}
                    <p className="text-sm md:text-base text-secondary-foreground/60 leading-relaxed mb-6 line-clamp-2 max-w-lg">
                        {book.description}
                    </p>

                    {/* Genres */}
                    <div className="flex flex-wrap gap-2 mb-7">
                        {book.genres ? book.genres.map((genre, idx) => (
                            <Badge
                                key={`genre-${idx}`}
                                variant="outline"
                                className="border-secondary-foreground/15 text-secondary-foreground/70 bg-secondary-foreground/5 backdrop-blur-sm text-xs px-3 py-1 rounded-full hover:bg-secondary-foreground/10 transition-colors"
                            >
                                <AppIcon name={genre.iconKey} />
                                {genre.name}
                            </Badge>
                        )): null}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3">
                        <Link href={`/${bookTypeSlug}/${book.id}`}>
                            <Button
                                size="lg"
                                className="rounded-full cursor-pointer font-semibold px-7 gap-2 shadow-lg hover:shadow-xl transition-all duration-300 hover:gap-3"
                            >
                                {t("StartReading")}
                                <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                            </Button>
                        </Link>
                    </div>
                </div>

                {/* Book Cover */}
                <div className="shrink-0 flex items-center justify-center">
                    <Link href={`/${bookTypeSlug}/${book.id}`} className="block">
                        <div className="relative w-44 md:w-52 lg:w-60 aspect-2/3 rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10 transition-transform duration-500 hover:scale-[1.04] hover:rotate-1">
                            <img
                                src={coverSrc}
                                alt={book.title}
                                className="w-full h-full object-cover"
                            />
                            {/* Subtle shine effect */}
                            <div className="absolute inset-0 bg-linear-to-tr from-transparent via-white/5 to-white/10 pointer-events-none" />
                        </div>
                    </Link>
                </div>
            </div>

            {/* Navigation arrows */}
            {books.length > 1 && (
                <>
                    <button
                        type="button"
                        onClick={prev}
                        className="absolute left-3 md:left-5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-secondary-foreground/10 backdrop-blur-sm border border-secondary-foreground/10 flex items-center justify-center text-secondary-foreground/60 hover:bg-secondary-foreground/20 hover:text-secondary-foreground transition-all opacity-0 group-hover:opacity-100 duration-300"
                        aria-label="Previous"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>

                    <button
                        type="button"
                        onClick={next}
                        className="absolute right-3 md:right-5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-secondary-foreground/10 backdrop-blur-sm border border-secondary-foreground/10 flex items-center justify-center text-secondary-foreground/60 hover:bg-secondary-foreground/20 hover:text-secondary-foreground transition-all opacity-0 group-hover:opacity-100 duration-300"
                        aria-label="Next"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </>
            )}
        </div>
    );
}
