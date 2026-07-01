"use client"

import useSWR from "swr"
import { TrendingSection, TrendingSkeleton } from "@/components/Home/trending-section"
import { LatestSection, LatestSectionSkeleton } from "@/components/Home/latest-section"
import { GenresSection, GenresSectionSkeleton } from "@/components/genres-section"
import { HeroCarousel, HeroSkeleton } from "@/components/Home/hero-carousel";
import {BookType, BookGenre, BookCardData} from "@/lib/types"
import { apiClient } from "@/lib/api-client"
import {PopularSection, PopularSkeleton} from "@/components/Home/popular-section";

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

interface HomeContent {
    hero: BookCardData[]
    latest: LatestBook[]
    trending: BookCardData[]
    popular: BookCardData[]
    genres: BookGenre[]
}

const fetcher = (url: string) => apiClient.get<HomeContent>(url)

export default function Home() {
    const { data, isLoading } = useSWR<HomeContent>(`${process.env.NEXT_PUBLIC_API_BASE}/public/content`, fetcher)

    return (
        <main className="min-h-screen bg-background">
            <div className="container mx-auto px-4 py-12 space-y-16">
                {/* Hero Section */}
                <section>{isLoading || !data ? <HeroSkeleton /> : <HeroCarousel books={data.hero} />}</section>

                {/* Trending Section */}
                {isLoading || !data ? <TrendingSkeleton /> : data?.trending && <TrendingSection books={data.trending} />}

                {/* Latest Updates Section */}
                {isLoading || !data ? <LatestSectionSkeleton /> : data?.latest && <LatestSection books={data.latest} />}

                {/* popular Section */}
                {isLoading || !data ? <PopularSkeleton /> : data?.popular && <PopularSection books={data.popular} />}

                {/* Genres Section */}
                {isLoading || !data ? <GenresSectionSkeleton /> : data?.genres && <GenresSection genres={data.genres} />}

            </div>
        </main>
    )
}
