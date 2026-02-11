"use client";

import React, { useState } from "react";
import { BookGrid, BookGridSkeleton } from "@/components/book-grid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, X, Filter, SlidersHorizontal } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { bookTypeLabel, SORT_OPTIONS, BookGenre, BookType, SortOption } from "@/lib/types";

interface BookBrowseLayoutProps {
    title: React.ReactNode;
    description: React.ReactNode;
    books: any[];
    isLoading: boolean;
    isLoadingMore: boolean;
    hasMore: boolean;
    loadMoreRef: React.RefObject<HTMLDivElement | null>;
    // Filter State from Hook
    filters: {
        selectedTypes: string[];
        selectedGenres: string[];
        sortBy: SortOption;
        searchInput: string;
        searchQuery: string;
        setSearchInput: (v: string) => void;
        setSortBy: (v: SortOption) => void;
        setSearchQuery: (v: string) => void;
        handleTypeToggle: (v: string) => void;
        handleGenreToggle: (v: string) => void;
        clearFilters: () => void;
    };
    // Configuration
    enableTypeFilter?: boolean;
    enableGenreFilter?: boolean;
    availableTypes: BookType[];
    availableGenres: BookGenre[];
    isLoadingTypes?: boolean;
    isLoadingGenres?: boolean;
    children?: React.ReactNode; // For extra sections like "All Genres"
}

export function BookBrowseLayout({
                                     title,
                                     description,
                                     books,
                                     isLoading,
                                     isLoadingMore,
                                     hasMore,
                                     loadMoreRef,
                                     filters,
                                     enableTypeFilter = true,
                                     enableGenreFilter = true,
                                     availableTypes,
                                     availableGenres,
                                     isLoadingTypes = false,
                                     isLoadingGenres = false,
                                     children,
                                 }: BookBrowseLayoutProps) {
    const [filtersOpen, setFiltersOpen] = useState(false);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        filters.setSearchQuery(filters.searchInput);
    };

    const hasActiveFilters =
        filters.selectedTypes.length > 0 ||
        filters.selectedGenres.length > 0 ||
        filters.searchQuery.trim().length > 0 ||
        filters.sortBy !== "recently_updated";

    const FilterContent = () => (
        <div className="space-y-6">
            {enableTypeFilter && (
                <div>
                    <h3 className="mb-3 text-sm font-semibold">Category</h3>
                    <div className="space-y-2">
                        {isLoadingTypes ? (
                            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-5 animate-pulse rounded bg-muted" />)}</div>
                        ) : (
                            availableTypes.map((type) => (
                                <div key={type.slug} className="flex items-center space-x-2">
                                    <Checkbox id={`type-${type.slug}`} checked={filters.selectedTypes.includes(type.slug)} onCheckedChange={() => filters.handleTypeToggle(type.slug)} />
                                    <Label htmlFor={`type-${type.slug}`} className="cursor-pointer text-sm font-normal">{type.name}</Label>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {enableTypeFilter && enableGenreFilter && <Separator />}

            {enableGenreFilter && (
                <div>
                    <h3 className="mb-3 text-sm font-semibold">Genres</h3>
                    {isLoadingGenres ? (
                        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-5 animate-pulse rounded bg-muted" />)}</div>
                    ) : (
                        <div className="max-h-[400px] space-y-2 overflow-y-auto pr-2">
                            {availableGenres.map((genre) => (
                                <div key={genre.slug} className="flex items-center space-x-2">
                                    <Checkbox id={`genre-${genre.slug}`} checked={filters.selectedGenres.includes(genre.slug)} onCheckedChange={() => filters.handleGenreToggle(genre.slug)} />
                                    <Label htmlFor={`genre-${genre.slug}`} className="cursor-pointer text-sm font-normal">{genre.name}</Label>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );

    return (
        <div className="min-h-screen bg-background">
            <div className="container mx-auto px-4 py-6 md:py-8">
                {/* Header */}
                <div className="mb-6 md:mb-8">
                    <h1 className="text-balance text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>
                    <div className="mt-2 text-pretty text-muted-foreground">{description}</div>
                </div>

                {/* Filters Bar */}
                <div className="mb-6 space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row">
                        {/* Search */}
                        <form onSubmit={handleSearch} className="flex flex-1 gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input type="search" placeholder="Search..." value={filters.searchInput} onChange={(e) => filters.setSearchInput(e.target.value)} className="pl-10" />
                            </div>
                            <Button type="submit" variant="secondary">Search</Button>
                        </form>

                        {/* Sort */}
                        <Select value={filters.sortBy} onValueChange={(v) => filters.setSortBy(v as SortOption)}>
                            <SelectTrigger className="w-full sm:w-[200px]"><SelectValue /></SelectTrigger>
                            <SelectContent>{SORT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                        </Select>

                        {/* Mobile Filters */}
                        <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
                            <SheetTrigger asChild>
                                <Button variant="outline" className="sm:hidden bg-transparent">
                                    <SlidersHorizontal className="mr-2 h-4 w-4" /> Filters
                                    {hasActiveFilters && <Badge variant="secondary" className="ml-2 h-5 min-w-5 px-1">{filters.selectedTypes.length + filters.selectedGenres.length}</Badge>}
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="left" className="w-80 overflow-y-auto">
                                <SheetHeader><SheetTitle>Filters</SheetTitle></SheetHeader>
                                <div className="mt-6"><FilterContent /></div>
                            </SheetContent>
                        </Sheet>
                    </div>

                    {/* Active Filters Display */}
                    {hasActiveFilters && (
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm text-muted-foreground">Active filters:</span>
                            {/* Render filter pills logic... (Simplified for brevity, same as original) */}
                            {filters.selectedTypes.map(t => (
                                <Badge key={t} variant="secondary" className="gap-1 pl-2 pr-1">{bookTypeLabel(t)}<button onClick={() => filters.handleTypeToggle(t)} className="rounded-full p-0.5 hover:bg-muted-foreground/20"><X className="h-3 w-3" /></button></Badge>
                            ))}
                            {filters.selectedGenres.map(s => {
                                const g = availableGenres.find(ag => ag.slug === s);
                                return g ? <Badge key={s} variant="secondary" className="gap-1 pl-2 pr-1">{g.name}<button onClick={() => filters.handleGenreToggle(s)} className="rounded-full p-0.5 hover:bg-muted-foreground/20"><X className="h-3 w-3" /></button></Badge> : null;
                            })}
                            <Button variant="ghost" size="sm" onClick={filters.clearFilters} className="h-7">Clear all</Button>
                        </div>
                    )}
                </div>

                <div className="flex gap-6">
                    {/* Desktop Sidebar */}
                    <aside className="hidden w-64 shrink-0 sm:block">
                        <div className="sticky top-6 rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
                            <div className="mb-4 flex items-center justify-between">
                                <h2 className="flex items-center gap-2 text-lg font-semibold"><Filter className="h-5 w-5" /> Filters</h2>
                                {hasActiveFilters && <Button variant="ghost" size="sm" onClick={filters.clearFilters} className="h-8 text-xs">Clear</Button>}
                            </div>
                            <FilterContent />
                        </div>
                    </aside>

                    {/* Main Content */}
                    <main className="flex-1">
                        {isLoading ? <BookGridSkeleton count={24} /> : books.length === 0 ? (
                            <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
                                <Search className="h-8 w-8 text-muted-foreground mb-4" />
                                <h3 className="text-lg font-semibold">No books found</h3>
                                {hasActiveFilters && <Button variant="outline" onClick={filters.clearFilters} className="mt-4">Clear filters</Button>}
                            </div>
                        ) : (
                            <>
                                <BookGrid books={books} priorityCount={6} />
                                {hasMore && <div ref={loadMoreRef} className="mt-8 flex justify-center">{isLoadingMore && <BookGridSkeleton count={12} />}</div>}
                                {!hasMore && books.length > 0 && <p className="mt-8 text-center text-sm text-muted-foreground">You've reached the end of the list</p>}
                            </>
                        )}
                    </main>
                </div>
            </div>
            {children}
        </div>
    );
}