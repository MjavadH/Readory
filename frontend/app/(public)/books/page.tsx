"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "@/lib/api-client";
import { BookGenre, BookType, BookCardData } from "@/lib/types";
import { useBookBrowser } from "@/hooks/use-book-browser";
import { BookBrowseLayout } from "@/components/book-browse-layout";

export default function BooksPage() {
    // 1. Fetch available Filters (Genres/Types)
    const [genres, setGenres] = useState<BookGenre[]>([]);
    const [bookTypes, setBookTypes] = useState<BookType[]>([]);
    const [loadingFilters, setLoadingFilters] = useState({ genres: true, types: true });

    useEffect(() => {
        apiClient.get<BookGenre[]>("/genres/listAll").then(data => {
            setGenres(data);
            setLoadingFilters(prev => ({ ...prev, genres: false }));
        });
        apiClient.get<BookType[]>("/public/book-types").then(data => {
            setBookTypes(data);
            setLoadingFilters(prev => ({ ...prev, types: false }));
        });
    }, []);

    // 2. Initialize Browser Hook
    const browser = useBookBrowser<any>({
        baseUrl: "/books",
        fetcher: (params, signal) => apiClient.get(`/books/browse?${params}`, { signal }),
    });

    // 3. Render Layout
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
            availableTypes={bookTypes}
            availableGenres={genres}
            isLoadingTypes={loadingFilters.types}
            isLoadingGenres={loadingFilters.genres}
        />
    );
}