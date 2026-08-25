'use client';

import { motion } from 'framer-motion';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const CHART_BAR_SKELETON_COUNT = 8;
const CHART_BAR_SKELETON_KEYS = Array.from(
  { length: CHART_BAR_SKELETON_COUNT },
  (_, i) => `dashboard-chart-bar-skeleton-${i}`,
);

const TRENDING_SKELETON_COUNT = 5;
const TRENDING_SKELETON_KEYS = Array.from(
  { length: TRENDING_SKELETON_COUNT },
  (_, i) => `dashboard-trending-skeleton-${i}`,
);

const FINANCE_RISK_SKELETON_COUNT = 4;
const FINANCE_RISK_SKELETON_KEYS = Array.from(
  { length: FINANCE_RISK_SKELETON_COUNT },
  (_, i) => `dashboard-finance-risk-skeleton-${i}`,
);

const USERS_SKELETON_COUNT = 4;
const USERS_SKELETON_KEYS = Array.from(
  { length: USERS_SKELETON_COUNT },
  (_, i) => `dashboard-users-skeleton-${i}`,
);

const DASHBOARD_STAT_SKELETON_COUNT = 4;
const DASHBOARD_STAT_SKELETON_KEYS = Array.from(
  { length: DASHBOARD_STAT_SKELETON_COUNT },
  (_, i) => `dashboard-stat-skeleton-${i}`,
);

const shimmer = {
  initial: { opacity: 0.6 },
  animate: { opacity: 1 },
  transition: { duration: 1.1, repeat: Infinity, repeatType: 'reverse' as const },
};

const rise = (i = 0) => ({
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, delay: i * 0.05, ease: 'easeOut' as const },
});

export function StatCardSkeleton({ index = 0 }: { index?: number }) {
  return (
    <motion.div {...rise(index)}>
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <Skeleton className="h-3.5 w-20 sm:w-24" />
          <Skeleton className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-7 sm:h-8 w-24 sm:w-32" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-3 w-24" />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function RiskCardSkeleton({ index = 0 }: { index?: number }) {
  return (
    <motion.div {...rise(index)}>
      <Card className="h-full">
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-start gap-2 sm:gap-3">
            <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-16 sm:w-20" />
              <Skeleton className="h-5 w-20 sm:w-24" />
              <Skeleton className="h-2.5 w-24 sm:w-28" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function ChartCardSkeleton({
  className,
  height = 'h-[220px] sm:h-[260px] lg:h-[280px]',
}: {
  className?: string;
  height?: string;
}) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="space-y-2">
        <Skeleton className="h-4 sm:h-5 w-32 sm:w-40" />
        <Skeleton className="h-3 w-48 sm:w-56 max-w-full" />
      </CardHeader>
      <CardContent>
        <div className={cn('relative w-full overflow-hidden rounded-lg bg-muted/40', height)}>
          {/* mock axis */}
          <div className="absolute inset-x-4 bottom-4 top-4 flex items-end justify-between gap-2">
            {CHART_BAR_SKELETON_KEYS.map((key, i) => (
              <motion.div
                key={key}
                initial={{ height: '20%', opacity: 0.5 }}
                animate={{
                  height: `${30 + ((i * 17) % 60)}%`,
                  opacity: 1,
                }}
                transition={{
                  duration: 1.2,
                  delay: i * 0.06,
                  repeat: Infinity,
                  repeatType: 'reverse',
                }}
                className="w-full max-w-[10%] rounded-md bg-primary/15"
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ListCardSkeleton({
  rows = 5,
  className,
  withThumb = true,
}: {
  rows?: number;
  className?: string;
  withThumb?: boolean;
}) {
  const listSkeletonKeys = Array.from(
    { length: rows },
    (_, i) => `dashboard-list-row-skeleton-${i}`,
  );
  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="space-y-2">
        <Skeleton className="h-4 sm:h-5 w-32 sm:w-40" />
        <Skeleton className="h-3 w-48 sm:w-56 max-w-full" />
      </CardHeader>
      <CardContent className="space-y-3 sm:space-y-4">
        {listSkeletonKeys.map((key, i) => (
          <motion.div key={key} {...rise(i)} className="flex items-center gap-3">
            <Skeleton className="h-5 w-5 shrink-0 rounded-full" />
            {withThumb && <Skeleton className="h-10 w-8 sm:h-12 sm:w-9 shrink-0 rounded" />}
            <div className="flex-1 space-y-2 min-w-0">
              <Skeleton className="h-3 w-3/4 max-w-55" />
              <Skeleton className="h-2.5 w-1/2 max-w-35" />
            </div>
            <Skeleton className="h-4 w-10 sm:w-14 shrink-0" />
          </motion.div>
        ))}
      </CardContent>
    </Card>
  );
}

export function TrendingCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="space-y-2">
        <Skeleton className="h-4 sm:h-5 w-40" />
        <Skeleton className="h-3 w-56 max-w-full" />
      </CardHeader>
      <CardContent>
        <div className="-mx-1 overflow-x-auto pb-2">
          <div className="flex gap-3 px-1 sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {TRENDING_SKELETON_KEYS.map((key, i) => (
              <motion.div key={key} {...rise(i)} className="w-35 shrink-0 space-y-2 sm:w-auto">
                <Skeleton className="aspect-2/3 w-full rounded-lg" />
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-2.5 w-1/2" />
              </motion.div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function FinanceSectionSkeleton() {
  return (
    <motion.section {...shimmer} className="space-y-4">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-5 rounded" />
        <Skeleton className="h-5 w-32" />
      </div>
      <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
        {FINANCE_RISK_SKELETON_KEYS.map((key, i) => (
          <RiskCardSkeleton key={key} index={i} />
        ))}
      </div>
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        <ChartCardSkeleton className="lg:col-span-2" />
        <ListCardSkeleton withThumb={false} />
      </div>
    </motion.section>
  );
}

export function ContentSectionSkeleton() {
  return (
    <motion.section {...shimmer} className="space-y-4">
      <TrendingCardSkeleton />
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        <ListCardSkeleton />
        <ListCardSkeleton />
      </div>
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-5">
        <ChartCardSkeleton className="lg:col-span-3" />
        <ChartCardSkeleton className="lg:col-span-2" height="h-[220px] sm:h-[260px]" />
      </div>
    </motion.section>
  );
}

export function UsersSectionSkeleton() {
  return (
    <motion.section {...shimmer} className="space-y-4">
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        <ChartCardSkeleton className="lg:col-span-2" />
        <Card className="overflow-hidden">
          <CardHeader className="space-y-2">
            <Skeleton className="h-4 sm:h-5 w-32" />
            <Skeleton className="h-3 w-48 max-w-full" />
          </CardHeader>
          <CardContent className="space-y-3">
            {USERS_SKELETON_KEYS.map((key, i) => (
              <motion.div key={key} {...rise(i)} className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Skeleton className="h-3 w-20 sm:w-24" />
                  <Skeleton className="h-3 w-10" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
              </motion.div>
            ))}
          </CardContent>
        </Card>
      </div>
    </motion.section>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 sm:space-y-8">
      {/* KPI row */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 xl:grid-cols-4">
        {DASHBOARD_STAT_SKELETON_KEYS.map((key, i) => (
          <StatCardSkeleton key={key} index={i} />
        ))}
      </div>

      <FinanceSectionSkeleton />
      <ContentSectionSkeleton />
      <UsersSectionSkeleton />
    </div>
  );
}
