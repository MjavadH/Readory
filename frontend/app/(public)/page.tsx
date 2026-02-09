"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import useSWR from "swr"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { TrendingSection } from "@/components/trending-section"
import { LatestSection } from "@/components/latest-section"
import { GenresSection } from "@/components/genres-section"
import { bookTypeToSlug, type BookType } from "@/lib/types"
import { apiClient } from "@/lib/api-client"

interface Book {
    id: number
    title: string
    cover: string
    desc: string
    type: BookType
    genres: string[]
}

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
    type: BookType
    chapters: Chapter[]
}

interface TrendingBook {
    id: number
    title: string
    cover: string
    type: BookType
    ratingAvg: number
    ratingCount: number
}

interface Genre {
    id: number
    name: string
    slug: string
}

interface HomeContent {
    hero: Book[]
    latest: LatestBook[]
    trending: TrendingBook[]
    genres: Genre[]
}

const fetcher = (url: string) => apiClient.get<HomeContent>(url)

function HeroSkeleton() {
    return (
        <div className="w-full rounded-2xl bg-muted/60 p-6 md:p-10">
            <div className="flex flex-col md:flex-row gap-6 md:gap-10 items-center md:items-start">
                <div className="w-44 md:w-52 aspect-2/3 bg-muted animate-pulse rounded-xl shrink-0" />
                <div className="flex-1 space-y-4 w-full py-4">
                    <div className="h-8 bg-muted animate-pulse rounded w-3/4" />
                    <div className="h-4 bg-muted animate-pulse rounded w-full" />
                    <div className="h-4 bg-muted animate-pulse rounded w-2/3" />
                    <div className="flex gap-2 pt-2">
                        <div className="h-7 w-16 bg-muted animate-pulse rounded-full" />
                        <div className="h-7 w-20 bg-muted animate-pulse rounded-full" />
                        <div className="h-7 w-14 bg-muted animate-pulse rounded-full" />
                    </div>
                    <div className="h-11 w-32 bg-muted animate-pulse rounded-lg mt-4" />
                </div>
            </div>
        </div>
    )
}

function HeroCarousel({ books }: { books: Book[] }) {
    if (books.length === 0) return;
    console.log(books)
    const [current, setCurrent] = useState(0)
    const [isTransitioning, setIsTransitioning] = useState(false)
    const [direction, setDirection] = useState<"next" | "prev">("next")

    useEffect(() => {
        const timer = setInterval(() => {
            setDirection("next")
            setIsTransitioning(true)
            setTimeout(() => {
                setCurrent((prev) => (prev + 1) % books.length)
                setIsTransitioning(false)
            }, 300)
        }, 6000)
        return () => clearInterval(timer)
    }, [books.length])

    const book = books[current]
    const bookTypeSlug = bookTypeToSlug(book.type)

    return (
        <div className="w-full rounded-2xl bg-muted/50 border border-border/50 overflow-hidden">
            <div
                className={`flex flex-col md:flex-row items-center md:items-stretch transition-all duration-500 ease-out ${
                    isTransitioning
                        ? direction === "next"
                            ? "opacity-0 translate-x-4"
                            : "opacity-0 -translate-x-4"
                        : "opacity-100 translate-x-0"
                }`}
            >
                {/* Book Cover - Left Side */}
                <div className="w-full md:w-auto shrink-0 p-6 pb-0 md:p-8 flex justify-center md:justify-start">
                    <Link href={`/${bookTypeSlug}/${book.id}`} className="block">
                        <div className="relative w-44 md:w-52 aspect-2/3 rounded-xl overflow-hidden shadow-xl ring-1 ring-border/20 transition-transform duration-300 hover:scale-[1.03]">
                            <Image
                                src={book.cover ? `/media/${book.cover}/thumbnail` : "/placeholder.svg"}
                                alt={book.title}
                                fill
                                className="object-cover"
                                priority
                            />
                        </div>
                    </Link>
                </div>

                {/* Content - Right Side */}
                <div className="flex-1 flex flex-col justify-center p-6 pt-4 md:p-8 md:pl-2">
                    {/* Title */}
                    <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground mb-3 line-clamp-2 text-balance">
                        {book.title}
                    </h1>

                    {/* Description */}
                    <p className="text-sm md:text-base text-muted-foreground leading-relaxed mb-5 line-clamp-2">
                        {book.desc}
                    </p>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-2 mb-6">
                        {book.genres &&
                            book.genres.map((genre, idx) => (
                                <Link key={`genre-${idx}`} href={`/genres/${genre.toLowerCase()}`}>
                                    <Badge
                                        variant="secondary"
                                        className="cursor-pointer bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 hover:border-primary/40 transition-all duration-200 text-xs md:text-sm px-3 py-1"
                                    >
                                        {genre}
                                    </Badge>
                                </Link>
                            ))}
                        {book.type && (
                            <Link href={`/books/${bookTypeSlug}`}>
                                <Badge
                                    variant="outline"
                                    className="cursor-pointer border-accent-foreground/20 text-accent-foreground/70 hover:bg-accent hover:text-accent-foreground transition-all duration-200 text-xs md:text-sm px-3 py-1"
                                >
                                    {book.type.name}
                                </Badge>
                            </Link>
                        )}
                    </div>

                    {/* Read Now Button */}
                    <div>
                        <Link href={`/${bookTypeSlug}/${book.id}`}>
                            <Button
                                size="lg"
                                className="rounded-lg font-semibold px-8 transition-all duration-200 hover:scale-[1.03] active:scale-[0.98] shadow-md hover:shadow-lg"
                            >
                                Read Now
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>

            {/* Indicators */}
            <div className="flex justify-center gap-2 pb-5">
                {books.map((_, idx) => (
                    <button
                        key={idx}
                        onClick={() => {
                            if (idx === current) return
                            setDirection(idx > current ? "next" : "prev")
                            setIsTransitioning(true)
                            setTimeout(() => {
                                setCurrent(idx)
                                setIsTransitioning(false)
                            }, 300)
                        }}
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                            idx === current
                                ? "w-8 bg-primary"
                                : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                        }`}
                        aria-label={`Go to slide ${idx + 1}`}
                    />
                ))}
            </div>
        </div>
    )
}

export default function Home() {
    const { data, isLoading } = useSWR<HomeContent>(`${process.env.NEXT_PUBLIC_API_BASE}/public/content`, fetcher)

    return (
        <main className="min-h-screen bg-background">
            <div className="container mx-auto px-4 py-12 space-y-16">
                {/* Hero Section */}
                <section>{isLoading || !data ? <HeroSkeleton /> : <HeroCarousel books={data.hero} />}</section>

                {/* Trending Section */}
                {data?.trending && <TrendingSection books={data.trending} />}

                {/* Latest Updates Section */}
                {data?.latest && <LatestSection books={data.latest} />}

                {/* Genres Section */}
                {data?.genres && <GenresSection genres={data.genres} />}

            </div>
        </main>
    )
}
