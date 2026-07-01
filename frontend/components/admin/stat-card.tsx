"use client"

import { motion } from "framer-motion"
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export interface StatCardProps {
  title: string
  value: string
  hint?: string
  icon: LucideIcon
  growth?: number | null
  accent?: "primary" | "emerald" | "amber" | "rose"
  index?: number
}

const accentMap: Record<NonNullable<StatCardProps["accent"]>, string> = {
  primary: "bg-primary/10 text-primary",
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
}

export function StatCard({
  title,
  value,
  hint,
  icon: Icon,
  growth,
  accent = "primary",
  index = 0,
}: StatCardProps) {
  const t = useTranslations("AdminPage.Dashboard")
  const hasGrowth = typeof growth === "number" && Number.isFinite(growth)
  const isUp = hasGrowth && (growth as number) >= 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05, ease: "easeOut" }}
    >
      <Card className="h-full overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
          <div
            className={cn(
              "grid h-9 w-9 shrink-0 place-items-center rounded-xl",
              accentMap[accent]
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="truncate text-2xl font-bold tracking-tight text-foreground">
            {value}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {hasGrowth && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium",
                  isUp
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                )}
              >
                {isUp ? (
                  <ArrowUpRight className="h-3 w-3" />
                ) : (
                  <ArrowDownRight className="h-3 w-3" />
                )}
                {`${isUp ? "+" : ""}${(growth as number).toFixed(1)}%`}
              </span>
            )}
            {hint && <span className="text-muted-foreground">{hint}</span>}
            {hasGrowth && !hint && (
              <span className="text-muted-foreground">
                {t("VsPrevious30d")}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
