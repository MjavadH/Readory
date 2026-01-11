"use client"

import React, { useEffect, useState } from "react"
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
    TrendingUp,
    TrendingDown,
    Minus,
    ArrowDownCircle,
    ArrowUpCircle,
    Wallet,
    ChevronLeft,
    ChevronRight,
    Activity,
} from "lucide-react"

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
                const res = await fetch(
                    `${process.env.NEXT_PUBLIC_API_BASE}/wallet/transactions?page=${page}&limit=${ITEMS_PER_PAGE}`,
                    {
                        credentials: "include",
                    },
                )
                const data = await res.json()

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
                <div className="animate-pulse space-y-4">
                    <div className="h-8 bg-muted rounded w-1/4" />
                    <div className="h-4 bg-muted rounded w-1/3" />
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
        <div className="min-h-screen bg-gradient-to-br from-muted/30 via-background to-muted/20">
            <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8">
                <div className="space-y-1">
                    <h1 className="text-3xl sm:text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                        Transactions
                    </h1>
                    <p className="text-sm sm:text-base text-muted-foreground">View and manage all wallet transactions</p>
                </div>

                <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                    <Card className="border-border/50 bg-gradient-to-br from-blue-500/5 to-blue-500/10">
                        <CardContent className="flex items-center justify-between gap-4 py-4">
                            <div className="flex items-center gap-4">
                                <div className="flex size-12 items-center justify-center rounded-xl bg-blue-500/10 ring-1 ring-blue-500/20">
                                    <Activity className="size-6 text-blue-600 dark:text-blue-500" />
                                </div>
                                <div>
                                    <p className="text-xs sm:text-sm text-muted-foreground font-medium">Total Transactions</p>
                                    <p className="text-xl sm:text-2xl font-bold">{stats.total.toLocaleString()}</p>
                                </div>
                            </div>
                            <GrowthIndicator value={stats.growth?.totalTransactions} />
                        </CardContent>
                    </Card>

                    <Card className="border-border/50 bg-gradient-to-br from-emerald-500/5 to-emerald-500/10">
                        <CardContent className="flex items-center justify-between gap-4 py-4">
                            <div className="flex items-center gap-4">
                                <div className="flex size-12 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
                                    <ArrowUpCircle className="size-6 text-emerald-600 dark:text-emerald-500" />
                                </div>
                                <div>
                                    <p className="text-xs sm:text-sm text-muted-foreground font-medium">Deposits</p>
                                    <p className="text-xl sm:text-2xl font-bold">{formatCurrency(stats.creditAmount)}</p>
                                </div>
                            </div>
                            <GrowthIndicator value={stats.growth?.creditAmount} />
                        </CardContent>
                    </Card>

                    <Card className="border-border/50 bg-gradient-to-br from-red-500/5 to-red-500/10">
                        <CardContent className="flex items-center justify-between gap-4 py-4">
                            <div className="flex items-center gap-4">
                                <div className="flex size-12 items-center justify-center rounded-xl bg-red-500/10 ring-1 ring-red-500/20">
                                    <ArrowDownCircle className="size-6 text-red-600 dark:text-red-500" />
                                </div>
                                <div>
                                    <p className="text-xs sm:text-sm text-muted-foreground font-medium">Withdrawals</p>
                                    <p className="text-xl sm:text-2xl font-bold">{formatCurrency(stats.debitAmount)}</p>
                                </div>
                            </div>
                            <GrowthIndicator value={stats.growth?.debitAmount} />
                        </CardContent>
                    </Card>
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
                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <p className="text-xs sm:text-sm text-muted-foreground">
                            Showing <span className="font-semibold text-foreground">{transactions.length}</span> of{" "}
                            <span className="font-semibold text-foreground">{stats.total}</span> transactions (Page {page} of{" "}
                            {totalPages || 1})
                        </p>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="h-9 shadow-sm hover:shadow-md transition-shadow"
                            >
                                <ChevronLeft className="size-4 mr-1" />
                                Previous
                            </Button>
                            <div className="flex items-center gap-1">
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    let pageNum
                                    if (totalPages <= 5) {
                                        pageNum = i + 1
                                    } else if (page <= 3) {
                                        pageNum = i + 1
                                    } else if (page >= totalPages - 2) {
                                        pageNum = totalPages - 4 + i
                                    } else {
                                        pageNum = page - 2 + i
                                    }
                                    return (
                                        <Button
                                            key={pageNum}
                                            variant={page === pageNum ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => setPage(pageNum)}
                                            className={`w-9 h-9 ${page === pageNum ? "shadow-md" : "shadow-sm hover:shadow-md"} transition-shadow`}
                                        >
                                            {pageNum}
                                        </Button>
                                    )
                                })}
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage((p) => p + 1)}
                                disabled={!hasMore}
                                className="h-9 shadow-sm hover:shadow-md transition-shadow"
                            >
                                Next
                                <ChevronRight className="size-4 ml-1" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
