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
    CheckIcon,
    ChevronDown,
} from "lucide-react";
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
    DrawerFooter,
} from "@/components/ui/drawer";
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
import { AppIcon } from "@/components/AppIcon";
import { cn } from "@/lib/utils";

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

function FilterPillSkeleton({ count }: { count: number }) {
    return (
        <div className="flex flex-wrap gap-2">
            {Array.from({ length: count }).map((_, i) => (
                <div
                    key={i}
                    className="h-8 w-20 animate-pulse rounded-full bg-muted"
                />
            ))}
        </div>
    );
}

function FilterChip({
                        id,
                        label,
                        icon,
                        checked,
                        onToggle,
                    }: {
    id: string;
    label: string;
    icon?: React.ReactNode;
    checked: boolean;
    onToggle: () => void;
}) {
    return (
        <button
            type="button"
            id={id}
            role="checkbox"
            aria-checked={checked}
            onClick={onToggle}
            className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-all duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                checked
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border bg-background text-foreground hover:border-primary/50 hover:bg-accent",
            )}
        >
            {icon && (
                <span className={cn("shrink-0", checked ? "text-primary-foreground/80" : "text-muted-foreground")}>
                    {icon}
                </span>
            )}
            <span className="truncate">{label}</span>
            {checked && <CheckIcon className="ms-0.5 h-3 w-3 shrink-0 text-primary-foreground/80" />}
        </button>
    );
}

function FilterSectionHeading({
                                  icon,
                                  label,
                                  count,
                              }: {
    icon: React.ReactNode;
    label: string;
    count?: number;
}) {
    return (
        <div className="mb-3 flex items-center gap-2">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                {icon}
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {label}
            </span>
            {!!count && (
                <span className="ms-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                    {count}
                </span>
            )}
        </div>
    );
}

/** Desktop sidebar row item */
function SidebarFilterRow({
                              id,
                              label,
                              icon,
                              checked,
                              onToggle,
                          }: {
    id: string;
    label: string;
    icon?: React.ReactNode;
    checked: boolean;
    onToggle: () => void;
}) {
    return (
        <label
            htmlFor={id}
            className={cn(
                "group flex cursor-pointer items-center gap-2.5 rounded-lg border border-transparent px-2.5 py-1.5 text-sm transition-all duration-100",
                checked
                    ? "border-primary/20 bg-primary/5 text-foreground"
                    : "text-foreground/70 hover:bg-muted/50 hover:text-foreground",
            )}
        >
            <Checkbox
                id={id}
                checked={checked}
                onCheckedChange={onToggle}
                className="shrink-0"
            />
            {icon && (
                <span className={cn("shrink-0", checked ? "text-primary" : "text-muted-foreground group-hover:text-foreground/60")}>
                    {icon}
                </span>
            )}
            <span className="flex-1 truncate font-medium">{label}</span>
        </label>
    );
}

/** Mobile drawer filter content */
function FilterContent({
                           filters,
                           enableTypeFilter,
                           enableGenreFilter,
                           availableTypes,
                           availableGenres,
                           isLoadingTypes,
                           isLoadingGenres,
                           t,
                       }: {
    filters: BookBrowseLayoutProps["filters"];
    enableTypeFilter: boolean;
    enableGenreFilter: boolean;
    availableTypes: BookType[];
    availableGenres: BookGenre[];
    isLoadingTypes: boolean;
    isLoadingGenres: boolean;
    t: ReturnType<typeof useTranslations>;
}) {
    return (
        <div className="space-y-6 my-2">
            {enableTypeFilter && (
                <div>
                    <FilterSectionHeading
                        icon={<Layers className="h-3.5 w-3.5" />}
                        label={t("Category")}
                        count={filters.selectedTypes.length}
                    />
                    {isLoadingTypes ? (
                        <FilterPillSkeleton count={4} />
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {availableTypes.map((type) => (
                                <FilterChip
                                    key={type.slug}
                                    id={`type-${type.slug}`}
                                    label={type.name}
                                    icon={
                                        <AppIcon
                                            name={type.iconKey}
                                            className="h-3.5 w-3.5"
                                        />
                                    }
                                    checked={filters.selectedTypes.includes(type.slug)}
                                    onToggle={() => filters.handleTypeToggle(type.slug)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {enableGenreFilter && (
                <div>
                    <FilterSectionHeading
                        icon={<Tag className="h-3.5 w-3.5" />}
                        label={t("Genres")}
                        count={filters.selectedGenres.length}
                    />
                    {isLoadingGenres ? (
                        <FilterPillSkeleton count={8} />
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {availableGenres.map((genre) => (
                                <FilterChip
                                    key={genre.slug}
                                    id={`genre-${genre.slug}`}
                                    label={genre.name}
                                    icon={
                                        <AppIcon
                                            name={genre.iconKey}
                                            className="h-3.5 w-3.5"
                                        />
                                    }
                                    checked={filters.selectedGenres.includes(genre.slug)}
                                    onToggle={() =>
                                        filters.handleGenreToggle(genre.slug)
                                    }
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/** Desktop collapsible section */
function DesktopFilterSection({
                                  heading,
                                  defaultOpen = true,
                                  children,
                              }: {
    heading: React.ReactNode;
    defaultOpen?: boolean;
    children: React.ReactNode;
}) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div>
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="mb-2 flex w-full items-center gap-2 rounded-md px-1 py-1 text-left transition-colors hover:bg-muted/50"
                aria-expanded={open}
            >
                {heading}
                <ChevronDown
                    className={cn(
                        "ms-auto h-3.5 w-3.5 shrink-0 text-muted-foreground/60 transition-transform duration-200",
                        open ? "rotate-180" : "rotate-0",
                    )}
                />
            </button>
            {open && children}
        </div>
    );
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
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        {/* Search */}
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

                        {/* Sort + Mobile filter trigger */}
                        <div className="flex items-center gap-2">
                            <Select
                                value={filters.sortBy}
                                onValueChange={(v) =>
                                    filters.setSortBy(v as SortOption)
                                }
                            >
                                <SelectTrigger className="h-11 w-full rounded-xl border-border/70 bg-background/80 px-3 text-sm sm:w-48">
                                    <div className="flex items-center gap-2 truncate">
                                        <ArrowUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                                        <SelectValue />
                                    </div>
                                </SelectTrigger>
                                <SelectContent>
                                    {SORT_OPTIONS.map((o: { value: string; label: string }) => (
                                        <SelectItem key={o.value} value={o.value}>
                                            {o.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {/* Mobile: bottom Drawer trigger */}
                            <Drawer open={filtersOpen} onOpenChange={setFiltersOpen}>
                                <DrawerTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className="relative h-11 shrink-0 gap-2 rounded-xl border-border/70 bg-background/80 px-3.5 lg:hidden"
                                    >
                                        <SlidersHorizontal className="h-4 w-4" />
                                        <span className="text-sm font-medium">
                                            {t("Filters")}
                                        </span>
                                        {activeCount > 0 && (
                                            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                                                {activeCount}
                                            </span>
                                        )}
                                    </Button>
                                </DrawerTrigger>

                                {/* Mobile Drawer */}
                                <DrawerContent className="max-h-[92dvh]">
                                    <DrawerHeader className="px-5 pt-2 pb-0">
                                        <div className="flex items-center justify-between">
                                            <DrawerTitle className="flex items-center gap-2 text-base font-semibold">
                                                <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
                                                    <SlidersHorizontal className="h-4 w-4" />
                                                </span>
                                                {t("Filters")}
                                                {activeCount > 0 && (
                                                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                                                        {activeCount}
                                                    </span>
                                                )}
                                            </DrawerTitle>
                                            <DrawerClose asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    className="rounded-full text-muted-foreground"
                                                >
                                                    <X className="h-4 w-4" />
                                                    <span className="sr-only">Close</span>
                                                </Button>
                                            </DrawerClose>
                                        </div>

                                        {/* Active filter row */}
                                        {activeCount > 0 && (
                                            <div className="mt-3 flex flex-wrap gap-1.5 pb-3">
                                                {filters.selectedTypes.map((tt) => (
                                                    <Badge
                                                        key={tt}
                                                        variant="secondary"
                                                        className="gap-1 rounded-full border border-border/60 bg-background ps-2.5 pe-1 text-xs font-medium"
                                                    >
                                                        {bookTypeLabel(tt)}
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                filters.handleTypeToggle(tt)
                                                            }
                                                            className="ms-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted-foreground/20 hover:text-foreground"
                                                        >
                                                            <X className="h-2.5 w-2.5" />
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
                                                            className="gap-1 rounded-full border border-border/60 bg-background ps-2.5 pe-1 text-xs font-medium"
                                                        >
                                                            {g.name}
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    filters.handleGenreToggle(s)
                                                                }
                                                                className="ms-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted-foreground/20 hover:text-foreground"
                                                            >
                                                                <X className="h-2.5 w-2.5" />
                                                            </button>
                                                        </Badge>
                                                    ) : null;
                                                })}
                                            </div>
                                        )}
                                    </DrawerHeader>

                                    {/* Scrollable filter options */}
                                    <div className="flex-1 overflow-y-auto px-5 py-4">
                                        <FilterContent
                                            filters={filters}
                                            enableTypeFilter={enableTypeFilter}
                                            enableGenreFilter={enableGenreFilter}
                                            availableTypes={availableTypes}
                                            availableGenres={availableGenres}
                                            isLoadingTypes={isLoadingTypes}
                                            isLoadingGenres={isLoadingGenres}
                                            t={t}
                                        />
                                    </div>

                                    {/* Sticky footer actions */}
                                    <DrawerFooter className="gap-2 border-t border-border/60 bg-background/95 px-5 py-4 backdrop-blur">
                                        <div className="flex gap-2">
                                            {hasActiveFilters && (
                                                <Button
                                                    variant="outline"
                                                    className="flex-1 rounded-xl"
                                                    onClick={() => {
                                                        filters.clearFilters();
                                                    }}
                                                >
                                                    {t("ClearAll")}
                                                </Button>
                                            )}
                                            <DrawerClose asChild>
                                                <Button
                                                    className={cn(
                                                        "rounded-xl",
                                                        hasActiveFilters ? "flex-1" : "w-full",
                                                    )}
                                                >
                                                    {t("ShowResults")}
                                                </Button>
                                            </DrawerClose>
                                        </div>
                                    </DrawerFooter>
                                </DrawerContent>
                            </Drawer>
                        </div>
                    </div>

                    {/* Active filter badge strip */}
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

                <div className="flex gap-6 lg:gap-8">
                    {/* Desktop Sidebar */}
                    <aside className="hidden w-64 shrink-0 lg:block xl:w-72">
                        <div className="sticky top-20 flex max-h-[calc(100vh-6rem)] flex-col overflow-hidden rounded-2xl border border-border/60 bg-card/70 shadow-sm backdrop-blur">
                            {/* Sidebar header — always visible */}
                            <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-4 py-3.5">
                                <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary">
                                        <SlidersHorizontal className="h-3.5 w-3.5" />
                                    </span>
                                    {t("Filters")}
                                    {activeCount > 0 && (
                                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                                            {activeCount}
                                        </span>
                                    )}
                                </h2>
                                {hasActiveFilters && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={filters.clearFilters}
                                        className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                                    >
                                        {t("ClearAll")}
                                    </Button>
                                )}
                            </div>

                            {/* Sidebar scrollable body */}
                            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-thin">
                                <div className="space-y-1 p-3">

                                    {/* Types section */}
                                    {enableTypeFilter && (
                                        <DesktopFilterSection
                                            heading={
                                                <span className="flex items-center gap-2">
                                                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                                                        <Layers className="h-3 w-3" />
                                                    </span>
                                                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                                        {t("Category")}
                                                    </span>
                                                    {filters.selectedTypes.length > 0 && (
                                                        <span className="inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-primary/15 px-1 text-[10px] font-bold text-primary">
                                                            {filters.selectedTypes.length}
                                                        </span>
                                                    )}
                                                </span>
                                            }
                                        >
                                            {isLoadingTypes ? (
                                                <div className="space-y-1.5 px-1">
                                                    {Array.from({ length: 4 }).map((_, i) => (
                                                        <div
                                                            key={i}
                                                            className="h-8 animate-pulse rounded-lg bg-muted"
                                                        />
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="space-y-0.5 pb-1">
                                                    {availableTypes.map((type) => (
                                                        <SidebarFilterRow
                                                            key={type.slug}
                                                            id={`dt-type-${type.slug}`}
                                                            label={type.name}
                                                            icon={
                                                                <AppIcon
                                                                    name={type.iconKey}
                                                                    className="h-3.5 w-3.5"
                                                                />
                                                            }
                                                            checked={filters.selectedTypes.includes(type.slug)}
                                                            onToggle={() => filters.handleTypeToggle(type.slug)}
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                        </DesktopFilterSection>
                                    )}

                                    {enableTypeFilter && enableGenreFilter && (
                                        <Separator className="my-1" />
                                    )}

                                    {/* Genres section */}
                                    {enableGenreFilter && (
                                        <DesktopFilterSection
                                            heading={
                                                <span className="flex items-center gap-2">
                                                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                                                        <Tag className="h-3 w-3" />
                                                    </span>
                                                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                                        {t("Genres")}
                                                    </span>
                                                    {filters.selectedGenres.length > 0 && (
                                                        <span className="inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-primary/15 px-1 text-[10px] font-bold text-primary">
                                                            {filters.selectedGenres.length}
                                                        </span>
                                                    )}
                                                </span>
                                            }
                                        >
                                            {isLoadingGenres ? (
                                                <div className="space-y-1.5 px-1">
                                                    {Array.from({ length: 8 }).map((_, i) => (
                                                        <div
                                                            key={i}
                                                            className="h-8 animate-pulse rounded-lg bg-muted"
                                                        />
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="space-y-0.5 pb-1">
                                                    {availableGenres.map((genre) => (
                                                        <SidebarFilterRow
                                                            key={genre.slug}
                                                            id={`dt-genre-${genre.slug}`}
                                                            label={genre.name}
                                                            icon={
                                                                <AppIcon
                                                                    name={genre.iconKey}
                                                                    className="h-3.5 w-3.5"
                                                                />
                                                            }
                                                            checked={filters.selectedGenres.includes(genre.slug)}
                                                            onToggle={() => filters.handleGenreToggle(genre.slug)}
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                        </DesktopFilterSection>
                                    )}
                                </div>
                            </div>

                            {/* Subtle scroll indicator — bottom fade */}
                            <div
                                aria-hidden
                                className="pointer-events-none absolute inset-x-0 bottom-0 h-8 rounded-b-2xl bg-linear-to-t from-card/90 to-transparent"
                            />
                        </div>
                    </aside>

                    {/* Main content */}
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
                                        className="mt-10"
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