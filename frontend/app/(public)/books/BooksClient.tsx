"use client";

import { useBookBrowser } from "@/hooks/use-book-browser";
import { BookBrowseLayout } from "@/components/book-browse-layout";
import {apiClient} from "@/lib/api-client";
import {useTranslations} from "next-intl";
import React, {useEffect, useState} from "react";
import {BookType} from "@/lib/types";

export default function BooksClient({ initialData }: any) {
    const t = useTranslations('Books');

    const browser = useBookBrowser({
        baseUrl: "/books",
        fetcher: (params, signal) =>
            apiClient.get(`/books/browse?${params}`, { signal }),
        initialData: initialData.books,
    });

    return (
        <BookBrowseLayout
            title={browser.isLoading && !browser.data ? <div className="h-10 w-48 animate-pulse rounded bg-muted" /> : t("BrowseBooks", {Books: t("Books")})}
            description={t("BrowseBooksDescription" , {type: t("Books")})}
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