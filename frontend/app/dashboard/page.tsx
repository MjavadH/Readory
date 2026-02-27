
"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { DashboardOverview } from "@/lib/types";
import { ContinueReadingCard } from "@/components/dashboard/ContinueReadingCard";
import { LibraryCard } from "@/components/dashboard/LibraryCard";
import { TransactionList } from "@/components/dashboard/TransactionList";
import {
  ArrowRight,
  BookMarked,
  History,
  Plus,
  TrendingUp,
  Wallet,
  Loader2,
  AlertCircle
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

export default function OverviewPage() {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await apiClient.get<DashboardOverview>("/dashboard");
        setData(res);
      } catch (err: any) {
        setError(err.message || "Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    }
    void fetchData();
  }, []);

  if (loading) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <p className="text-muted-foreground font-medium animate-pulse">Loading your dashboard...</p>
        </div>
    );
  }

  if (error || !data) {
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
      <div className="space-y-12 pb-12">
        {/* Header */}
        <section className="relative overflow-hidden p-10 rounded-[2.5rem] bg-linear-to-br from-primary/10 via-primary/5 to-transparent border border-primary/10 shadow-sm ring-1 ring-primary/5">
          <div className="absolute top-0 right-0 p-8 opacity-5 -rotate-12 translate-x-1/4 -translate-y-1/4">
            <TrendingUp className="w-64 h-64" />
          </div>
          <div className="relative z-10 space-y-2">
            <h1
                className="text-5xl font-extrabold tracking-tight text-foreground"
            >
              Hello, <span style={{"wordBreak" : "break-all"}} className="text-primary">{data.profile.username}</span>!
            </h1>
            <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-muted-foreground text-lg max-w-2xl font-medium leading-relaxed"
            >
              You've read {data.continueReading?.progress.percent || 100}% of your last chapter.
              Keep up the great progress!
            </motion.p>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-8 space-y-12">
            {/* Continue Reading Section */}
            {data.continueReading && (
                <section className="space-y-6">
                  <div className="flex items-center justify-between px-2">
                    <h2 className="text-2xl font-bold tracking-tight flex items-center gap-3">
                      <BookMarked className="w-6 h-6 text-primary" />
                      Continue Reading
                    </h2>
                  </div>
                  <ContinueReadingCard progress={data.continueReading} />
                </section>
            )}

            {/* Library Section */}
            <section className="space-y-6">
              <div className="flex items-center justify-between px-2">
                <h2 className="text-2xl font-bold tracking-tight flex items-center gap-3">
                  <TrendingUp className="w-6 h-6 text-primary" />
                  Recent Library
                </h2>
                <Link href="/dashboard/library" className="group flex items-center gap-2 text-primary font-bold hover:gap-3 transition-all px-4 py-2 bg-primary/5 rounded-2xl hover:bg-primary/10">
                  View Full Library
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {data.recentLibrary.data.map((item) => (
                    <LibraryCard key={item.book.id} item={item} />
                ))}
              </div>
            </section>

            {/* Recent Transactions Section */}
            <section className="space-y-6">
              <div className="flex items-center justify-between px-2">
                <h2 className="text-2xl font-bold tracking-tight flex items-center gap-3">
                  <History className="w-6 h-6 text-primary" />
                  Transactions
                </h2>
                <Link href="/dashboard/history" className="group flex items-center gap-2 text-primary font-bold hover:gap-3 transition-all px-4 py-2 bg-primary/5 rounded-2xl">
                  History
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="bg-card border border-border rounded-[2.5rem] p-6 shadow-xl shadow-black/5 min-h-[400px]">
                {data.recentTransactions.data.length > 0 ? (
                    <TransactionList transactions={data.recentTransactions.data} limit={5} />
                ) : (
                    <div className="flex flex-col items-center justify-center h-[350px] text-center gap-4">
                      <div className="p-4 bg-muted rounded-full">
                        <History className="w-8 h-8 text-muted-foreground" />
                      </div>
                      <p className="text-muted-foreground font-medium">No transactions yet</p>
                    </div>
                )}
              </div>
            </section>
          </div>

          <div className="lg:col-span-4 space-y-10">
            {/* Wallet Section */}
            <section className="space-y-6 sticky top-0">
              <div className="flex items-center justify-between px-2">
                <h2 className="text-2xl font-bold tracking-tight flex items-center gap-3">
                  <Wallet className="w-6 h-6 text-primary" />
                  Wallet
                </h2>
              </div>
              <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-card border border-border rounded-[2.5rem] p-10 shadow-xl shadow-black/5 relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 p-8 opacity-5">
                  <Wallet className="w-32 h-32 group-hover:scale-110 transition-transform duration-700" />
                </div>
                <div className="relative z-10 text-center space-y-6">
                  <div className="text-4xl font-extrabold tracking-tight text-foreground drop-shadow-sm">
                    ${data.wallet.balance.toFixed(2)}
                  </div>
                  <button className="w-full flex items-center justify-center gap-2 px-8 py-4 bg-primary text-primary-foreground rounded-2xl font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all text-lg group/btn">
                    <Plus className="w-6 h-6 group-hover/btn:rotate-90 transition-transform" />
                    Top Up Balance
                  </button>
                </div>
              </motion.div>
            </section>
          </div>
        </div>
      </div>
  );
}