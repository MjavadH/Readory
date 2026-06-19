"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Users, DollarSign, BookOpen, TrendingUp, ArrowUpRight, ArrowDownRight, UserPlus, Layers, ArrowDownCircle, ArrowUpCircle } from "lucide-react"
import {Bar, BarChart, Pie, PieChart, XAxis, YAxis, CartesianGrid, Area, AreaChart, ResponsiveContainer, RadarChart, Radar, PolarRadiusAxis, PolarGrid, PolarAngleAxis, Label, Sector } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { usePermission } from "@/hooks/use-permission"
import { apiClient } from "@/lib/api-client"
import { motion } from "framer-motion"
import {useTranslations} from 'next-intl';

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
        typeDistribution: { name: string; value: number }[]
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
    const t = useTranslations();
    const [stats, setStats] = useState<DashboardStats | null>(null)
    const [loadingData, setLoadingData] = useState(true)

    const { has, isSuperAdmin, loading: permissionLoading } = usePermission()

    const fetchStats = async () => {
        setLoadingData(true)
        try {
            const data = await apiClient.get<DashboardStats>("/dashboard/admin")
            setStats(data)
        } catch (err) {
            console.error("Error fetching dashboard stats", err)
        } finally {
            setLoadingData(false)
        }
    }

    useEffect(() => {
        if (!permissionLoading) void fetchStats()
    }, [permissionLoading])

    if (loadingData || permissionLoading) {
        return <DashboardSkeleton />
    }

    if (!stats) return null;

    // --- Data Preparation ---
    const revenueData = stats.summary.finance?.chartData.map(item => ({
        date: new Date(item.date).toLocaleDateString(t("General.locale"), { day: 'numeric', month: 'short' }),
        amount: item.amount
    })) || []

    const userStatusData = [
        { name: "Active", value: stats.summary.users?.active || 0 },
        { name: "Inactive", value: (stats.summary.users?.total || 0) - (stats.summary.users?.active || 0) },
    ]

    return (
        <div className="min-h-screen bg-linear-to-br from-muted/30 via-background to-muted/20">
            <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-400 mx-auto">
                {/* Header */}
                <motion.div
                    className="space-y-1 p-3 md:p-0"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.55 }}
                >
                    <h1 className="text-3xl sm:text-4xl font-bold tracking-tight bg-linear-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                        {t('AdminPage.Dashboard.Title')}
                    </h1>
                    <p className="text-sm sm:text-base text-muted-foreground">{t('AdminPage.Dashboard.Description')}</p>
                </motion.div>

                {/* --- Summary Cards --- */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {(isSuperAdmin || has("MANAGE_FINANCE")) && stats.summary.finance && (
                        <StatsCard
                            title={t("AdminPage.Dashboard.TotalRevenue")}
                            value={`${t("General.CurrencySymbols")}${stats.summary.finance.totalRevenue.toLocaleString(t("General.locale"))}`}
                            growth={stats.summary.finance.growth}
                            icon={DollarSign}
                            color="text-emerald-500"
                            bg="bg-emerald-500/10"
                            animationDelay={0}
                        />
                    )}
                    {(isSuperAdmin || has(["MANAGE_USERS", "MANAGE_STAFF"])) && stats.summary.users && (
                        <StatsCard
                            title={t("AdminPage.Dashboard.ActiveUsers")}
                            value={stats.summary.users.active.toLocaleString(t("General.locale"))}
                            growth={stats.summary.users.growth}
                            icon={Users}
                            color="text-blue-500"
                            bg="bg-blue-500/10"
                            subText={t("AdminPage.Dashboard.NewUsers")}
                            animationDelay={0.2}
                        />
                    )}
                    {(isSuperAdmin || has("MANAGE_BOOKS")) && stats.summary.content && (
                        <StatsCard
                            title={t("Books.TotalBooks")}
                            value={stats.summary.content.books.toLocaleString(t("General.locale"))}
                            growth={stats.summary.content.growth}
                            icon={BookOpen}
                            color="text-orange-500"
                            bg="bg-orange-500/10"
                            subText={t("AdminPage.Dashboard.NTotalChapters", {NChapters: stats.summary.content.chapters})}
                            animationDelay={0.4}
                        />
                    )}
                </div>

                {/* --- Charts Section --- */}
                <motion.div
                    className="grid grid-cols-1 lg:grid-cols-7 gap-6"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3, duration: 0.5 }}
                >

                    {/* Revenue Trend (Big Chart) */}
                    {(isSuperAdmin || has("MANAGE_FINANCE")) && stats.summary.finance && (
                        <Card className="lg:col-span-4 border-border/60 shadow-sm">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    <TrendingUp className="size-5 text-primary" />{t("AdminPage.Dashboard.RevenueTrend")}
                                </CardTitle>
                                <CardDescription>{t("AdminPage.Dashboard.RevenueTrendDescription")}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ChartContainer config={{ amount: { label: t("AdminPage.Dashboard.Revenue"), color: "var(--chart-1)" } }} className="h-75 w-full">
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
                                        <Area
                                            type="monotone"
                                            dataKey="amount"
                                            stroke="var(--chart-1)"
                                            fillOpacity={1}
                                            fill="url(#fillAmount)"
                                            strokeWidth={2}
                                            isAnimationActive={true}
                                            animationBegin={600}
                                            animationDuration={1200}
                                            animationEasing="ease-in-out"
                                        />
                                    </AreaChart>
                                </ChartContainer>
                            </CardContent>
                        </Card>
                    )}

                    {/* Distribution Charts (Tabs) */}
                    {(isSuperAdmin || has(["MANAGE_USERS", "MANAGE_BOOKS"])) && (
                        <Card className="lg:col-span-3 border-border/60 shadow-sm">
                            <CardHeader className="pb-2">
                                <CardTitle>{t("AdminPage.Dashboard.Distributions")}</CardTitle>
                                <CardDescription>{t("AdminPage.Dashboard.DistributionsDescription")}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Tabs defaultValue="types" className="w-full">
                                    <TabsList className="grid w-full grid-cols-3 mb-4">
                                        <TabsTrigger className="data-[state=active]:text-foreground dark:data-[state=active]:text-foreground" value="users">{t("AdminPage.Dashboard.UserStatus")}</TabsTrigger>
                                        <TabsTrigger className="data-[state=active]:text-foreground dark:data-[state=active]:text-foreground" value="genres">{t("AdminPage.Dashboard.GenreDist")}</TabsTrigger>
                                        <TabsTrigger className="data-[state=active]:text-foreground dark:data-[state=active]:text-foreground" value="types">{t("AdminPage.Dashboard.typeDist")}</TabsTrigger>
                                    </TabsList>
                                    <TabsContent value="genres" className="h-62.5 outline-hidden">
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.3 }}
                                        >
                                            {stats.charts?.genreDistribution && stats.charts.genreDistribution.length > 0 ? (
                                                <RadarChartWrapper data={stats.charts.genreDistribution} gradientId="radar-genre" />
                                            ) : (
                                                <EmptyState text={t("AdminPage.Dashboard.NoGenreData")} />
                                            )}
                                        </motion.div>
                                    </TabsContent>
                                    <TabsContent value="types" className="h-62.5 outline-hidden">
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.3 }}
                                        >
                                            {stats.charts?.typeDistribution && stats.charts.typeDistribution.length > 0 ? (
                                                <RadarChartWrapper data={stats.charts.typeDistribution} gradientId="radar-type" />
                                            ) : (
                                                <EmptyState text={t("AdminPage.Dashboard.NoTypeData")} />
                                            )}
                                        </motion.div>
                                    </TabsContent>
                                    <TabsContent value="users" className="h-62.5 outline-hidden">
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.3 }}
                                        >
                                            <PieChartWrapper data={userStatusData} activeIndex={0} />
                                        </motion.div>
                                    </TabsContent>
                                </Tabs>
                            </CardContent>
                        </Card>
                    )}
                </motion.div>

                {/* User Growth Bar Chart */}
                {(isSuperAdmin || has(["MANAGE_USERS", "MANAGE_STAFF"])) && stats.charts?.userRegistrations && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.3, duration: 0.5 }}
                    >
                        <Card className="border-border/60 shadow-sm">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <UserPlus className="size-5 text-blue-500" /> {t("AdminPage.Dashboard.NewUserRegistrations")}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ChartContainer config={{ users: { label: t("AdminPage.Dashboard.Users"), color: "var(--chart-2)" } }} className="h-62.5 w-full">
                                    <BarChart data={stats.charts.userRegistrations}>
                                        <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-muted" />
                                        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={10} className="text-xs" />
                                        <ChartTooltip cursor={{ fill: 'var(--muted)', opacity: 0.4 }} content={<ChartTooltipContent />} />
                                        <Bar
                                            dataKey="users"
                                            fill="var(--chart-2)"
                                            radius={[4, 4, 0, 0]}
                                            barSize={40}
                                            isAnimationActive={true}
                                            animationBegin={1000}
                                            animationDuration={1500}
                                        />
                                    </BarChart>
                                </ChartContainer>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}

                {/* --- Detailed Lists --- */}
                <motion.div
                    className="grid grid-cols-1 lg:grid-cols-2 gap-6"
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-50px" }}
                    variants={{
                        hidden: { opacity: 0 },
                        visible: { opacity: 1, transition: { staggerChildren: 0.2, delayChildren: 0.4 } }
                    }}
                >

                    {/* Recent Transactions */}
                    {(isSuperAdmin || has("MANAGE_FINANCE")) && (
                        <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } }}>
                            <Card className="border-border/60 shadow-sm h-full">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-lg">
                                        <DollarSign className="size-5 text-emerald-500" /> {t("AdminPage.Dashboard.RecentTransactions")}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="border-border/50 hover:bg-transparent">
                                                <TableHead className="rtl:text-right">{t("AdminPage.Transactions.User")}</TableHead>
                                                <TableHead className="text-right rtl:text-left">{t("AdminPage.Transactions.Amount")}</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {stats.recent.transactions.length === 0 ? <EmptyRow text={t("AdminPage.Transactions.NoTransactionsFound")} /> : (
                                                stats.recent.transactions.map((g) => (
                                                    <TableRow key={g.id} className="hover:bg-muted/50">
                                                        <TableCell>
                                                            <div className="flex flex-col">
                                                                <span className="font-medium text-sm">{g.username}</span>
                                                                <span className="text-xs text-muted-foreground">{new Date(g.createdAt).toLocaleDateString(t("General.locale"))}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <span className={`font-semibold flex items-center justify-end gap-1 ${g.type === 'CREDIT' ? 'text-emerald-600' : 'text-red-600'}`}>
                                                                {g.type === 'CREDIT' ? <ArrowUpCircle className="size-3"/> : <ArrowDownCircle className="size-3"/>}
                                                                {g.type === 'CREDIT' ? '+' : '-'}{t("General.CurrencySymbols")}{g.amount.toLocaleString(t("General.locale"))}
                                                            </span>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        </motion.div>
                    )}

                    {/* Recent Content (Books & Chapters) */}
                    {(isSuperAdmin || has("MANAGE_BOOKS")) && (
                        <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } }}>
                            <Card className="border-border/60 shadow-sm h-full">
                                <CardHeader className="pb-3">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="flex items-center gap-2 text-lg">
                                            <Layers className="size-5 text-orange-500" /> {t("AdminPage.Dashboard.RecentContent")}
                                        </CardTitle>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <Tabs defaultValue="books" className="w-full">
                                        <div className="px-6 pb-2">
                                            <TabsList className="w-full grid grid-cols-2">
                                                <TabsTrigger className="data-[state=active]:text-foreground dark:data-[state=active]:text-foreground" value="books">{t("AdminPage.Dashboard.NewBooks")}</TabsTrigger>
                                                <TabsTrigger className="data-[state=active]:text-foreground dark:data-[state=active]:text-foreground" value="chapters">{t("AdminPage.Dashboard.NewChapters")}</TabsTrigger>
                                            </TabsList>
                                        </div>

                                        <TabsContent value="books" className="mt-0">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="border-border/50 hover:bg-transparent">
                                                        <TableHead className="rtl:text-right">{t("AdminPage.Dashboard.BooksTitle")}</TableHead>
                                                        <TableHead className="rtl:text-right">{t("AdminPage.Dashboard.BooksDate")}</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {stats.recent.books.length === 0 ? <EmptyRow text={t("AdminPage.Dashboard.NoNewBooks")} /> : (
                                                        stats.recent.books.map((b) => (
                                                            <TableRow key={b.id}>
                                                                <TableCell>
                                                                    <div className="font-medium text-sm truncate max-w-50">{b.title}</div>
                                                                    <div className="text-xs text-muted-foreground">{b.author || t("Books.Unknown")}</div>
                                                                </TableCell>
                                                                <TableCell className="text-xs text-muted-foreground">{new Date(b.createdAt).toLocaleDateString(t("General.locale"))}</TableCell>
                                                            </TableRow>
                                                        ))
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </TabsContent>

                                        <TabsContent value="chapters" className="mt-0">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="border-border/50 hover:bg-transparent">
                                                        <TableHead className="rtl:text-right">{t("AdminPage.Dashboard.Chapter")}</TableHead>
                                                        <TableHead className="rtl:text-right">{t("AdminPage.Dashboard.Book")}</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {stats.recent.chapters.length === 0 ? <EmptyRow text={t("NoNewChapters")} /> : (
                                                        stats.recent.chapters.map((c) => (
                                                            <TableRow key={c.id}>
                                                                <TableCell className="font-medium text-sm">{c.title}</TableCell>
                                                                <TableCell>
                                                                    <div className="text-xs truncate max-w-37.5">{c.bookTitle}</div>
                                                                    <div className="text-[10px] text-muted-foreground">{new Date(c.createdAt).toLocaleDateString(t("General.locale"))}</div>
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
                        </motion.div>
                    )}
                </motion.div>
            </div>
        </div>
    )
}

// --- Sub Components ---

function StatsCard({ title, value, growth, icon: Icon, color, bg, subText, animationDelay }: any) {
    const t = useTranslations("AdminPage.Dashboard");
    const isPositive = growth >= 0
    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: animationDelay, duration: 0.35 }}
        >
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
                        <span className="text-muted-foreground ms-1">{subText || t("fromLastMonth")}</span>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    )
}

function orderOthersLast(data: { name: string; value: number }[]) {
    const isOthers = (x: { name: string }) => x.name.trim().toLowerCase() === "others"
    const rest = data.filter((x) => !isOthers(x))
    const others = data.filter(isOthers)
    return [...rest, ...others]
}

function OrderedChartLegend({orderedData, total}:{orderedData: any, total: number}){
    return (
        <motion.div
            className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-x-3 gap-y-2 text-xs"
            initial="hidden"
            animate="visible"
            variants={{
                hidden: { opacity: 0 },
                visible: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.2 } }
            }}
        >
            {orderedData.map((item:any, index:number) => (
                <motion.div
                    key={`legend-${item.name}-${index}`}
                    className="flex items-center gap-2 min-w-0"
                    variants={{
                        hidden: { opacity: 0, y: 10 },
                        visible: { opacity: 1, y: 0 }
                    }}
                >
                        <span
                            className="size-2.5 rounded-sm shrink-0"
                            style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                            aria-hidden="true"
                        />
                    <span className="truncate">{item.name}</span>
                    <span className="ml-auto tabular-nums font-semibold">
                            {Number(item.value || 0).toLocaleString()}
                        </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                            {total > 0 ? Math.round((item.value / total) * 100) : 0}%
                        </span>
                </motion.div>
            ))}
        </motion.div>
    )
}

function PieChartWrapper({ data, activeIndex = 0 }: { data: { name: string; value: number }[], activeIndex:number }) {
    const ordered = orderOthersLast(Array.isArray(data) ? data : []).map((item, index) => ({
        ...item,
        fill: CHART_COLORS[index % CHART_COLORS.length]
    }));
    const total = ordered.reduce((acc, cur) => acc + (Number(cur.value) || 0), 0)
    const renderActiveShape = (props: any) => {
        return (
            <>
                <Sector
                    {...props}
                    outerRadius={94}
                    fill={props.fill}
                    opacity={0.2}
                />

                <Sector
                    {...props}
                    outerRadius={86}
                    fill={props.fill}
                    stroke="white"
                    strokeWidth={2}
                />
            </>
        );
    };
    return (
        <div className="h-full w-full flex flex-col">
            {/* Chart */}
            <div className="flex-1 min-h-0">
                <ChartContainer config={{}} className="h-full w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={ordered}
                                cx="50%"
                                cy="50%"
                                nameKey="name"
                                innerRadius={60}
                                outerRadius={75}
                                paddingAngle={10}
                                cornerRadius={5}
                                dataKey="value"
                                activeIndex={activeIndex}
                                activeShape={renderActiveShape}
                                isAnimationActive={true}
                                animationBegin={200}
                                animationDuration={900}
                            >
                                <Label
                                    content={({ viewBox }) => {
                                        if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                                            const activeItem = ordered[activeIndex] || ordered[0]
                                            return (
                                                <text
                                                    x={viewBox.cx}
                                                    y={viewBox.cy}
                                                    textAnchor="middle"
                                                    dominantBaseline="middle"
                                                >
                                                    <tspan
                                                        x={viewBox.cx}
                                                        y={viewBox.cy}
                                                        className="fill-foreground text-2xl font-bold tabular-nums"
                                                    >
                                                        {Number(activeItem?.value || 0).toLocaleString()}
                                                    </tspan>
                                                    <tspan
                                                        x={viewBox.cx}
                                                        y={(viewBox.cy || 0) + 20}
                                                        className="fill-muted-foreground text-xs"
                                                    >
                                                        {activeItem?.name}
                                                    </tspan>
                                                </text>
                                            )
                                        }
                                    }}
                                />
                            </Pie>
                            <ChartTooltip content={<ChartTooltipContent />} />
                        </PieChart>
                    </ResponsiveContainer>
                </ChartContainer>
            </div>

            <OrderedChartLegend orderedData={ordered} total={total} />

        </div>
    )
}

function RadarChartWrapper({ data, gradientId }: {
    data: { name: string; value: number }[]
    gradientId: string
}) {
    const ordered = orderOthersLast(Array.isArray(data) ? data : []).map((item, index) => ({
        ...item,
        fill: CHART_COLORS[index % CHART_COLORS.length]
    }));
    const total = ordered.reduce((acc, cur) => acc + (Number(cur.value) || 0), 0)
    // "Others" is excluded from the radar plot but still shown in the legend below
    const isOthers = (x: { name: string }) => x.name.trim().toLowerCase() === "others"
    const radarData = (Array.isArray(data) ? data : []).filter((d) => !isOthers(d))
    const max = Math.max(...radarData.map((d) => d.value))

    return (
        <>
            <ChartContainer
                config={{ value: { label: "Count", color: "var(--chart-1)" } }}
                className="h-full w-full"
            >
                <RadarChart accessibilityLayer data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                    <defs>
                        <linearGradient id={`${gradientId}-fill`} x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor={`var(--color-value)`} stopOpacity={0.45} />
                            <stop offset="100%" stopColor={`var(--color-value)`} stopOpacity={0.1} />
                        </linearGradient>
                        <filter id={`${gradientId}-glow`} x="-15%" y="-15%" width="130%" height="130%">
                            <feGaussianBlur stdDeviation="4" result="blur" />
                            <feComposite in="SourceGraphic" in2="blur" operator="over" />
                        </filter>
                    </defs>
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <PolarAngleAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <PolarGrid strokeDasharray="3 3" />
                    <PolarRadiusAxis
                        angle={90}
                        domain={[0, max]}
                        tick={false}
                        axisLine={false}
                    />
                    <Radar
                        dataKey="value"
                        fill={`url(#${gradientId}-fill)`}
                        stroke="var(--color-value)"
                        strokeWidth={2.5}
                        filter={`url(#${gradientId}-glow)`}
                        dot={{
                            r: 4,
                            fill: "var(--background)",
                            strokeWidth: 2.5,
                            stroke: "var(--color-value)",
                        }}
                        isAnimationActive={true}
                        animationBegin={200}
                        animationDuration={900}
                    />
                </RadarChart>
            </ChartContainer>
            <OrderedChartLegend orderedData={ordered} total={total} />
        </>
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
        <div className="min-h-screen bg-linear-to-br from-muted/30 via-background to-muted/20">
            <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-400 mx-auto">
                <div className="space-y-2 p-3 md:p-0">
                    <div className="h-8 w-72 rounded-lg bg-muted animate-pulse" />
                    <div className="h-4 w-48 rounded-md bg-muted animate-pulse" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => <div key={i} className="h-40 bg-muted rounded-xl animate-pulse" />)}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
                    <div className="lg:col-span-4 h-100 bg-muted rounded-xl animate-pulse" />
                    <div className="lg:col-span-3 h-100 bg-muted rounded-xl animate-pulse" />
                </div>
            </div>
        </div>
    )
}
