"use client";

import { ReadingProgress } from "@/lib/types";
import { BookOpen, Clock, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { formatUpdateTime } from "@/lib/time";
import Image from "next/image";
import Link from "next/link";

interface Props {
    progress: ReadingProgress;
}

export function ContinueReadingCard({ progress }: Props) {
    const url = `${progress.book.type.slug}/${progress.book.id}/c/${progress.chapter.index}`
    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-card rounded-3xl p-6 border border-border shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group"
        >
            <div className="absolute top-0 right-0 p-4 opacity-10">
                <BookOpen className="w-24 h-24" />
            </div>

            <div className="flex flex-col md:flex-row gap-6 relative z-10">
                <div className="flex-1 flex flex-col justify-between py-1">
                    <div>
                        <div className="flex items-center gap-2 text-primary font-bold text-sm mb-1 uppercase tracking-wider">
                            <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                            Continue Reading
                        </div>
                        <h3 className="text-2xl font-bold tracking-tight mb-1 group-hover:text-primary transition-colors line-clamp-1">{progress.book.title}</h3>
                        <p className="text-muted-foreground font-medium mb-3">{progress.book.author}</p>

                        <div className="flex items-center gap-4 text-sm font-medium">
                            <div className="flex items-center gap-1.5 bg-muted/50 px-3 py-1.5 rounded-xl border border-border/50">
                                <span className="text-foreground">Chapter {progress.chapter.index}</span>
                                <span className="text-muted-foreground/50 mx-1">•</span>
                                <span className="text-muted-foreground">{progress.chapter.title}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                                <Clock className="w-4 h-4" />
                                <span>{formatUpdateTime(new Date(progress.lastReadAt))}</span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6">
                        <div className="flex items-center justify-between text-sm font-bold mb-2">
                            <span className="text-muted-foreground">Overall Progress</span>
                            <span className="text-primary">{progress.progress.percent}%</span>
                        </div>
                        <div className="h-3 bg-muted rounded-full overflow-hidden border border-border/50 ring-2 ring-primary/5">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${progress.progress.percent}%` }}
                                transition={{ duration: 1, ease: "easeOut" }}
                                className="h-full bg-linear-to-r from-primary to-primary-foreground/30"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-center">
                    <Link href={url}
                        className="p-4 bg-primary text-primary-foreground rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/20 group/btn"
                    >
                        <ChevronRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                    </Link>
                </div>
            </div>
        </motion.div>
    );
}
