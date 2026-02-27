
"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { HistoryResponse } from "@/lib/types";
import { TransactionList } from "@/components/dashboard/TransactionList";
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

const ITEMS_PER_PAGE = 30

export default function HistoryPage() {
    const [data, setData] = useState<HistoryResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);

    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            try {
                const res = await apiClient.get<HistoryResponse>("/dashboard/history", {
                    query: { page, limit: ITEMS_PER_PAGE }
                });
                setData(res);
            } catch (err: any) {
                setError(err.message || "Failed to load history");
            } finally {
                setLoading(false);
            }
        }
        void fetchData();
    }, [page]);

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
                        <div className="h-5 w-96 bg-muted rounded-lg ml-16" />
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

                    <div className="space-y-4">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div
                                key={i}
                                className="flex items-center justify-between gap-4 py-4 border-b border-border last:border-0"
                            >
                                <div className="space-y-2">
                                    <div className="h-4 w-40 bg-muted rounded-lg" />
                                    <div className="h-3 w-24 bg-muted rounded-lg" />
                                </div>

                                <div className="h-4 w-20 bg-muted rounded-lg" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Pagination */}
                <div className="flex justify-center">
                    <div className="h-12 w-72 bg-muted rounded-2xl" />
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
                    <h2 className="text-2xl font-bold">Something went wrong</h2>
                    <p className="text-muted-foreground">{error}</p>
                </div>
                <button
                    onClick={() => window.location.reload()}
                    className="px-6 py-2.5 bg-primary text-primary-foreground rounded-2xl font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition-opacity"
                >
                    Try Again
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
                        Transactions
                    </h1>
                    <p className="text-muted-foreground font-medium text-lg ml-16">
                        Detailed history of your deposits and purchases
                    </p>
                </div>

                <button className="flex items-center gap-2 px-6 py-3 bg-primary/5 hover:bg-primary/10 text-primary font-bold rounded-2xl transition-all border border-primary/10 group">
                    <Download className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform" />
                    Export Data
                </button>
            </section>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-card border border-border rounded-[2.5rem] p-8 shadow-xl shadow-black/5 relative overflow-hidden group"
                >
                    <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform duration-700">
                        <CreditCard className="w-20 h-20" />
                    </div>
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-xl">
                                <Wallet className="w-5 h-5 text-primary" />
                            </div>
                            <span className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Current Balance</span>
                        </div>
                        <div className="text-4xl font-extrabold text-foreground">${data?.balance.toFixed(2)}</div>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-card border border-border rounded-[2.5rem] p-8 shadow-xl shadow-black/5 relative overflow-hidden group"
                >
                    <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform duration-700">
                        <ArrowDownLeft className="w-20 h-20" />
                    </div>
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-500/10 rounded-xl">
                                <TrendingUp className="w-5 h-5 text-green-500" />
                            </div>
                            <span className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Total Credits</span>
                        </div>
                        <div className="text-4xl font-extrabold text-green-500">+${data?.totals.deposits}</div>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-card border border-border rounded-[2.5rem] p-8 shadow-xl shadow-black/5 relative overflow-hidden group"
                >
                    <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform duration-700">
                        <ArrowUpRight className="w-20 h-20" />
                    </div>
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-red-500/10 rounded-xl">
                                <ArrowUpRight className="w-5 h-5 text-red-500" />
                            </div>
                            <span className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Total Debits</span>
                        </div>
                        <div className="text-4xl font-extrabold text-red-500">-${data?.totals.withdrawals}</div>
                    </div>
                </motion.div>
            </div>

            <div className="bg-card border border-border rounded-[2.5rem] p-8 shadow-xl shadow-black/5 overflow-x-auto">
                <h2 className="text-2xl font-bold tracking-tight mb-8">Transaction Log</h2>
                <TransactionList transactions={data?.data || []} />
            </div>

            {data && (
                <AppPagination
                    currentPage={page}
                    totalPages={data.lastPage}
                    totalItems={data.total}
                    pageSize={ITEMS_PER_PAGE}
                    itemLabel="transactions"
                    onPageChange={setPage}
                />
            )}
        </div>
    );
}
