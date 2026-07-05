"use client";

import { getBookCoverThumbnailUrl } from "@/lib/media"
import { ReadingProgress } from "@/lib/types";
import { BookOpen, Clock, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { formatUpdateTime } from "@/lib/time";
import Link from "next/link";
import Image from "next/image";
import {AppIcon} from "@/components/AppIcon";
import {useTranslations} from "next-intl";

interface Props {
    progress: ReadingProgress;
}

export function ContinueReadingCardSkeleton() {
    return (
        <div className="bg-card rounded-3xl p-6 border border-border shadow-sm relative overflow-hidden">
            <div className="flex flex-col md:flex-row gap-6 relative z-10">
                {/* Book Cover */}
                <div className="relative aspect-2/3 w-32 shrink-0 overflow-hidden rounded-lg bg-muted ring-1 ring-border/50">
                    <div className="absolute inset-0 bg-linear-to-br from-muted-foreground/10 to-muted-foreground/20 animate-pulse" />
                </div>

                {/* Content */}
                <div className="flex-1 flex flex-col justify-between py-1">
                    <div className="space-y-4">
                        <div className="h-8 w-3/4 rounded-xl bg-muted-foreground/20 animate-pulse" />
                        <div className="h-5 w-1/2 rounded-lg bg-muted-foreground/20 animate-pulse" />

                        <div className="flex flex-wrap items-center gap-4">
                            <div className="h-9 w-48 rounded-xl bg-muted-foreground/20 animate-pulse" />
                            <div className="h-5 w-24 rounded-lg bg-muted-foreground/20 animate-pulse" />
                        </div>
                    </div>

                    <div className="mt-6 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="h-4 w-24 rounded bg-muted-foreground/20 animate-pulse" />
                            <div className="h-4 w-16 rounded bg-muted-foreground/20 animate-pulse" />
                        </div>

                        <div className="h-3 bg-muted rounded-full overflow-hidden border border-border/50 ring-2 ring-primary/5">
                            <div className="h-full ltr:bg-linear-to-r rtl:bg-linear-to-l from-primary to-primary-foreground/30 animate-pulse" />
                        </div>
                    </div>
                </div>

                {/* Button */}
                <div className="flex items-center justify-center">
                    <div className="w-16 h-16 rounded-2xl bg-muted-foreground/20 animate-pulse" />
                </div>
            </div>
        </div>
    );
}

export function ContinueReadingCard({ progress }: Props) {
    const t = useTranslations('UserDashboard');
    const ti = useTranslations('Time');
    const url = `/${progress.book.type.slug}/${progress.book.id}/c/${progress.chapter.index}`
    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-card rounded-3xl p-6 border border-border shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group"
        >
            <div className="absolute top-0 ltr:right-0 rtl:left-0 p-4 opacity-10">
                {progress.book.type.iconKey ? (
                    <AppIcon name={progress.book.type.iconKey} className="m-1.5 w-24 h-24" />
                ) : (
                    <BookOpen className="w-24 h-24" />
                )}
            </div>

            <div className="flex flex-col md:flex-row gap-6 relative z-10">
                <div className="relative aspect-2/3 w-32 shrink-0 overflow-hidden rounded-lg bg-muted ring-1 ring-border/50">
                    <Image
                        src={
                            progress.book.coverImage
                                ? getBookCoverThumbnailUrl(progress.book.coverImage)
                                : "/placeholder.svg"
                        }
                        alt={progress.book.title}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                </div>
                <div className="flex-1 flex flex-col justify-between py-1">
                    <div>
                        <h3 className="text-2xl font-bold tracking-tight mb-1 group-hover:text-primary transition-colors line-clamp-1">{progress.book.title}</h3>
                        <p className="text-muted-foreground font-medium mb-3">{progress.book.contributors}</p>

                        <div className="flex flex-wrap items-center gap-4 text-sm font-medium">
                            <div className="flex items-center gap-1.5 bg-muted/50 px-3 py-1.5 rounded-xl border border-border/50">
                                <span className="text-foreground">{t("ChapterIndex", {ChapterIndex: progress.chapter.index})}</span>
                                <span className="text-muted-foreground/50 mx-1">•</span>
                                <span className="text-muted-foreground">{progress.chapter.title}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                                <Clock className="w-4 h-4" />
                                <span>{formatUpdateTime(new Date(progress.lastReadAt), ti)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6">
                        <div className="flex items-center justify-between text-sm font-bold mb-2">
                            <span className="text-muted-foreground">{t("OverallProgress")}</span>
                            <span className="text-primary">{t("Percent", {Percent: progress.progress.percent})}</span>
                        </div>
                        <div className="h-3 bg-muted rounded-full overflow-hidden border border-border/50 ring-2 ring-primary/5">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${progress.progress.percent}%` }}
                                transition={{ duration: 1, ease: "easeOut" }}
                                className="h-full rounded-full ltr:bg-linear-to-r rtl:bg-linear-to-l from-primary to-primary-foreground/30"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-center">
                    <Link href={url}
                        className="p-4 bg-primary text-primary-foreground rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/20 group/btn"
                    >
                        <ChevronRight className="w-6 h-6  ltr:group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1 transition-transform" />
                    </Link>
                </div>
            </div>
        </motion.div>
    );
}
