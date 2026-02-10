import Link from "next/link";
import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import {AppIcon} from "@/components/AppIcon";
import type { IconKey } from "@readory/shared";

interface AllGenresSectionProps {
    genres: Array<{ id: number; name: string; slug: string; iconKey: IconKey; }>;
}

export function AllGenresSection({ genres }: AllGenresSectionProps) {
    if (genres.length === 0) return null;

    return (
        <section className="relative overflow-hidden bg-card">
            {/* Subtle decorative pattern */}
            <div className="pointer-events-none absolute inset-0 opacity-[0.03]" aria-hidden="true">
                <div className="absolute -left-20 -top-20 h-60 w-60 rounded-full bg-primary" />
                <div className="absolute -bottom-16 -right-16 h-48 w-48 rounded-full bg-accent" />
            </div>

            <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
                {/* Heading */}
                <div className="mb-8 flex flex-col items-center text-center sm:mb-10">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <BookOpen className="h-5 w-5 text-primary" />
                    </div>
                    <h2 className="text-xl font-bold text-card-foreground sm:text-2xl lg:text-3xl text-balance">
                        Browse All Genres
                    </h2>
                    <p className="mt-2 max-w-md text-sm text-muted-foreground leading-relaxed">
                        Explore our full catalogue by genre and find your next favorite read
                    </p>
                </div>

                {/* Genre pills grid */}
                <div className="flex flex-wrap justify-center gap-2.5 sm:gap-3">
                    {genres.map((g) => (
                        <Link
                            key={g.id}
                            href={`/genres/${g.slug}`}
                            className={cn(
                                "group/pill relative inline-flex items-center rounded-full px-4 py-2",
                                "border border-border bg-background/60 backdrop-blur-sm",
                                "text-sm font-medium text-card-foreground",
                                "transition-all duration-250 ease-out",
                                "hover:border-primary/40 hover:bg-primary/10 hover:text-primary hover:shadow-sm hover:shadow-primary/5",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                                "active:scale-[0.97]"
                            )}
                        >
                            <AppIcon name={g.iconKey as IconKey} className="mr-1.5 size-5"/>
                            {g.name}
                        </Link>
                    ))}
                </div>
            </div>
        </section>
    );
}