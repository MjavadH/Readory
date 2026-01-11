"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Users, DollarSign, BookOpen, TrendingUp, ArrowUpRight, ArrowDownRight, UserPlus, Layers, ArrowDownCircle, ArrowUpCircle } from "lucide-react"
import {Bar, BarChart, Pie, PieChart, Cell, XAxis, YAxis, CartesianGrid, Area, AreaChart} from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { usePermission } from "@/hooks/use-permission"

// --- Types ---
interface DashboardStats {
    summary: {
        users?: { total: number; new: number; active: number; growth: number }
        content?: { books: number; chapters: number; growth: number }
        finance?: { totalRevenue: number; monthlyRevenue: number; growth: number; chartData: { date: string; amount: number }[] }
    }
    charts?: {
        userRegistrations: { month: string; users: number }[]
        genreDistribution: { name: string; value: number }[]
    }
    recent: {
        transactions: Array<{ id: number; amount: number; type: "CREDIT" | "DEBIT"; username: string; createdAt: string }>
        users: Array<{ id: number; username: string; email: string; createdAt: string }>
        books: Array<{ id: number; title: string; author?: string; createdAt: string }>
        chapters: Array<{ id: number; title: string; bookTitle: string; createdAt: string }>
    }
}

const CHART_COLORS = [
    "var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"
]

export default function AdminDashboard() {
    const [stats, setStats] = useState<DashboardStats | null>(null)
    const [loadingData, setLoadingData] = useState(true)

    const { has, isSuperAdmin, loading: permissionLoading } = usePermission()

    const fetchStats = async () => {
        setLoadingData(true)
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/dashboard/stats`, { credentials: "include" })
            if (res.ok) {
                const data = await res.json()
                setStats(data)
            }
        } catch (err) {
            console.error("Error fetching dashboard stats", err)
        } finally {
            setLoadingData(false)
        }
    }

    useEffect(() => {
        if (!permissionLoading) fetchStats()
    }, [permissionLoading])

    if (loadingData || permissionLoading) {
        return <DashboardSkeleton />
    }

    if (!stats) return null;

    // --- Data Preparation ---
    const revenueData = stats.summary.finance?.chartData.map(item => ({
        date: new Date(item.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
        amount: item.amount
    })) || []

    const userStatusData = [
        { name: "Active", value: stats.summary.users?.active || 0 },
        { name: "Inactive", value: (stats.summary.users?.total || 0) - (stats.summary.users?.active || 0) },
    ]

    return (
        <div className="p-4 sm:p-6 space-y-6 max-w-[1600px] mx-auto">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">Dashboard</h1>
                <p className="text-muted-foreground mt-1">Overview of your platform's performance.</p>
            </div>

            {/* --- Summary Cards --- */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {(isSuperAdmin || has("MANAGE_FINANCE")) && stats.summary.finance && (
                    <StatsCard
                        title="Total Revenue"
                        value={`$${stats.summary.finance.totalRevenue.toLocaleString()}`}
                        growth={stats.summary.finance.growth}
                        icon={DollarSign}
                        color="text-emerald-500"
                        bg="bg-emerald-500/10"
                    />
                )}
                {(isSuperAdmin || has(["MANAGE_USERS", "MANAGE_STAFF"])) && stats.summary.users && (
                    <StatsCard
                        title="Active Users"
                        value={stats.summary.users.active.toLocaleString()}
                        growth={stats.summary.users.growth}
                        icon={Users}
                        color="text-blue-500"
                        bg="bg-blue-500/10"
                        subText="new users this month"
                    />
                )}
                {(isSuperAdmin || has("MANAGE_BOOKS")) && stats.summary.content && (
                    <StatsCard
                        title="Total Books"
                        value={stats.summary.content.books.toLocaleString()}
                        growth={stats.summary.content.growth}
                        icon={BookOpen}
                        color="text-orange-500"
                        bg="bg-orange-500/10"
                        subText={`${stats.summary.content.chapters} total chapters`}
                    />
                )}
            </div>

            {/* --- Charts Section --- */}
            <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">

                {/* Revenue Trend (Big Chart) */}
                {(isSuperAdmin || has("MANAGE_FINANCE")) && stats.summary.finance && (
                    <Card className="lg:col-span-4 border-border/60 shadow-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <TrendingUp className="size-5 text-primary" /> Revenue Trend
                            </CardTitle>
                            <CardDescription>Daily revenue for the last 30 days</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ChartContainer config={{ amount: { label: "Revenue", color: "var(--chart-1)" } }} className="h-[300px] w-full">
                                <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="fillAmount" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-muted" />
                                    <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} className="text-xs font-medium" />
                                    <YAxis tickLine={false} axisLine={false} tickMargin={8} className="text-xs" />
                                    <ChartTooltip content={<ChartTooltipContent />} />
                                    <Area type="monotone" dataKey="amount" stroke="var(--chart-1)" fillOpacity={1} fill="url(#fillAmount)" strokeWidth={2} />
                                </AreaChart>
                            </ChartContainer>
                        </CardContent>
                    </Card>
                )}

                {/* Distribution Charts (Tabs) */}
                {(isSuperAdmin || has(["MANAGE_USERS", "MANAGE_BOOKS"])) && (
                    <Card className="lg:col-span-3 border-border/60 shadow-sm">
                        <CardHeader className="pb-2">
                            <CardTitle>Distributions</CardTitle>
                            <CardDescription>Breakdown of users and content</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Tabs defaultValue="genres" className="w-full">
                                <TabsList className="grid w-full grid-cols-2 mb-4">
                                    <TabsTrigger value="genres">Genre Dist.</TabsTrigger>
                                    <TabsTrigger value="users">User Status</TabsTrigger>
                                </TabsList>

                                <TabsContent value="genres" className="h-[250px]">
                                    {stats.charts?.genreDistribution && stats.charts.genreDistribution.length > 0 ? (
                                        <PieChartWrapper data={stats.charts.genreDistribution} />
                                    ) : (
                                        <EmptyState text="No genre data available" />
                                    )}
                                </TabsContent>

                                <TabsContent value="users" className="h-[250px]">
                                    <PieChartWrapper data={userStatusData} />
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* User Growth Bar Chart */}
            {(isSuperAdmin || has(["MANAGE_USERS", "MANAGE_STAFF"])) && stats.charts?.userRegistrations && (
                <Card className="border-border/60 shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <UserPlus className="size-5 text-blue-500" /> New User Registrations
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer config={{ users: { label: "Users", color: "var(--chart-2)" } }} className="h-[250px] w-full">
                            <BarChart data={stats.charts.userRegistrations}>
                                <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-muted" />
                                <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={10} className="text-xs" />
                                <ChartTooltip cursor={{ fill: 'transparent' }} content={<ChartTooltipContent />} />
                                <Bar dataKey="users" fill="var(--chart-2)" radius={[4, 4, 0, 0]} barSize={40} />
                            </BarChart>
                        </ChartContainer>
                    </CardContent>
                </Card>
            )}

            {/* --- Detailed Lists --- */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Recent Transactions */}
                {(isSuperAdmin || has("MANAGE_FINANCE")) && (
                    <Card className="border-border/60 shadow-sm h-full">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <DollarSign className="size-5 text-emerald-500" /> Recent Transactions
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-border/50 hover:bg-transparent"><TableHead>User</TableHead><TableHead className="text-right">Amount</TableHead></TableRow>
                                </TableHeader>
                                <TableBody>
                                    {stats.recent.transactions.length === 0 ? <EmptyRow text="No transactions" /> : (
                                        stats.recent.transactions.map((t) => (
                                            <TableRow key={t.id} className="hover:bg-muted/50">
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-sm">{t.username}</span>
                                                        <span className="text-xs text-muted-foreground">{new Date(t.createdAt).toLocaleDateString()}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <span className={`font-semibold flex items-center justify-end gap-1 ${t.type === 'CREDIT' ? 'text-emerald-600' : 'text-red-600'}`}>
                                                        {t.type === 'CREDIT' ? <ArrowUpCircle className="size-3"/> : <ArrowDownCircle className="size-3"/>}
                                                        {t.type === 'CREDIT' ? '+' : '-'}${t.amount.toLocaleString()}
                                                    </span>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                )}

                {/* Recent Content (Books & Chapters) */}
                {(isSuperAdmin || has("MANAGE_BOOKS")) && (
                    <Card className="border-border/60 shadow-sm h-full">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    <Layers className="size-5 text-orange-500" /> Recent Content
                                </CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Tabs defaultValue="books" className="w-full">
                                <div className="px-6 pb-2">
                                    <TabsList className="w-full grid grid-cols-2">
                                        <TabsTrigger value="books">New Books</TabsTrigger>
                                        <TabsTrigger value="chapters">New Chapters</TabsTrigger>
                                    </TabsList>
                                </div>

                                <TabsContent value="books" className="mt-0">
                                    <Table>
                                        <TableHeader><TableRow className="border-border/50 hover:bg-transparent"><TableHead>Title</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
                                        <TableBody>
                                            {stats.recent.books.length === 0 ? <EmptyRow text="No new books" /> : (
                                                stats.recent.books.map((b) => (
                                                    <TableRow key={b.id}>
                                                        <TableCell>
                                                            <div className="font-medium text-sm truncate max-w-[200px]">{b.title}</div>
                                                            <div className="text-xs text-muted-foreground">{b.author || "Unknown"}</div>
                                                        </TableCell>
                                                        <TableCell className="text-xs text-muted-foreground">{new Date(b.createdAt).toLocaleDateString()}</TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </TabsContent>

                                <TabsContent value="chapters" className="mt-0">
                                    <Table>
                                        <TableHeader><TableRow className="border-border/50 hover:bg-transparent"><TableHead>Chapter</TableHead><TableHead>Book</TableHead></TableRow></TableHeader>
                                        <TableBody>
                                            {stats.recent.chapters.length === 0 ? <EmptyRow text="No new chapters" /> : (
                                                stats.recent.chapters.map((c) => (
                                                    <TableRow key={c.id}>
                                                        <TableCell className="font-medium text-sm">{c.title}</TableCell>
                                                        <TableCell>
                                                            <div className="text-xs truncate max-w-[150px]">{c.bookTitle}</div>
                                                            <div className="text-[10px] text-muted-foreground">{new Date(c.createdAt).toLocaleDateString()}</div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    )
}

// --- Sub Components ---

function StatsCard({ title, value, growth, icon: Icon, color, bg, subText }: any) {
    const isPositive = growth >= 0
    return (
        <Card className="border-border/60 shadow-sm hover:border-border transition-colors">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
                    <div className={`size-10 rounded-full ${bg} flex items-center justify-center`}>
                        <Icon className={`size-5 ${color}`} />
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                <div className="flex items-center gap-1 mt-2 text-xs">
                    <div className={`flex items-center ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                        {isPositive ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
                        <span className="font-medium">{Math.abs(growth)}%</span>
                    </div>
                    <span className="text-muted-foreground ml-1">{subText || "from last month"}</span>
                </div>
            </CardContent>
        </Card>
    )
}

function PieChartWrapper({ data }: { data: { name: string; value: number }[] }) {
    return (
        <ChartContainer config={{}} className="h-full w-full">
            <PieChart>
                <Pie
                    data={data}
                    cx="50%" cy="50%"
                    innerRadius={60} outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                >
                    {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
                <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
                    <tspan x="50%" dy="-0.5em" className="fill-foreground text-xl font-bold">
                        {data.reduce((acc, cur) => acc + cur.value, 0)}
                    </tspan>
                    <tspan x="50%" dy="1.5em" className="fill-muted-foreground text-xs">Total</tspan>
                </text>
            </PieChart>
        </ChartContainer>
    )
}

function EmptyRow({ text }: { text: string }) {
    return <TableRow><TableCell colSpan={2} className="h-24 text-center text-muted-foreground text-sm">{text}</TableCell></TableRow>
}

function EmptyState({ text }: { text: string }) {
    return <div className="h-full flex items-center justify-center text-muted-foreground text-sm">{text}</div>
}

function DashboardSkeleton() {
    return (
        <div className="p-6 space-y-6">
            <div className="h-8 w-48 bg-muted rounded animate-pulse" />
            <div className="h-5 w-80 bg-muted rounded animate-pulse" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => <div key={i} className="h-40 bg-muted rounded-xl animate-pulse" />)}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
                <div className="lg:col-span-4 h-100 bg-muted rounded-xl animate-pulse" />
                <div className="lg:col-span-3 h-100 bg-muted rounded-xl animate-pulse" />
            </div>
        </div>
    )
}