"use client";

import { useEffect, useRef, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { HistoryResponse } from "@/lib/types";
import {TransactionList, TransactionListSkeleton} from "@/components/dashboard/TransactionList";
import {
    History,
    Wallet,
    Download,
    AlertCircle,
    ArrowDownLeft,
    ArrowUpRight,
    TrendingUp,
    CreditCard
} from "lucide-react";
import { motion } from "framer-motion";
import {AppPagination} from "@/components/app-pagination";
import {useTranslations} from "next-intl";

const ITEMS_PER_PAGE = 30

export default function HistoryPage() {
    const t = useTranslations('UserDashboard');
    const g = useTranslations('General');
    const [data, setData] = useState<HistoryResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [isExporting, setIsExporting] = useState(false);
    const paginationScrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            try {
                const res = await apiClient.get<HistoryResponse>("/dashboard/history", {
                    query: { page, limit: ITEMS_PER_PAGE }
                });
                setData(res);
            } catch (err: any) {
                setError(t("FailedLoadHistory"));
            } finally {
                setLoading(false);
            }
        }
        void fetchData();
    }, [page]);

    const handleExport = async () => {
        if (isExporting) return;
        setIsExporting(true);

        try {
            const csvData = await apiClient.get<string>("/dashboard/history/export");
            if (!csvData) return;

            // Create client-side file download link
            const blob = new Blob(["\ufeff" + csvData], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", `transactions-${new Date().toISOString().split('T')[0]}.csv`);

            document.body.appendChild(link);
            link.click();

            // Clean up DOM and memory resources
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error("Export failed:", err);
        } finally {
            setIsExporting(false);
        }
    };

    if (loading && !data) {
        return (
            <div className="space-y-10 pb-12 animate-pulse">
                {/* Header */}
                <section className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-2">
                    <div className="space-y-3">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-muted rounded-2xl">
                                <div className="w-8 h-8 bg-muted-foreground/20 rounded-md" />
                            </div>
                            <div className="h-10 w-64 bg-muted rounded-xl" />
                        </div>
                        <div className="h-5 w-96 bg-muted rounded-lg ms-16" />
                    </div>

                    <div className="h-12 w-40 bg-muted rounded-2xl" />
                </section>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div
                            key={i}
                            className="bg-card border border-border rounded-[2.5rem] p-8 shadow-xl shadow-black/5 space-y-6"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-muted rounded-xl">
                                    <div className="w-5 h-5 bg-muted-foreground/20 rounded-md" />
                                </div>
                                <div className="h-4 w-40 bg-muted rounded-lg" />
                            </div>

                            <div className="h-10 w-32 bg-muted rounded-xl" />
                        </div>
                    ))}
                </div>

                {/* Transaction Table */}
                <div className="bg-card border border-border rounded-[2.5rem] p-8 shadow-xl shadow-black/5 overflow-x-auto space-y-8">
                    <div className="h-8 w-56 bg-muted rounded-xl" />
                    <TransactionListSkeleton limit={6} />
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center max-w-md mx-auto">
                <div className="p-4 bg-destructive/10 rounded-full">
                    <AlertCircle className="w-12 h-12 text-destructive" />
                </div>
                <div className="space-y-2">
                    <h2 className="text-2xl font-bold">{t("SomethingWentWrong")}</h2>
                    <p className="text-muted-foreground">{error}</p>
                </div>
                <button
                    onClick={() => window.location.reload()}
                    className="px-6 py-2.5 bg-primary text-primary-foreground rounded-2xl font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition-opacity"
                >
                    {t("TryAgain")}
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-10 pb-12">
            <section className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-2">
                <div className="space-y-1">
                    <h1 className="text-4xl font-extrabold tracking-tight text-foreground flex items-center gap-4">
                        <div className="p-3 bg-primary/10 rounded-2xl">
                            <History className="w-8 h-8 text-primary" />
                        </div>
                        {t("Transactions")}
                    </h1>
                    <p className="text-muted-foreground font-medium text-lg ms-16">
                        {t("DetailedHistory")}
                    </p>
                </div>

                <button onClick={handleExport} disabled={isExporting} className="flex items-center gap-2 px-6 py-3 bg-primary/5 hover:bg-primary/10 text-primary font-bold rounded-2xl transition-all border border-primary/10 group">
                    <Download className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform" />
                    {isExporting ? t("ExportData") + "..." : t("ExportData")}
                </button>
            </section>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-card border border-border rounded-[2.5rem] p-8 shadow-xl shadow-black/5 relative overflow-hidden group"
                >
                    <div className="absolute top-0 ltr:right-0 rtl:left-0 p-6 opacity-5 group-hover:scale-110 transition-transform duration-700">
                        <CreditCard className="w-20 h-20" />
                    </div>
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-xl">
                                <Wallet className="w-5 h-5 text-primary" />
                            </div>
                            <span className="text-sm font-bold uppercase tracking-widest text-muted-foreground">{t("CurrentBalance")}</span>
                        </div>
                        <div className="text-4xl font-extrabold text-foreground">{t("Amount", {CurrencySymbols: g("CurrencySymbols"), Amount: data?.balance.toFixed(2) || 0})}</div>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-card border border-border rounded-[2.5rem] p-8 shadow-xl shadow-black/5 relative overflow-hidden group"
                >
                    <div className="absolute top-0 ltr:right-0 rtl:left-0 p-6 opacity-5 group-hover:scale-110 transition-transform duration-700">
                        <ArrowDownLeft className="w-20 h-20" />
                    </div>
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-500/10 rounded-xl">
                                <TrendingUp className="w-5 h-5 text-green-500" />
                            </div>
                            <span className="text-sm font-bold uppercase tracking-widest text-muted-foreground">{t("TotalCredits")}</span>
                        </div>
                        <div className="text-4xl font-extrabold text-green-500">+{t("Amount", {CurrencySymbols: g("CurrencySymbols"), Amount: data?.totals.deposits || 0})}</div>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-card border border-border rounded-[2.5rem] p-8 shadow-xl shadow-black/5 relative overflow-hidden group"
                >
                    <div className="absolute top-0 ltr:right-0 rtl:left-0 p-6 opacity-5 group-hover:scale-110 transition-transform duration-700">
                        <ArrowUpRight className="w-20 h-20" />
                    </div>
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-red-500/10 rounded-xl">
                                <ArrowUpRight className="w-5 h-5 text-red-500" />
                            </div>
                            <span className="text-sm font-bold uppercase tracking-widest text-muted-foreground">{t("TotalDebits")}</span>
                        </div>
                        <div className="text-4xl font-extrabold text-red-500">-{t("Amount", {CurrencySymbols: g("CurrencySymbols"), Amount: data?.totals.withdrawals || 0})}</div>
                    </div>
                </motion.div>
            </div>

            <div ref={paginationScrollRef} className="bg-card border border-border rounded-[2.5rem] p-8 shadow-xl shadow-black/5 overflow-x-auto">
                <h2 className="text-2xl font-bold tracking-tight mb-8">{t("TransactionLog")}</h2>
                <TransactionList transactions={data?.data || []} />
            </div>

            {data && (
                <AppPagination
                    currentPage={page}
                    totalPages={data.lastPage}
                    totalItems={data.total}
                    pageSize={ITEMS_PER_PAGE}
                    itemLabel={t("transactions")}
                    onPageChange={setPage}
                    scrollTarget={paginationScrollRef}
                />
            )}
        </div>
    );
}
