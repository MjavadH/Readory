"use client"

import Link from "next/link"
import { BookOpen, } from "lucide-react"
import {AppIcon} from "@/components/AppIcon";
import {IconKey, iconRegistry} from "@/lib/iconRegistry";

interface Genre {
    id: number
    name: string
    slug: string
    iconKey: string
}

const genreColors = [
    "from-rose-500/15 to-rose-500/5 hover:from-rose-500/25 hover:to-rose-500/10 border-rose-500/20 hover:border-rose-500/40",
    "from-sky-500/15 to-sky-500/5 hover:from-sky-500/25 hover:to-sky-500/10 border-sky-500/20 hover:border-sky-500/40",
    "from-amber-500/15 to-amber-500/5 hover:from-amber-500/25 hover:to-amber-500/10 border-amber-500/20 hover:border-amber-500/40",
    "from-emerald-500/15 to-emerald-500/5 hover:from-emerald-500/25 hover:to-emerald-500/10 border-emerald-500/20 hover:border-emerald-500/40",
    "from-fuchsia-500/15 to-fuchsia-500/5 hover:from-fuchsia-500/25 hover:to-fuchsia-500/10 border-fuchsia-500/20 hover:border-fuchsia-500/40",
    "from-cyan-500/15 to-cyan-500/5 hover:from-cyan-500/25 hover:to-cyan-500/10 border-cyan-500/20 hover:border-cyan-500/40",
    "from-orange-500/15 to-orange-500/5 hover:from-orange-500/25 hover:to-orange-500/10 border-orange-500/20 hover:border-orange-500/40",
    "from-indigo-500/15 to-indigo-500/5 hover:from-indigo-500/25 hover:to-indigo-500/10 border-indigo-500/20 hover:border-indigo-500/40",
]

export function GenresSection({ genres }: { genres: Genre[] }) {
    if (genres.length === 0) return;
    return (
        <section>
            <div className="mb-6">
                <div className="flex items-center gap-2 mb-1">
                    <BookOpen className="h-5 w-5 text-primary" />
                    <span className="text-xs font-semibold uppercase tracking-widest text-primary">
            Explore
          </span>
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-foreground">
                    Browse by Genre
                </h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {genres.map((genre, index) => {
                    const colorClass = genreColors[index % genreColors.length]

                    return (
                        <Link key={genre.id} href={`/genres/${genre.slug}`}>
                            <div
                                className={`group relative flex items-center gap-3 p-4 md:p-5 rounded-xl border bg-gradient-to-br transition-all duration-300 cursor-pointer ${colorClass}`}
                            >
                                <div className="shrink-0 p-2 rounded-lg bg-background/60 backdrop-blur-sm border border-border/50 group-hover:scale-110 transition-transform duration-300">
                                    <AppIcon name={genre.iconKey as IconKey} className="h-5 w-5 text-foreground" />
                                </div>
                                <span className="text-sm md:text-base font-semibold text-foreground group-hover:translate-x-0.5 transition-transform duration-300">
                  {genre.name}
                </span>
                            </div>
                        </Link>
                    )
                })}
            </div>
        </section>
    )
}
