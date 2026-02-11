"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { BookType } from "@/lib/types";
import { useBookBrowser } from "@/hooks/use-book-browser";
import { BookBrowseLayout } from "@/components/book-browse-layout";
import { AllGenresSection } from "@/components/all-genres-section";
import { notFound } from "next/navigation";

export default function GenrePage() {
    const { slug } = useParams() as { slug: string };
    const [bookTypes, setBookTypes] = useState<BookType[]>([]);
    const [isLoadingTypes, setIsLoadingTypes] = useState(true);

    useEffect(() => {
        apiClient.get<BookType[]>("/public/book-types")
            .then(setBookTypes)
            .finally(() => setIsLoadingTypes(false));
    }, []);

    const browser = useBookBrowser<any>({
        baseUrl: `/genres/${slug}`,
        fetcher: (params, signal) => apiClient.get(`/public/genres/${slug}/browse?${params}`, { signal }),
    });
    if (browser.isNotFound) {
        notFound();
    }

    const genreName = browser.data?.genre?.name || "Genre";
    const allGenres = browser.data?.allGenres || [];

    return (
        <BookBrowseLayout
            title={browser.isLoading && !browser.data ? <div className="h-10 w-48 animate-pulse rounded bg-muted" /> : `${genreName} Books`}
            description={`Explore our collection of ${genreName} books`}
            books={browser.items}
            isLoading={browser.isLoading}
            isLoadingMore={browser.isLoadingMore}
            hasMore={browser.hasMore}
            loadMoreRef={browser.loadMoreRef}
            filters={browser.filters}
            // Disable Genre filter, keep Type filter
            enableGenreFilter={false}
            availableTypes={bookTypes}
            availableGenres={[]}
            isLoadingTypes={isLoadingTypes}
        >
            {/* Extra Footer Section unique to this page */}
            {!browser.isLoading && allGenres.length > 0 && (
                <AllGenresSection genres={allGenres} />
            )}
        </BookBrowseLayout>
    );
}