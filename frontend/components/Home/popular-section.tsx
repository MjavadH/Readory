"use client";

import { Crown } from "lucide-react";
import { useTranslations } from "next-intl";
import type { BookCardData } from "@/lib/types";
import {
    BookCarouselSection,
    BookCarouselSkeleton,
} from "@/components/Home/book-carousel-section";

export function PopularSection({ books }: { books: BookCardData[] }) {
    const t = useTranslations("HomePage");
    return (
        <BookCarouselSection
            books={books}
            icon={Crown}
            eyebrow={t("MostPopularDescription")}
            title={t("MostPopular")}
            ariaLabel={t("MostPopular")}
        />
    );
}

export function PopularSkeleton({ count = 8 }: { count?: number }) {
    return (
        <BookCarouselSkeleton
            icon={Crown}
            count={count}
            ariaLabel="Loading popular books"
        />
    );
}
