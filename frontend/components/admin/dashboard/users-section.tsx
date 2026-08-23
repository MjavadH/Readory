'use client';

import { motion } from 'framer-motion';
import { ShieldAlert, Users2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';

export interface UsersData {
  bannedTotal: number;
  roleDistribution: Array<{ role: string; count: number }>;
  registrationTimeline: Array<{ date: string; count: number }>;
}

const chartConfig: ChartConfig = {
  count: { label: 'Users', color: 'var(--chart-1)' },
};

export function UsersSection({ data }: { data: UsersData }) {
  const t = useTranslations('AdminPage.Dashboard.Users');
  const locale = useLocale();
  const formatter = new Intl.NumberFormat(locale);
  const monthFormatter = new Intl.DateTimeFormat(locale, {
    month: 'short',
  });

  const timeline = data.registrationTimeline.map((row) => ({
    ...row,
    label: monthFormatter.format(new Date(row.date)),
  }));

  return (
    <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="lg:col-span-2"
      >
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">{t('RegistrationsTitle')}</CardTitle>
            <CardDescription>{t('RegistrationsDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-55 w-full sm:h-60 lg:h-65">
              <div dir="ltr" className="h-full w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={timeline} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                      axisLine={false}
                      tickLine={false}
                      width={40}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" fill="var(--color-count)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartContainer>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05, ease: 'easeOut' }}
        className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-1"
      >
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="min-w-0 truncate text-sm font-medium text-muted-foreground">
              {t('BannedTitle')}
            </CardTitle>
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-destructive/10 text-destructive">
              <ShieldAlert className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight">
              {formatter.format(data.bannedTotal)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{t('BannedHint')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Users2 className="h-4 w-4 text-primary" />
              {t('RoleDistributionTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.roleDistribution.length === 0 && (
              <p className="py-2 text-sm text-muted-foreground">{t('Empty')}</p>
            )}
            {data.roleDistribution.map((r) => (
              <div key={r.role} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-muted-foreground">{r.role}</span>
                <span className="shrink-0 font-semibold tabular-nums">
                  {formatter.format(r.count)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
