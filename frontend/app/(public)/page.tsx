"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import useSWR from "swr"
import { ChevronLeft, ChevronRight, Clock } from "lucide-react"
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
      <div className="w-full h-100 md:h-125 bg-linear-to-r from-muted via-muted to-muted animate-pulse rounded-lg" />
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

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % books.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [books.length])

  const book = books[current]

  return (
      <div className="relative w-full h-100 md:h-125 rounded-lg overflow-hidden group">
        <Image src={book.cover ? `/media/${book.cover}` : "/placeholder.svg"} alt={book.title} fill className="object-cover" priority />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-linear-to-r from-black/70 via-black/40 to-transparent" />

        {/* Content */}
        <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-8 text-white">
          <div className="max-w-xl">
            <div className="flex flex-wrap gap-2 mb-3">
              {book.genres && book.genres.slice(0, 3).map((genre,idx) => (
                  <Badge key={idx} variant="secondary" className="bg-white/20 text-white hover:bg-white/30">
                    {genre}
                  </Badge>
              ))}
            </div>

            <h1 className="text-2xl md:text-4xl font-bold mb-3 line-clamp-2 text-pretty">{book.title}</h1>

            <p className="text-sm md:text-base text-white/90 mb-6 line-clamp-2">{book.desc}</p>

            <div className="flex gap-3">
              <Button size="lg" className="bg-white text-black hover:bg-white/90">
                Read Now
              </Button>
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10 bg-transparent">
                Details
              </Button>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <button
            onClick={() => setCurrent((prev) => (prev - 1 + books.length) % books.length)}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        <button
            onClick={() => setCurrent((prev) => (prev + 1) % books.length)}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <ChevronRight className="w-6 h-6" />
        </button>

        {/* Indicators */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          {books.map((_, idx) => (
              <button
                  key={idx}
                  onClick={() => setCurrent(idx)}
                  className={`h-2 rounded-full transition-all ${
                      idx === current ? "w-8 bg-white" : "w-2 bg-white/50 hover:bg-white/70"
                  }`}
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
          {data?.trending && (
              <section>
                <div className="mb-8">
                  <h2 className="text-3xl font-bold text-foreground mb-2">Trending Now</h2>
                  <p className="text-muted-foreground">Most read this week</p>
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
