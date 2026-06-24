"use client";

import React, { useState } from "react";
import { BookGrid, BookGridSkeleton } from "@/components/book-grid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Search,
    X,
    SlidersHorizontal,
    BookOpen,
    Tag,
    Layers,
    ArrowUpDown,
} from "lucide-react";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
    bookTypeLabel,
    SORT_OPTIONS,
    BookGenre,
    BookType,
    SortOption,
} from "@/lib/types";
import { useTranslations } from "next-intl";

interface BookBrowseLayoutProps {
    title: React.ReactNode;
    description: React.ReactNode;
    books: any[];
    isLoading: boolean;
    isLoadingMore: boolean;
    hasMore: boolean;
    loadMoreRef: React.RefObject<HTMLDivElement | null>;
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
    enableTypeFilter?: boolean;
    enableGenreFilter?: boolean;
    availableTypes: BookType[];
    availableGenres: BookGenre[];
    isLoadingTypes?: boolean;
    isLoadingGenres?: boolean;
    children?: React.ReactNode;
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
    const t = useTranslations("Books");

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        filters.setSearchQuery(filters.searchInput);
    };

    const activeCount =
        filters.selectedTypes.length + filters.selectedGenres.length;

    const hasActiveFilters =
        filters.selectedTypes.length > 0 ||
        filters.selectedGenres.length > 0 ||
        filters.searchQuery.trim().length > 0 ||
        filters.sortBy !== "recently_updated";

    const FilterSection: React.FC<{
        icon: React.ReactNode;
        label: string;
        count?: number;
        children: React.ReactNode;
    }> = ({ icon, label, count, children }) => (
        <div>
            <div className="mb-3 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <span className="text-foreground/70">{icon}</span>
                    {label}
                </h3>
                {count ? (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                        {count}
                    </span>
                ) : null}
            </div>
            {children}
        </div>
    );

    const FilterContent = () => (
        <div className="space-y-6">
            {enableTypeFilter && (
                <FilterSection
                    icon={<Layers className="h-3.5 w-3.5" />}
                    label={t("Category")}
                    count={filters.selectedTypes.length}
                >
                    <div className="space-y-1.5">
                        {isLoadingTypes ? (
                            <div className="space-y-2">
                                {Array.from({ length: 4 }).map((_, i) => (
                                    <div
                                        key={i}
                                        className="h-8 animate-pulse rounded-lg bg-muted"
                                    />
                                ))}
                            </div>
                        ) : (
                            availableTypes.map((type) => {
                                const checked = filters.selectedTypes.includes(
                                    type.slug,
                                );
                                return (
                                    <label
                                        key={type.slug}
                                        htmlFor={`type-${type.slug}`}
                                        className={`flex cursor-pointer items-center gap-3 rounded-lg border border-transparent px-2.5 py-2 text-sm transition-colors hover:bg-muted/60 ${
                                            checked
                                                ? "border-primary/30 bg-primary/5 text-foreground"
                                                : "text-foreground/80"
                                        }`}
                                    >
                                        <Checkbox
                                            id={`type-${type.slug}`}
                                            checked={checked}
                                            onCheckedChange={() =>
                                                filters.handleTypeToggle(type.slug)
                                            }
                                        />
                                        <span className="flex-1 truncate font-medium">
                                            {type.name}
                                        </span>
                                    </label>
                                );
                            })
                        )}
                    </div>
                </FilterSection>
            )}

            {enableTypeFilter && enableGenreFilter && <Separator />}

            {enableGenreFilter && (
                <FilterSection
                    icon={<Tag className="h-3.5 w-3.5" />}
                    label={t("Genres")}
                    count={filters.selectedGenres.length}
                >
                    {isLoadingGenres ? (
                        <div className="space-y-2">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <div
                                    key={i}
                                    className="h-8 animate-pulse rounded-lg bg-muted"
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="-me-2 max-h-105 space-y-1.5 overflow-y-auto pe-2">
                            {availableGenres.map((genre) => {
                                const checked = filters.selectedGenres.includes(
                                    genre.slug,
                                );
                                return (
                                    <label
                                        key={genre.slug}
                                        htmlFor={`genre-${genre.slug}`}
                                        className={`flex cursor-pointer items-center gap-3 rounded-lg border border-transparent px-2.5 py-2 text-sm transition-colors hover:bg-muted/60 ${
                                            checked
                                                ? "border-primary/30 bg-primary/5 text-foreground"
                                                : "text-foreground/80"
                                        }`}
                                    >
                                        <Checkbox
                                            id={`genre-${genre.slug}`}
                                            checked={checked}
                                            onCheckedChange={() =>
                                                filters.handleGenreToggle(genre.slug)
                                            }
                                        />
                                        <span className="flex-1 truncate font-medium">
                                            {genre.name}
                                        </span>
                                    </label>
                                );
                            })}
                        </div>
                    )}
                </FilterSection>
            )}
        </div>
    );

    return (
        <div className="relative min-h-screen bg-background">
            {/* Decorative gradient backdrop */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-105 overflow-hidden"
            >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,var(--color-primary),transparent_60%)]/[15]" />
                <div className="absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent via-border to-transparent" />
            </div>

            <div className="container mx-auto px-4 py-8 md:py-12 lg:py-16">
                {/* Hero header */}
                <header className="mb-8 md:mb-12">
                    <h1 className="mt-4 text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
                        {title}
                    </h1>
                    <div className="mt-3 max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
                        {description}
                    </div>
                </header>

                {/* Toolbar */}
                <div className="mb-6 rounded-2xl border border-border/60 bg-card/70 p-3 shadow-sm backdrop-blur supports-backdrop-filter:bg-card/50 md:p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center">
                        <form
                            onSubmit={handleSearch}
                            className="relative flex flex-1 items-center"
                        >
                            <Search className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground ltr:left-3.5 rtl:right-3.5" />
                            <Input
                                type="search"
                                placeholder={t("SearchPlaceholder")}
                                value={filters.searchInput}
                                onChange={(e) =>
                                    filters.setSearchInput(e.target.value)
                                }
                                className="h-11 rounded-xl border-border/70 bg-background/80 ps-10 pe-24 text-sm shadow-none focus-visible:ring-2 focus-visible:ring-primary/40"
                            />
                            <Button
                                type="submit"
                                size="sm"
                                className="absolute top-1/2 h-8 -translate-y-1/2 rounded-lg px-3 text-xs font-semibold ltr:right-1.5 rtl:left-1.5"
                            >
                                {t("Search")}
                            </Button>
                        </form>

                        <div className="flex items-center gap-2">
                            <Select
                                value={filters.sortBy}
                                onValueChange={(v) =>
                                    filters.setSortBy(v as SortOption)
                                }
                            >
                                <SelectTrigger className="h-11 w-full rounded-xl border-border/70 bg-background/80 px-3 text-sm md:w-50">
                                    <div className="flex items-center gap-2 truncate">
                                        <ArrowUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                                        <SelectValue />
                                    </div>
                                </SelectTrigger>
                                <SelectContent>
                                    {SORT_OPTIONS.map((o) => (
                                        <SelectItem key={o.value} value={o.value}>
                                            {o.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
                                <SheetTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className="relative h-11 shrink-0 rounded-xl border-border/70 bg-background/80 px-3 lg:hidden"
                                    >
                                        <SlidersHorizontal className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                                        <span className="text-sm font-medium">
                                            {t("Filters")}
                                        </span>
                                        {activeCount > 0 && (
                                            <span className="ms-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                                                {activeCount}
                                            </span>
                                        )}
                                    </Button>
                                </SheetTrigger>
                                <SheetContent
                                    side="right"
                                    className="w-full overflow-y-auto sm:max-w-sm rtl:sm:max-w-sm"
                                >
                                    <SheetHeader className="text-start">
                                        <SheetTitle className="flex items-center gap-2">
                                            <SlidersHorizontal className="h-5 w-5 text-primary" />
                                            {t("Filters")}
                                        </SheetTitle>
                                    </SheetHeader>
                                    <div className="mt-6">
                                        <FilterContent />
                                    </div>
                                    {hasActiveFilters && (
                                        <div className="sticky bottom-0 -mx-6 mt-6 border-t border-border bg-background/95 px-6 py-4 backdrop-blur">
                                            <Button
                                                variant="outline"
                                                className="w-full"
                                                onClick={() => {
                                                    filters.clearFilters();
                                                    setFiltersOpen(false);
                                                }}
                                            >
                                                {t("ClearAll")}
                                            </Button>
                                        </div>
                                    )}
                                </SheetContent>
                            </Sheet>
                        </div>
                    </div>

                    {hasActiveFilters && (
                        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
                            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                {t("ActiveFilters")}
                            </span>
                            {filters.selectedTypes.map((tt) => (
                                <Badge
                                    key={tt}
                                    variant="secondary"
                                    className="gap-1 rounded-full border border-border/60 bg-background ps-2.5 pe-1 font-medium"
                                >
                                    {bookTypeLabel(tt)}
                                    <button
                                        type="button"
                                        onClick={() => filters.handleTypeToggle(tt)}
                                        className="ms-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted-foreground/20 hover:text-foreground"
                                        aria-label={`Remove ${bookTypeLabel(tt)}`}
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </Badge>
                            ))}
                            {filters.selectedGenres.map((s) => {
                                const g = availableGenres.find(
                                    (ag) => ag.slug === s,
                                );
                                return g ? (
                                    <Badge
                                        key={s}
                                        variant="secondary"
                                        className="gap-1 rounded-full border border-border/60 bg-background ps-2.5 pe-1 font-medium"
                                    >
                                        {g.name}
                                        <button
                                            type="button"
                                            onClick={() =>
                                                filters.handleGenreToggle(s)
                                            }
                                            className="ms-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted-foreground/20 hover:text-foreground"
                                            aria-label={`Remove ${g.name}`}
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </Badge>
                                ) : null;
                            })}
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={filters.clearFilters}
                                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                            >
                                {t("ClearAll")}
                            </Button>
                        </div>
                    )}
                </div>

                <div className="flex gap-8">
                    {/* Desktop sidebar */}
                    <aside className="hidden w-72 shrink-0 lg:block">
                        <div className="sticky top-6 rounded-2xl border border-border/60 bg-card/70 p-5 shadow-sm backdrop-blur">
                            <div className="mb-5 flex items-center justify-between">
                                <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary">
                                        <SlidersHorizontal className="h-3.5 w-3.5" />
                                    </span>
                                    {t("Filters")}
                                </h2>
                                {hasActiveFilters && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={filters.clearFilters}
                                        className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                                    >
                                        {t("ClearAll")}
                                    </Button>
                                )}
                            </div>
                            <FilterContent />
                        </div>
                    </aside>

                    {/* Main */}
                    <main className="min-w-0 flex-1">
                        {isLoading ? (
                            <BookGridSkeleton count={18} />
                        ) : books.length === 0 ? (
                            <div className="flex min-h-105 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
                                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
                                    <BookOpen className="h-6 w-6" />
                                </div>
                                <h3 className="mt-4 text-lg font-semibold text-foreground">
                                    {t("NoBooksFound")}
                                </h3>
                                {hasActiveFilters && (
                                    <Button
                                        variant="outline"
                                        onClick={filters.clearFilters}
                                        className="mt-5 rounded-xl"
                                    >
                                        {t("ClearFilters")}
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <>
                                <BookGrid books={books} priorityCount={6} />
                                {hasMore && (
                                    <div
                                        ref={loadMoreRef}
                                        className="mt-10 flex justify-center"
                                    >
                                        {isLoadingMore && (
                                            <BookGridSkeleton count={12} />
                                        )}
                                    </div>
                                )}
                                {!hasMore && books.length > 0 && (
                                    <div className="mt-12 flex flex-col items-center gap-2 text-center">
                                        <div className="h-px w-16 bg-border" />
                                        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                            {t("ReachedEndList")}
                                        </p>
                                    </div>
                                )}
                            </>
                        )}
                    </main>
                </div>
            </div>
            {children}
        </div>
    );
}