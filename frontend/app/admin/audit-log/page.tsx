"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  Eye,
  FileSearch,
  ShieldCheck,
  RefreshCw,
  Search,
  Filter,
  X,
  Calendar,
  User,
  Globe,
  Hash,
  Clock,
} from "lucide-react";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { usePermission } from "@/hooks/use-permission";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppPagination } from "@/components/app-pagination";
import { cn } from "@/lib/utils";
import {
  AUDIT_ACTION_VALUES,
  AUDIT_CATEGORY_VALUES,
  AUDIT_SEVERITY_VALUES
} from "@readory/shared";

type DiffEntry = {
  path: string;
  label: string;
  type: "added" | "removed" | "modified";
  before?: unknown;
  after?: unknown;
  children?: DiffEntry[];
  collapsed?: boolean;
};
type AuditLog = {
  id: string;
  createdAt: string;
  actorName?: string;
  actorId?: string;
  actorRole?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  action: string;
  category: string;
  severity: string;
  targetType?: string;
  targetId?: string;
  targetName?: string;
  metadata?: unknown;
  before?: unknown;
  after?: unknown;
  diff?: DiffEntry[];
};
type AuditResponse = {
  data: AuditLog[];
  total: number;
  page: number;
  limit: number;
  lastPage: number;
};

const fetcher = (url: string) => apiClient.get<AuditResponse>(url);
const detailFetcher = (url: string) => apiClient.get<AuditLog>(url);

function actionTone(action: string) {
  if (action.includes("CREATED"))
    return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20";
  if (action.includes("UPDATED"))
    return "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20";
  if (action.includes("DELETED") || action.includes("BANNED"))
    return "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20";
  if (action.includes("SENT") || action.includes("SETTINGS"))
    return "bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/20";
  return "bg-muted text-foreground border-border";
}

function severityTone(sev: string) {
  switch (sev) {
    case "CRITICAL":
      return "bg-red-600 text-white border-transparent";
    case "HIGH":
      return "bg-orange-500 text-white border-transparent";
    case "MEDIUM":
    case "WARNING":
      return "bg-amber-500 text-white border-transparent";
    case "LOW":
    case "INFO":
      return "bg-sky-500 text-white border-transparent";
    default:
      return "bg-muted text-foreground border-border";
  }
}

function initials(name?: string) {
  if (!name) return "?";
  return name
      .split(/\s+/)
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
}

function JsonBlock({ value }: { value: unknown }) {
  return (
      <pre className="max-h-96 overflow-auto rounded-lg border bg-muted/50 p-3 text-xs leading-relaxed">
      {JSON.stringify(value ?? null, null, 2)}
    </pre>
  );
}

function DiffRows({ entries }: { entries: DiffEntry[] }) {
  if (!entries?.length) {
    return (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          —
        </div>
    );
  }
  return (
      <div className="space-y-2">
        {entries.map((entry) => (
            <details
                key={entry.path}
                open={!entry.collapsed}
                className="group rounded-lg border bg-card transition-colors hover:bg-accent/30"
            >
              <summary className="flex cursor-pointer items-center justify-between gap-2 rounded-lg p-3 text-sm font-medium">
            <span className="flex items-center gap-2">
              <span
                  className={cn(
                      "inline-block h-2 w-2 rounded-full",
                      entry.type === "added" && "bg-emerald-500",
                      entry.type === "removed" && "bg-red-500",
                      entry.type === "modified" && "bg-sky-500",
                  )}
              />
              {entry.label}
            </span>
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
              {entry.type}
            </span>
              </summary>
              <div className="border-t p-3">
                {entry.children?.length ? (
                    <DiffRows entries={entry.children} />
                ) : (
                    <div className="grid gap-2 md:grid-cols-2">
                      <div className="rounded-md border border-red-500/20 bg-red-500/5 p-3 text-xs">
                        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-red-600 dark:text-red-400">
                          − Before
                        </div>
                        <div className="break-all font-mono text-foreground/80">
                          {String(entry.before ?? "null")}
                        </div>
                      </div>
                      <div
                          className={cn(
                              "rounded-md border p-3 text-xs",
                              entry.type === "added"
                                  ? "border-emerald-500/20 bg-emerald-500/5"
                                  : "border-sky-500/20 bg-sky-500/5",
                          )}
                      >
                        <div
                            className={cn(
                                "mb-1 text-[10px] font-semibold uppercase tracking-wider",
                                entry.type === "added"
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-sky-600 dark:text-sky-400",
                            )}
                        >
                          + After
                        </div>
                        <div className="break-all font-mono text-foreground/80">
                          {String(entry.after ?? "null")}
                        </div>
                      </div>
                    </div>
                )}
              </div>
            </details>
        ))}
      </div>
  );
}

export default function AuditLogPage() {
  const t = useTranslations("AdminPage.AuditLog");
  const router = useRouter();
  const params = useSearchParams();
  const pathname = usePathname();
  const { has, loading } = usePermission();

  const [search, setSearch] = useState(params.get("search") ?? "");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const page = Number(params.get("page") ?? 1);
  const limit = Number(params.get("limit") ?? 20);
  const query = useMemo(() => params.toString(), [params]);

  const { data, error, isLoading, isValidating, mutate } = useSWR(
      `/admin/audit-logs?${query || `page=${page}&limit=${limit}`}`,
      fetcher,
      {
        keepPreviousData: true,
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        revalidateIfStale: false,
      },
  );

  const { data: detail } = useSWR(
      selectedId ? `/admin/audit-logs/${selectedId}` : null,
      detailFetcher,
      { revalidateOnFocus: false },
  );

  const updateParam = useCallback(
      (key: string, value: string | null, resetPage = false) => {
        const next = new URLSearchParams(params.toString());
        if (value) next.set(key, value);
        else next.delete(key);
        if (resetPage) next.set("page", "1");
        router.replace(`${pathname}?${next.toString()}`);
      },
      [params, pathname, router],
  );

  useEffect(() => {
    const id = setTimeout(() => {
      if (search !== (params.get("search") ?? "")) {
        updateParam("search", search || null, true);
      }
    }, 350);
    return () => clearTimeout(id);
  }, [search, params, updateParam]);

  useEffect(() => {
    if (!loading && !has("MANAGE_STAFF")) router.replace("/admin");
  }, [loading, has, router]);

  if (loading || !has("MANAGE_STAFF")) return null;

  const activeFilterCount = [
    params.get("from"),
    params.get("to"),
    params.get("action"),
    params.get("category"),
    params.get("severity"),
  ].filter(Boolean).length;

  const clearFilters = () => {
    const next = new URLSearchParams();
    if (search) next.set("search", search);
    router.replace(`${pathname}?${next.toString()}`);
  };

  return (
      <div className="mx-auto w-full max-w-400 space-y-4 p-3 sm:p-4 md:space-y-6 md:p-6">
        {/* Header */}
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">
                {t("Title")}
              </h1>
              <p className="truncate text-xs text-muted-foreground sm:text-sm">
                {t("Description")}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {data && (
                <div className="hidden rounded-md border bg-card px-3 py-1.5 text-xs text-muted-foreground sm:block">
                  <span className="font-semibold text-foreground">{data.total}</span>{" "}
                  {t("Logs")}
                </div>
            )}
            <Button
                variant="outline"
                size="sm"
                onClick={() => mutate()}
                disabled={isValidating}
                className="gap-2"
            >
              <RefreshCw
                  className={cn("h-4 w-4", isValidating && "animate-spin")}
              />
              <span className="hidden sm:inline">{t("Refresh")}</span>
            </Button>
          </div>
        </header>

        {/* Search + filter toggle bar */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute inset-s-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
                placeholder={t("SearchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="ps-9 pe-9"
            />
            {search && (
                <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute inset-e-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                    aria-label="Clear"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
                variant="outline"
                size="sm"
                onClick={() => setFiltersOpen((v) => !v)}
                className="flex-1 gap-2 sm:flex-none"
            >
              <Filter className="h-4 w-4" />
              {t("Filters")}
              {activeFilterCount > 0 && (
                  <span className="ms-1 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                {activeFilterCount}
              </span>
              )}
            </Button>
            {activeFilterCount > 0 && (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="gap-1 text-muted-foreground"
                >
                  <X className="h-4 w-4" />
                  <span className="hidden sm:inline">Clear</span>
                </Button>
            )}
          </div>
        </div>

        {/* Filters panel */}
        {filtersOpen && (
            <Card className="border-dashed">
              <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
                <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                {t("From")}
              </span>
                  <Input
                      type="date"
                      value={params.get("from") ?? ""}
                      onChange={(e) => updateParam("from", e.target.value, true)}
                  />
                </label>
                <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                {t("To")}
              </span>
                  <Input
                      type="date"
                      value={params.get("to") ?? ""}
                      onChange={(e) => updateParam("to", e.target.value, true)}
                  />
                </label>
                <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                {t("Action")}
              </span>
                  <NativeSelect
                      className="w-full"
                      value={params.get("action") ?? ""}
                      onChange={(e) =>
                          updateParam("action", e.target.value || null, true)
                      }
                  >
                    <option value="">{t("AllActions")}</option>
                    {AUDIT_ACTION_VALUES.map((a) => (
                        <option key={a}>{a}</option>
                    ))}
                  </NativeSelect>
                </label>
                <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                {t("Category")}
              </span>
                  <NativeSelect
                      className="w-full"
                      value={params.get("category") ?? ""}
                      onChange={(e) =>
                          updateParam("category", e.target.value || null, true)
                      }
                  >
                    <option value="">{t("AllCategories")}</option>
                    {AUDIT_CATEGORY_VALUES.map((c) => (
                        <option key={c}>{c}</option>
                    ))}
                  </NativeSelect>
                </label>
                <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                {t("Severity")}
              </span>
                  <NativeSelect
                      className="w-full"
                      value={params.get("severity") ?? ""}
                      onChange={(e) =>
                          updateParam("severity", e.target.value || null, true)
                      }
                  >
                    <option value="">{t("AllSeverities")}</option>
                    {AUDIT_SEVERITY_VALUES.map((s) => (
                        <option key={s}>{s}</option>
                    ))}
                  </NativeSelect>
                </label>
              </CardContent>
            </Card>
        )}

        {/* Error */}
        {error && (
            <Card className="border-destructive/40 bg-destructive/5">
              <CardContent className="flex items-start gap-3 p-4 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                <div className="min-w-0 flex-1 wrap-break-word">
                  {getApiErrorMessage(error)}
                </div>
                <Button
                    size="sm"
                    variant="outline"
                    onClick={() => mutate()}
                    className="shrink-0"
                >
                  {t("Refresh")}
                </Button>
              </CardContent>
            </Card>
        )}

        {/* Results */}
        {!error && (
            <>
              {/* Desktop table */}
              <Card className="hidden overflow-hidden md:block">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        {[
                          "DateTime",
                          "Admin",
                          "Action",
                          "Category",
                          "TargetType",
                          "Target",
                          "Severity",
                          "IpAddress",
                          "Details",
                        ].map((k) => (
                            <TableHead key={k} className="whitespace-nowrap text-xs font-semibold uppercase tracking-wide">
                              {t(k)}
                            </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                          Array.from({ length: 8 }).map((_, i) => (
                              <TableRow key={i}>
                                <TableCell colSpan={9}>
                                  <Skeleton className="h-8 w-full" />
                                </TableCell>
                              </TableRow>
                          ))
                      ) : data?.data.length ? (
                          data.data.map((log) => (
                              <TableRow
                                  key={log.id}
                                  className="cursor-pointer transition-colors hover:bg-accent/50"
                                  onClick={() => setSelectedId(log.id)}
                              >
                                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                                  <div className="flex items-center gap-2">
                                    <Clock className="h-3.5 w-3.5" />
                                    {new Date(log.createdAt).toLocaleString()}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                                      {initials(log.actorName ?? log.actorId)}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="truncate text-sm font-medium">
                                        {log.actorName ?? log.actorId ?? "—"}
                                      </div>
                                      {log.actorRole && (
                                          <div className="truncate text-[10px] uppercase text-muted-foreground">
                                            {log.actorRole}
                                          </div>
                                      )}
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge
                                      variant="outline"
                                      className={cn("border font-mono text-[11px]", actionTone(log.action))}
                                  >
                                    {log.action}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {log.category}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {log.targetType ?? "—"}
                                </TableCell>
                                <TableCell className="max-w-45 truncate text-sm">
                                  {log.targetName ?? log.targetId ?? "—"}
                                </TableCell>
                                <TableCell>
                                  <Badge className={cn("border text-[10px]", severityTone(log.severity))}>
                                    {log.severity}
                                  </Badge>
                                </TableCell>
                                <TableCell className="font-mono text-xs text-muted-foreground">
                                  {log.ipAddress ?? "—"}
                                </TableCell>
                                <TableCell>
                                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                          ))
                      ) : (
                          <TableRow>
                            <TableCell colSpan={9} className="h-52 text-center">
                              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                <div className="grid h-12 w-12 place-items-center rounded-full bg-muted">
                                  <FileSearch className="h-5 w-5" />
                                </div>
                                <div className="text-sm font-medium">{t("Empty")}</div>
                              </div>
                            </TableCell>
                          </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </Card>

              {/* Mobile cards */}
              <div className="space-y-2 md:hidden">
                {isLoading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                        <Card key={i}>
                          <CardContent className="p-3">
                            <Skeleton className="mb-2 h-4 w-1/2" />
                            <Skeleton className="mb-2 h-4 w-3/4" />
                            <Skeleton className="h-4 w-1/3" />
                          </CardContent>
                        </Card>
                    ))
                ) : data?.data.length ? (
                    data.data.map((log) => (
                        <button
                            key={log.id}
                            onClick={() => setSelectedId(log.id)}
                            className="block w-full text-start"
                        >
                          <Card className="transition-colors hover:bg-accent/40 active:scale-[0.99]">
                            <CardContent className="space-y-3 p-3">
                              <div className="flex items-start justify-between gap-2">
                                <Badge
                                    variant="outline"
                                    className={cn("border font-mono text-[10px]", actionTone(log.action))}
                                >
                                  {log.action}
                                </Badge>
                                <Badge className={cn("border text-[10px]", severityTone(log.severity))}>
                                  {log.severity}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                                  {initials(log.actorName ?? log.actorId)}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-sm font-semibold">
                                    {log.actorName ?? log.actorId ?? "—"}
                                  </div>
                                  <div className="truncate text-xs text-muted-foreground">
                                    {log.category}
                                    {log.targetType ? ` • ${log.targetType}` : ""}
                                  </div>
                                </div>
                              </div>
                              {(log.targetName || log.targetId) && (
                                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <Hash className="h-3 w-3 shrink-0" />
                                    <span className="truncate">
                            {log.targetName ?? log.targetId}
                          </span>
                                  </div>
                              )}
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-2 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(log.createdAt).toLocaleString()}
                        </span>
                                {log.ipAddress && (
                                    <span className="flex items-center gap-1 font-mono">
                            <Globe className="h-3 w-3" />
                                      {log.ipAddress}
                          </span>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        </button>
                    ))
                ) : (
                    <Card>
                      <CardContent className="flex flex-col items-center gap-2 p-8 text-center text-muted-foreground">
                        <div className="grid h-12 w-12 place-items-center rounded-full bg-muted">
                          <FileSearch className="h-5 w-5" />
                        </div>
                        <div className="text-sm font-medium">{t("Empty")}</div>
                      </CardContent>
                    </Card>
                )}
              </div>
            </>
        )}

        {/* Pagination */}
        {data && data.lastPage > 1 && (
            <AppPagination
                currentPage={data.page}
                totalPages={data.lastPage}
                totalItems={data.total}
                pageSize={data.limit}
                itemLabel={t("Logs")}
                onPageChange={(next) => updateParam("page", String(next))}
            />
        )}

        {/* Detail sheet */}
        <Sheet
            open={!!selectedId}
            onOpenChange={(open) => !open && setSelectedId(null)}
        >
          <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-3xl">
            <SheetHeader className="sticky top-0 z-10 border-b bg-background/95 p-4 backdrop-blur">
              <SheetTitle className="flex items-center gap-2">
                <FileSearch className="h-5 w-5 text-primary" />
                {t("Details")}
              </SheetTitle>
            </SheetHeader>
            {detail ? (
                <div className="space-y-4 p-4">
                  {/* Summary */}
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                        variant="outline"
                        className={cn("border font-mono text-xs", actionTone(detail.action))}
                    >
                      {detail.action}
                    </Badge>
                    <Badge className={cn("border text-xs", severityTone(detail.severity))}>
                      {detail.severity}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {detail.category}
                    </Badge>
                  </div>

                  {/* Meta grid */}
                  <Card>
                    <CardContent className="grid gap-3 p-4 text-sm sm:grid-cols-2">
                      <div className="flex items-start gap-2">
                        <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <div className="text-[10px] uppercase text-muted-foreground">
                            {t("DateTime")}
                          </div>
                          <div className="truncate">
                            {new Date(detail.createdAt).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <User className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <div className="text-[10px] uppercase text-muted-foreground">
                            {t("Admin")}
                          </div>
                          <div className="truncate">
                            {detail.actorName ?? detail.actorId ?? "—"}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Hash className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <div className="text-[10px] uppercase text-muted-foreground">
                            {t("Target")}
                          </div>
                          <div className="truncate font-mono text-xs">
                            {detail.targetType ?? "—"} / {detail.targetId ?? "—"}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Globe className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <div className="text-[10px] uppercase text-muted-foreground">
                            {t("IpAddress")}
                          </div>
                          <div className="truncate font-mono text-xs">
                            {detail.ipAddress ?? "—"}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 sm:col-span-2">
                        <Hash className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <div className="text-[10px] uppercase text-muted-foreground">
                            {t("RequestId")}
                          </div>
                          <div className="truncate font-mono text-xs">
                            {detail.requestId ?? "—"}
                          </div>
                        </div>
                      </div>
                      {detail.userAgent && (
                          <div className="flex items-start gap-2 sm:col-span-2">
                            <Globe className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                            <div className="min-w-0 flex-1">
                              <div className="text-[10px] uppercase text-muted-foreground">
                                {t("UserAgent")}
                              </div>
                              <div className="break-all font-mono text-xs text-muted-foreground">
                                {detail.userAgent}
                              </div>
                            </div>
                          </div>
                      )}
                    </CardContent>
                  </Card>

                  <Tabs defaultValue="diff">
                    <TabsList className="w-full">
                      <TabsTrigger value="diff" className="flex-1">
                        {t("DiffView")}
                      </TabsTrigger>
                      <TabsTrigger value="raw" className="flex-1">
                        {t("RawJson")}
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="diff" className="mt-4">
                      <DiffRows entries={detail.diff ?? []} />
                    </TabsContent>
                    <TabsContent value="raw" className="mt-4 space-y-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Before
                          </div>
                          <JsonBlock value={detail.before} />
                        </div>
                        <div>
                          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            After
                          </div>
                          <JsonBlock value={detail.after} />
                        </div>
                      </div>
                      <div>
                        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Metadata
                        </div>
                        <JsonBlock value={detail.metadata} />
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
            ) : (
                <div className="space-y-3 p-4">
                  <Skeleton className="h-6 w-1/3" />
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-40 w-full" />
                </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
  );
}
