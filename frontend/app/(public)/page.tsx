"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import useSWR from "swr"
import { Clock, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface Book {
    id: number
    title: string
    cover: string
    desc: string
    type: string
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
    type: string
    chapters: Chapter[]
}

interface TrendingBook {
    id: number
    title: string
    cover: string
    type: string
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

const fetcher = (url: string) => fetch(url).then((r) => r.json())

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

function BookCardSkeleton() {
  return (
      <div className="flex flex-col gap-3">
        <div className="aspect-2/3 bg-linear-to-b from-muted via-muted to-muted animate-pulse rounded-lg" />
        <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
        <div className="h-3 bg-muted animate-pulse rounded w-1/2" />
      </div>
  )
}

function HeroCarousel({ books }: { books: Book[] }) {
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
                    <Link href={`/${book.type.toLowerCase()}/${book.id}`} className="block">
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
                            <Link href={`/books/${book.type.toLowerCase()}`}>
                                <Badge
                                    variant="outline"
                                    className="cursor-pointer border-accent-foreground/20 text-accent-foreground/70 hover:bg-accent hover:text-accent-foreground transition-all duration-200 text-xs md:text-sm px-3 py-1"
                                >
                                    {book.type.replace("_", " ").toLowerCase()}
                                </Badge>
                            </Link>
                        )}
                    </div>

                    {/* Read Now Button */}
                    <div>
                        <Link href={`/${book.type.toLowerCase()}/${book.id}`}>
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

function RatingInline({ avg, count }: { avg: number; count: number }) {
    if (!count) return null

    const rounded = Math.round(avg * 10) / 10
    const full = Math.floor(rounded)
    const half = rounded - full >= 0.5

    return (
        <div className="flex items-center gap-1 text-white/90 text-xs">
            <div className="flex items-center">
                {Array.from({ length: 5 }).map((_, i) => {
                    const filled = i < full
                    const isHalf = i === full && half
                    return (
                        <Star
                            key={i}
                            className={[
                                "h-3.5 w-3.5",
                                filled ? "fill-yellow-400 text-yellow-400" : isHalf ? "fill-yellow-400/60 text-yellow-400" : "text-white/35",
                            ].join(" ")}
                        />
                    )
                })}
            </div>
            <span className="tabular-nums">{rounded.toFixed(1)}</span>
            <span className="text-white/60">({count})</span>
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
          {data?.trending && (
              <section>
                <div className="mb-8">
                  <h2 className="text-3xl font-bold text-foreground mb-2">Trending Now</h2>
                  <p className="text-muted-foreground">Most Popular</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {data.trending.map((book) => (
                      <Link key={book.id} href={`/${book.type.toLowerCase()}/${book.id}`}>
                        <div className="group relative aspect-2/3 rounded-lg overflow-hidden bg-muted">
                          <Image
                              src={book.cover ? `/media/${book.cover}/thumbnail` : "/placeholder.svg"}
                              alt={book.title}
                              fill
                              className="object-cover group-hover:scale-105 transition-transform duration-300"
                          />

                          {/* Overlay */}
                          <div className="absolute inset-0 bg-linear-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                            <p className="text-white text-sm font-semibold line-clamp-2 text-balance">{book.title}</p>
                            <RatingInline avg={book.ratingAvg} count={book.ratingCount} />
                            <Badge variant="secondary" className="w-fit mt-2 text-xs">
                              {book.type.replace('_',' ').toLowerCase()}
                            </Badge>
                          </div>
                        </div>
                      </Link>
                  ))}
                </div>
              </section>
          )}

          {/* Latest Updates Section */}
          {data?.latest && (
              <section>
                <div className="mb-8">
                  <h2 className="text-3xl font-bold text-foreground mb-2">Latest Updates</h2>
                  <p className="text-muted-foreground">New chapters just released</p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {isLoading
                      ? Array.from({ length: 12 }).map((_, i) => <BookCardSkeleton key={i} />)
                      : data.latest.map((book) => (
                          book.chapters.length > 0 ?
                          <Link key={book.id} href={`/${book.type.toLowerCase()}/${book.id}`}>
                            <div className="flex flex-col gap-3 group cursor-pointer">
                              <div className="relative aspect-2/3 rounded-lg overflow-hidden bg-muted">
                                <Image
                                    src={book.cover ? `/media/${book.cover}/thumbnail` : "/placeholder.svg"}
                                    alt={book.title}
                                    fill
                                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                                />

                                {/* Badges */}
                                <div className="absolute top-2 left-2 right-2 z-10 flex flex-wrap gap-1">
                                  {book.chapters[0]?.free && <Badge className="bg-green-500 text-white text-xs">FREE</Badge>}
                                  <Badge className="bg-blue-500 text-white text-xs">UPDATING</Badge>
                                </div>

                                {/* Overlay with chapters */}
                                <div className="absolute inset-0 bg-linear-to-t from-black/90 to-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3 gap-2">
                                  <div className="space-y-1">
                                    {book.chapters.slice(0, 2).map((ch) => (
                                        <Link
                                            key={ch.id}
                                            href={`/${book.type.toLowerCase()}/${book.id}/chapter/${ch.num}`}
                                            className="block text-xs text-white bg-black/50 hover:bg-black/70 px-2 py-1 rounded transition-colors"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                          Ch {ch.num} {ch.free ? "(Free)" : "(Paid)"}
                                        </Link>
                                    ))}
                                  </div>
                                  <div className="flex items-center gap-1 text-xs text-white/80 mt-2 pt-2 border-t border-white/20">
                                    <Clock className="w-3 h-3" />
                                    <span>{new Date(book.time).toLocaleDateString("en-US", { month: "short", day: "numeric" })} | {new Date(book.time).toLocaleTimeString("en-US",{hour: "2-digit", minute: "2-digit"})}</span>
                                  </div>
                                </div>
                              </div>

                              <div>
                                <p className="text-xs md:text-sm font-medium text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                                  {book.title}
                                </p>
                              </div>
                            </div>
                          </Link>
                              : ''
                      ))}
                </div>
              </section>
          )}

          {/* Genres Section */}
          {data?.genres && (
              <section>
                <div className="mb-8">
                  <h2 className="text-3xl font-bold text-foreground mb-2">Browse by Genre</h2>
                  <p className="text-muted-foreground">Explore manga by your favorite category</p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-3">
                  {data.genres.map((genre) => (
                      <Link key={genre.id} href={`/genres/${genre.slug}`}>
                        <div className="p-4 rounded-lg bg-linear-to-br from-primary/10 to-primary/5 border border-primary/20 hover:border-primary/50 hover:bg-linear-to-br hover:from-primary/20 hover:to-primary/10 transition-all text-center cursor-pointer group">
                          <p className="text-sm md:text-base font-semibold text-foreground group-hover:text-primary transition-colors">
                            {genre.name}
                          </p>
                        </div>
                      </Link>
                  ))}
                </div>
              </section>
          )}

        </div>
      </main>
  )
}
