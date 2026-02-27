"use client";

import { useBookBrowser } from "@/hooks/use-book-browser";
import { BookBrowseLayout } from "@/components/book-browse-layout";
import {apiClient} from "@/lib/api-client";

export default function BooksClient({ initialData }: any) {
    const browser = useBookBrowser({
        baseUrl: "/books",
        fetcher: (params, signal) =>
            apiClient.get(`/books/browse?${params}`, { signal }),
        initialData: initialData.books,
    });

    return (
        <BookBrowseLayout
            title="Browse Books"
            description="Discover your next favorite manga, novel, or comic"
            books={browser.items}
            isLoading={browser.isLoading}
            isLoadingMore={browser.isLoadingMore}
            hasMore={browser.hasMore}
            loadMoreRef={browser.loadMoreRef}
            filters={browser.filters}
            availableTypes={initialData.types}
            availableGenres={initialData.genres}
        />
    );
}