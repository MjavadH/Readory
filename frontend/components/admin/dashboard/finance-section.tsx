"use client"

import { motion } from "framer-motion"
import { Crown, Flame, PiggyBank, TrendingDown, TrendingUp } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

export interface FinanceData {
  riskManagement?: {
    stagnantCapital: number
    deposit30d: number
    spent30d: number
    burnRateRatio: number
  }
  topSpenders: Array<{
    spent: number
    user?: { id: number; username: string; email: string } | null
  }>
  dailyRevenue: Array<{ date: string; amount: number }>
}

const chartConfig: ChartConfig = {
  amount: {
    label: "Revenue",
    color: "var(--chart-1)",
  },
}

export function FinanceSection({ data }: { data: FinanceData }) {
  const t = useTranslations("AdminPage.Dashboard.Finance")
  const locale = useLocale()

  const formatter = new Intl.NumberFormat(locale)
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
  })

  const chartData = data.dailyRevenue.map((d) => ({
    ...d,
    label: dateFormatter.format(new Date(d.date)),
  }))

  const risk = data.riskManagement

  return (
    <div className="space-y-4">
      {risk && (
        <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
          <RiskCard
            title={t("StagnantCapital")}
            value={formatter.format(risk.stagnantCapital)}
            icon={<PiggyBank className="h-4 w-4" />}
            accent="text-sky-500 bg-sky-500/10"
            delay={0}
          />
          <RiskCard
            title={t("Deposit30d")}
            value={formatter.format(risk.deposit30d)}
            icon={<TrendingUp className="h-4 w-4" />}
            accent="text-emerald-500 bg-emerald-500/10"
            delay={0.05}
          />
          <RiskCard
            title={t("Spent30d")}
            value={formatter.format(risk.spent30d)}
            icon={<TrendingDown className="h-4 w-4" />}
            accent="text-rose-500 bg-rose-500/10"
            delay={0.1}
          />
          <RiskCard
            title={t("BurnRate")}
            value={`${(risk.burnRateRatio * 100).toFixed(1)}%`}
            icon={<Flame className="h-4 w-4" />}
            accent="text-amber-500 bg-amber-500/10"
            delay={0.15}
          />
        </div>
      )}

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="lg:col-span-2"
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">{t("RevenueTitle")}</CardTitle>
              <CardDescription>{t("RevenueDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={chartConfig}
                className="h-55 w-full sm:h-65 lg:h-70"
              >
                <div dir="ltr" className="h-full w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--color-amount)" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="var(--color-amount)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                      <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                        minTickGap={24}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                        width={48}
                        tickFormatter={(v) => formatter.format(v)}
                      />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            formatter={(value) => formatter.format(Number(value))}
                          />
                        }
                      />
                      <Area
                        type="monotone"
                        dataKey="amount"
                        stroke="var(--color-amount)"
                        strokeWidth={2}
                        fill="url(#revenueFill)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </ChartContainer>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05, ease: "easeOut" }}
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Crown className="h-4 w-4 text-amber-500" />
                {t("TopSpendersTitle")}
              </CardTitle>
              <CardDescription>{t("TopSpendersDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.topSpenders.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {t("NoSpenders")}
                </p>
              )}
              {data.topSpenders.map((s, i) => {
                const name = s.user?.username ?? t("UnknownUser")
                const initials = name.slice(0, 2).toUpperCase()
                return (
                  <div
                    key={s.user?.id ?? i}
                    className="flex items-center gap-3 rounded-lg border border-transparent p-2 transition-colors hover:border-border hover:bg-muted/40"
                  >
                    <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                      {i + 1}
                    </div>
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{name}</p>
                      {s.user?.email && (
                        <p className="truncate text-xs text-muted-foreground">
                          {s.user.email}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-sm font-semibold tabular-nums">
                      {formatter.format(s.spent)}
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}

function RiskCard({
  title,
  value,
  icon,
  accent,
  delay,
}: {
  title: string
  value: string
  icon: React.ReactNode
  accent: string
  delay: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay, ease: "easeOut" }}
    >
      <Card className="h-full">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-xs font-medium text-muted-foreground">
              {title}
            </span>
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${accent}`}>
              {icon}
            </span>
          </div>
          <div className="mt-2 truncate text-lg font-bold tabular-nums sm:text-xl">
            {value}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
