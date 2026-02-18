"use client"

import React, { useEffect, useState } from "react"
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { AdminPagination } from "@/components/admin-pagination"
import {
    TrendingUp,
    TrendingDown,
    Minus,
    ArrowDownCircle,
    ArrowUpCircle,
    Wallet,
    Activity,
} from "lucide-react"
import { apiClient } from "@/lib/api-client"
import {StatCard} from "@/components/stat-card";

function GrowthIndicator({ value }: { value?: number }) {
    if (value === undefined) return null
    if (value === 0) {
        return (
            <div className="flex items-center text-xs font-medium text-muted-foreground bg-muted/20 px-2 py-1 rounded-full">
                <Minus className="mr-1 size-3" />
                <span>No change</span>
            </div>
        )
    }

    const isPositive = value > 0

    return (
        <div
            className={`flex items-center text-xs font-medium px-2 py-1 rounded-full ${
                isPositive
                    ? "text-green-700 bg-green-500/10 dark:text-green-400"
                    : "text-red-700 bg-red-500/10 dark:text-red-400"
            }`}
        >
            {isPositive ? <TrendingUp className="mr-1 size-3" /> : <TrendingDown className="mr-1 size-3" />}
            <span>
        {Math.abs(value).toFixed(1)}% {isPositive ? "growth" : "drop"}
      </span>
        </div>
    )
}

interface Transaction {
    id: number
    walletId: number
    amount: string | number
    type: "CREDIT" | "DEBIT"
    createdAt: string
    reference?: string | null
    wallet?: {
        userId: number
        user?: {
            username: string
        }
    }
}

interface TransactionStats {
    total: number
    credits: number
    debits: number
    creditAmount: number
    debitAmount: number
    growth?: {
        totalTransactions: number
        creditAmount: number
        debitAmount: number
    }
}

export default function AdminTransactions() {
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [stats, setStats] = useState<TransactionStats>({
        total: 0,
        credits: 0,
        debits: 0,
        creditAmount: 0,
        debitAmount: 0,
    })
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState(1)
    const [hasMore, setHasMore] = useState(false)
    const ITEMS_PER_PAGE = 20
    const totalPages = Math.ceil(stats.total / ITEMS_PER_PAGE)

    useEffect(() => {
        async function fetchTransactions() {
            setLoading(true)
            try {
                const data = await apiClient.get<{ transactions?: Transaction[]; stats?: TransactionStats; hasMore?: boolean }>(
                    "/wallet/transactions",
                    {
                        query: { page, limit: ITEMS_PER_PAGE },
                    },
                )

                if (data.transactions && Array.isArray(data.transactions)) {
                    setTransactions(data.transactions)
                    setHasMore(data.hasMore || false)

                    if (data.stats) {
                        setStats({
                            total: data.stats.total || 0,
                            credits: data.stats.credits || 0,
                            debits: data.stats.debits || 0,
                            creditAmount: data.stats.creditAmount || 0,
                            debitAmount: data.stats.debitAmount || 0,
                            growth: data.stats.growth,
                        })
                    }
                }
            } catch (err) {
                console.error("Error fetching transactions", err)
            } finally {
                setLoading(false)
            }
        }
        fetchTransactions()
    }, [page])

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
        }).format(amount)
    }

    if (loading && transactions.length === 0) {
        return (
            <div className="p-4 sm:p-6 space-y-6">
                <div className="space-y-1">
                    <h1 className="text-3xl sm:text-4xl font-bold tracking-tight bg-linear-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                        Transactions
                    </h1>
                    <p className="text-sm sm:text-base text-muted-foreground">View all wallet transactions</p>
                </div>
                <div className="animate-pulse space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="h-32 bg-muted rounded-xl" />
                        <div className="h-32 bg-muted rounded-xl" />
                        <div className="h-32 bg-muted rounded-xl" />
                    </div>
                    <div className="h-96 bg-muted rounded-xl" />
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-linear-to-br from-muted/30 via-background to-muted/20">
            <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8">
                <div className="space-y-1">
                    <h1 className="text-3xl sm:text-4xl font-bold tracking-tight bg-linear-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                        Transactions
                    </h1>
                    <p className="text-sm sm:text-base text-muted-foreground">View all wallet transactions</p>
                </div>

                {/* Stats Cards */}
                <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                    <StatCard
                        title="Total Transactions"
                        value={stats.total.toLocaleString()}
                        icon={Activity}
                        color="blue"
                        indicator={<GrowthIndicator value={stats.growth?.totalTransactions} />}
                    />
                    <StatCard
                        title="Deposits"
                        value={formatCurrency(stats.creditAmount)}
                        icon={ArrowUpCircle}
                        color="emerald"
                        indicator={<GrowthIndicator value={stats.growth?.creditAmount} />}
                    />
                    <StatCard
                        title="Withdrawals"
                        value={formatCurrency(stats.debitAmount)}
                        icon={ArrowDownCircle}
                        color="red"
                        indicator={<GrowthIndicator value={stats.growth?.debitAmount} />}
                    />
                </div>

                <Card className="border-none shadow-lg overflow-hidden bg-card">
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                                        <TableHead className="font-semibold">User</TableHead>
                                        <TableHead className="font-semibold">Type</TableHead>
                                        <TableHead className="text-right font-semibold">Amount</TableHead>
                                        <TableHead className="font-semibold">Reference</TableHead>
                                        <TableHead className="font-semibold">Date & Time</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {transactions.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="h-32">
                                                <div className="flex flex-col items-center justify-center text-muted-foreground py-8">
                                                    <div className="size-16 sm:size-20 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                                                        <Wallet className="size-8 sm:size-10 text-muted-foreground/50" />
                                                    </div>
                                                    <p className="text-base sm:text-lg font-semibold mb-1">No transactions found</p>
                                                    <p className="text-xs sm:text-sm text-muted-foreground/60">
                                                        Transactions will appear here once users start transacting
                                                    </p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        transactions.map((transaction) => (
                                            <TableRow key={transaction.id} className="hover:bg-muted/20 transition-colors">
                                                <TableCell>
                                                    <div className="flex flex-col">
                            <span className="font-medium text-sm sm:text-base">
                              {transaction.wallet?.user?.username}
                            </span>
                                                    </div>
                                                </TableCell>

                                                <TableCell>
                                                    {transaction.type === "CREDIT" ? (
                                                        <Badge
                                                            variant="outline"
                                                            className="gap-1.5 border-emerald-600/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 hover:bg-emerald-500/20"
                                                        >
                                                            <ArrowUpCircle className="size-3" />
                                                            Credit
                                                        </Badge>
                                                    ) : (
                                                        <Badge
                                                            variant="outline"
                                                            className="gap-1.5 border-red-600/30 bg-red-500/10 text-red-600 dark:text-red-500 hover:bg-red-500/20"
                                                        >
                                                            <ArrowDownCircle className="size-3" />
                                                            Debit
                                                        </Badge>
                                                    )}
                                                </TableCell>

                                                <TableCell className="text-right">
                          <span
                              className={`text-base sm:text-lg font-bold tabular-nums ${
                                  transaction.type === "CREDIT"
                                      ? "text-emerald-600 dark:text-emerald-500"
                                      : "text-red-600 dark:text-red-500"
                              }`}
                          >
                            {transaction.type === "CREDIT" ? "+" : "-"}
                              {formatCurrency(Number(transaction.amount)).replace("-", "")}
                          </span>
                                                </TableCell>

                                                <TableCell>
                                                    {transaction.reference ? (
                                                        <Badge variant="secondary" className="font-mono text-xs">
                                                            {transaction.reference}
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-xs sm:text-sm text-muted-foreground italic">No reference</span>
                                                    )}
                                                </TableCell>

                                                <TableCell>
                                                    <div className="flex flex-col gap-0.5">
                            <span className="text-xs sm:text-sm font-medium">
                              {new Date(transaction.createdAt).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                              })}
                            </span>
                                                        <span className="text-[10px] sm:text-xs text-muted-foreground">
                              {new Date(transaction.createdAt).toLocaleTimeString("en-US", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                              })}
                            </span>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
                <AdminPagination
                    currentPage={page}
                    totalPages={totalPages}
                    totalItems={stats.total}
                    pageSize={ITEMS_PER_PAGE}
                    itemLabel="transactions"
                    onPageChange={setPage}
                    canGoPrevious={page > 1}
                    canGoNext={hasMore}
                />
            </div>
        </div>
    )
}
