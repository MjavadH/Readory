"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertTriangle, Eye, FileSearch, ShieldCheck } from "lucide-react";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { usePermission } from "@/hooks/use-permission";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
const actions = [
  "BOOK_CREATED",
  "BOOK_UPDATED",
  "BOOK_DELETED",
  "CHAPTER_CREATED",
  "CHAPTER_UPDATED",
  "CHAPTER_DELETED",
  "GENRE_CREATED",
  "GENRE_UPDATED",
  "GENRE_DELETED",
  "USER_BANNED",
  "USER_UNBANNED",
  "STAFF_CREATED",
  "STAFF_UPDATED",
  "STAFF_DELETED",
  "SETTINGS_UPDATED",
  "BROADCAST_SENT",
];
const categories = [
  "CONTENT",
  "USER",
  "STAFF",
  "FINANCE",
  "SYSTEM",
  "SECURITY",
];
const severities = ["LOW", "MEDIUM", "HIGH", "CRITICAL", "INFO", "WARNING"];

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="max-h-96 overflow-auto rounded-lg bg-muted p-4 text-xs">
      {JSON.stringify(value ?? null, null, 2)}
    </pre>
  );
}
function DiffRows({ entries }: { entries: DiffEntry[] }) {
  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <details
          key={entry.path}
          open={!entry.collapsed}
          className="rounded-lg border p-3"
        >
          <summary className="cursor-pointer font-medium">
            {entry.label}
          </summary>
          {entry.children?.length ? (
            <div className="mt-3">
              <DiffRows entries={entry.children} />
            </div>
          ) : (
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <div className="rounded bg-red-500/10 p-2 text-sm text-red-700">
                <div className="text-xs font-semibold uppercase">Before</div>-{" "}
                {String(entry.before ?? "null")}
              </div>
              <div
                className={cn(
                  "rounded p-2 text-sm",
                  entry.type === "added"
                    ? "bg-green-500/10 text-green-700"
                    : "bg-blue-500/10 text-blue-700",
                )}
              >
                <div className="text-xs font-semibold uppercase">After</div>+{" "}
                {String(entry.after ?? "null")}
              </div>
            </div>
          )}
        </details>
      ))}
    </div>
  );
}

export default function AuditLogPage() {
  const t = useTranslations("AdminPage.AuditLog");
  const router = useRouter();
  const params = useSearchParams();
  const { has, loading } = usePermission();
  const [search, setSearch] = useState(params.get("search") ?? "");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const page = Number(params.get("page") ?? 1);
  const limit = Number(params.get("limit") ?? 20);
  const query = useMemo(() => params.toString(), [params]);
  const { data, error, isLoading } = useSWR(
    `/admin/audit-logs?${query || `page=${page}&limit=${limit}`}`,
    fetcher,
    { keepPreviousData: true, refreshInterval: 30000 },
  );
  const { data: detail } = useSWR(
    selectedId ? `/admin/audit-logs/${selectedId}` : null,
    detailFetcher,
  );

  const updateParam = useCallback(
    (key: string, value: string | null, resetPage = false) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      if (resetPage) next.set("page", "1");
      router.replace(`/admin/audit-log?${next.toString()}`);
    },
    [params, router],
  );

  useEffect(() => {
    const id = setTimeout(
      () => updateParam("search", search || null, true),
      350,
    );
    return () => clearTimeout(id);
  }, [search, updateParam]);
  useEffect(() => {
    if (!loading && !has("MANAGE_STAFF")) router.replace("/admin");
  }, [loading, has, router]);
  if (loading || !has("MANAGE_STAFF")) return null;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">{t("Title")}</h1>
          <p className="text-muted-foreground">{t("Description")}</p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("Filters")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Input
            placeholder={t("SearchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Input
            type="date"
            onChange={(e) => updateParam("from", e.target.value, true)}
          />
          <Input
            type="date"
            onChange={(e) => updateParam("to", e.target.value, true)}
          />
          <NativeSelect
            className="w-full"
            value={params.get("action") ?? ""}
            onChange={(e) =>
              updateParam("action", e.target.value || null, true)
            }
          >
            <option value="">{t("AllActions")}</option>
            {actions.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </NativeSelect>
          <NativeSelect
            className="w-full"
            value={params.get("category") ?? ""}
            onChange={(e) =>
              updateParam("category", e.target.value || null, true)
            }
          >
            <option value="">{t("AllCategories")}</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </NativeSelect>
          <NativeSelect
            className="w-full"
            value={params.get("severity") ?? ""}
            onChange={(e) =>
              updateParam("severity", e.target.value || null, true)
            }
          >
            <option value="">{t("AllSeverities")}</option>
            {severities.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </NativeSelect>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          {error ? (
            <div className="flex gap-2 p-8 text-destructive">
              <AlertTriangle />
              {getApiErrorMessage(error)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
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
                    <TableHead key={k}>{t(k)}</TableHead>
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
                      className="cursor-pointer"
                      onClick={() => setSelectedId(log.id)}
                    >
                      <TableCell>
                        {new Date(log.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {log.actorName ?? log.actorId ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            log.action.includes("CREATED") && "bg-green-600",
                            log.action.includes("UPDATED") && "bg-blue-600",
                            log.action.includes("DELETED") && "bg-red-600",
                          )}
                        >
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell>{log.category}</TableCell>
                      <TableCell>{log.targetType ?? "—"}</TableCell>
                      <TableCell>
                        {log.targetName ?? log.targetId ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            log.severity === "CRITICAL" ||
                            log.severity === "HIGH"
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {log.severity}
                        </Badge>
                      </TableCell>
                      <TableCell>{log.ipAddress ?? "—"}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="h-40 text-center">
                      <FileSearch className="mx-auto mb-2" />
                      {t("Empty")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {data && (
        <AppPagination
          currentPage={data.page}
          totalPages={data.lastPage}
          totalItems={data.total}
          pageSize={data.limit}
          itemLabel={t("Logs")}
          onPageChange={(next) => updateParam("page", String(next))}
        />
      )}
      <Sheet
        open={!!selectedId}
        onOpenChange={(open) => !open && setSelectedId(null)}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
          <SheetHeader>
            <SheetTitle>{t("Details")}</SheetTitle>
          </SheetHeader>
          {detail && (
            <Tabs defaultValue="diff" className="mt-4">
              <TabsList>
                <TabsTrigger value="diff">{t("DiffView")}</TabsTrigger>
                <TabsTrigger value="raw">{t("RawJson")}</TabsTrigger>
              </TabsList>
              <TabsContent value="diff" className="space-y-4">
                <Card>
                  <CardContent className="grid gap-2 p-4 text-sm md:grid-cols-2">
                    <div>
                      {t("RequestId")}: {detail.requestId ?? "—"}
                    </div>
                    <div>
                      {t("UserAgent")}: {detail.userAgent ?? "—"}
                    </div>
                    <div>
                      {t("Target")}: {detail.targetType} {detail.targetId}
                    </div>
                    <div>
                      {t("Admin")}: {detail.actorName ?? detail.actorId}
                    </div>
                  </CardContent>
                </Card>
                <DiffRows entries={detail.diff ?? []} />
              </TabsContent>
              <TabsContent value="raw" className="grid gap-4 md:grid-cols-2">
                <JsonBlock value={detail.before} />
                <JsonBlock value={detail.after} />
                <div className="md:col-span-2">
                  <JsonBlock value={detail.metadata} />
                </div>
              </TabsContent>
            </Tabs>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
