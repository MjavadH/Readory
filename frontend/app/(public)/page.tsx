"use client"

import useSWR from "swr"
import { TrendingSection, TrendingSkeleton } from "@/components/Home/trending-section"
import { LatestSection, LatestSectionSkeleton } from "@/components/Home/latest-section"
import { GenresSection, GenresSectionSkeleton } from "@/components/Home/genres-section"
import { HeroCarousel, HeroSkeleton } from "@/components/Home/hero-carousel";
import {BookType, BookGenre, BookCardData, ReadingProgress} from "@/lib/types"
import { apiClient } from "@/lib/api-client"
import {PopularSection, PopularSkeleton} from "@/components/Home/popular-section";
import { ContinueReadingCard } from "@/components/dashboard/ContinueReadingCard";
import { BookMarked } from "lucide-react";
import {useTranslations} from "next-intl";

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

interface PersonalizedContent {
    continueReading: ReadingProgress
}

const fetcher = (url: string) => apiClient.get<HomeContent>(url)
const PersonalizedFetcher = (url: string) => apiClient.get<PersonalizedContent>(url)

export default function Home() {
    const { data: homeData, isLoading: homeLoading } = useSWR<HomeContent>(`${process.env.NEXT_PUBLIC_API_BASE}/public/content`, fetcher)
    const { data: personalizedData } = useSWR<PersonalizedContent>(`${process.env.NEXT_PUBLIC_API_BASE}/public/personalized`, PersonalizedFetcher)
    const t = useTranslations('UserDashboard');

    return (
        <main className="min-h-screen bg-background">
            <div className="container mx-auto px-4 py-12 space-y-16">
                {/* Hero Section */}
                <section>{homeLoading || !homeData ? <HeroSkeleton /> : <HeroCarousel books={homeData.hero} />}</section>

                {/* Trending Section */}
                {homeLoading || !homeData ? <TrendingSkeleton /> : homeData?.trending && <TrendingSection books={homeData.trending} />}

                {/* Latest Updates Section */}
                {homeLoading || !homeData ? <LatestSectionSkeleton /> : homeData?.latest && <LatestSection books={homeData.latest} />}

                {/* popular Section */}
                {homeLoading || !homeData ? <PopularSkeleton /> : homeData?.popular && <PopularSection books={homeData.popular} />}

                {/* ContinueReading Section */}
                {personalizedData && personalizedData?.continueReading && (
                    <section className="space-y-6">
                        <div className="flex items-center justify-between px-2">
                            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-3">
                                <BookMarked className="w-6 h-6 text-primary" />
                                {t("ContinueReading")}
                            </h2>
                        </div>
                        <ContinueReadingCard progress={personalizedData.continueReading} />
                    </section>
                )}

                {/* Genres Section */}
                {homeLoading || !homeData ? <GenresSectionSkeleton /> : homeData?.genres && <GenresSection genres={homeData.genres} />}

            </div>
        </main>
    )
}
