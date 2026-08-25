'use client';

import { motion } from 'framer-motion';
import { BookOpen, Flame, Star } from 'lucide-react';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { getBookCoverThumbnailUrl } from '@/lib/media';

export interface ContentData {
  trendingBooks?: Array<{
    id: number;
    title: string;
    trendScore: number;
    coverImage?: string | null;
  }>;
  topAccessedBooks: Array<{
    accessCount: number;
    book?: { id: number; title: string; coverImage?: string | null } | null;
  }>;
  highestRatedBooks: Array<{
    id: number;
    title: string;
    ratingAvg: number;
    ratingCount: number;
  }>;
  genreDistribution: Array<{ name: string; count: number }>;
  typeDistribution: Array<{ name: string; count: number }>;
}

const PALETTE = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];

const genreConfig: ChartConfig = {
  count: { label: 'Books', color: 'var(--chart-2)' },
};

export function ContentSection({ data }: { data: ContentData }) {
  const t = useTranslations('AdminPage.Dashboard.Content');
  const locale = useLocale();
  const formatter = new Intl.NumberFormat(locale);

  const topAccessed = data.topAccessedBooks.filter((b) => b.book);
  const genreData = data.genreDistribution.slice(0, 8);
  const typeData = data.typeDistribution;
  const trending = data.trendingBooks ?? [];

  return (
    <div className="space-y-4">
      {trending.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Flame className="h-4 w-4 text-orange-500" />
                {t('TrendingTitle')}
              </CardTitle>
              <CardDescription>{t('TrendingDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="-mx-4 scrollbar-thin overflow-x-auto px-4">
                <div className="flex gap-3">
                  {trending.slice(0, 10).map((b, i) => (
                    <div key={b.id} className="group flex w-40 shrink-0 flex-col gap-2 ">
                      <div className="relative aspect-2/3 w-full overflow-hidden rounded-lg bg-muted">
                        {b.coverImage ? (
                          <Image
                            src={getBookCoverThumbnailUrl(b.coverImage)}
                            alt={b.title}
                            fill
                            sizes="(max-width: 480px) 45vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 200px"
                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          />
                        ) : (
                          <div className="grid h-full w-full place-items-center text-muted-foreground">
                            <BookOpen className="h-6 w-6" />
                          </div>
                        )}
                        <div className="absolute inset-s-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-background/90 text-[11px] font-bold shadow">
                          {i + 1}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-xs font-medium leading-snug">{b.title}</p>
                        <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                          {t('Score', { score: formatter.format(Math.round(b.trendScore)) })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <BookOpen className="h-4 w-4 text-primary" />
                {t('TopAccessedTitle')}
              </CardTitle>
              <CardDescription>{t('TopAccessedDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {topAccessed.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">{t('Empty')}</p>
              )}
              {topAccessed.map((row, i) => (
                <div
                  key={row.book?.id}
                  className="flex items-center gap-3 rounded-lg border border-transparent p-2 transition-colors hover:border-border hover:bg-muted/40"
                >
                  <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                    {i + 1}
                  </div>
                  {row.book?.coverImage ? (
                    <Image
                      src={getBookCoverThumbnailUrl(row.book?.coverImage)}
                      alt={row.book?.title}
                      width={36}
                      height={48}
                      className="h-12 w-9 shrink-0 rounded object-cover"
                    />
                  ) : (
                    <div className="grid h-12 w-9 shrink-0 place-items-center rounded bg-muted text-muted-foreground">
                      <BookOpen className="h-4 w-4" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{row.book?.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {t('Accesses', { count: formatter.format(row.accessCount) })}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05, ease: 'easeOut' }}
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Star className="h-4 w-4 text-amber-500" />
                {t('HighestRatedTitle')}
              </CardTitle>
              <CardDescription>{t('HighestRatedDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.highestRatedBooks.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">{t('Empty')}</p>
              )}
              {data.highestRatedBooks.map((b, i) => (
                <div
                  key={b.id}
                  className="flex items-center gap-3 rounded-lg border border-transparent p-2 transition-colors hover:border-border hover:bg-muted/40"
                >
                  <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{b.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {t('Ratings', { count: formatter.format(b.ratingCount) })}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 text-sm font-semibold tabular-nums">
                    <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                    {b.ratingAvg.toFixed(1)}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-5">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1, ease: 'easeOut' }}
          className="lg:col-span-3"
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">{t('GenreDistributionTitle')}</CardTitle>
              <CardDescription>{t('GenreDistributionDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={genreConfig} className="h-65 w-full sm:h-70">
                <div dir="ltr" className="h-full w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={genreData}
                      layout="vertical"
                      margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
                    >
                      <XAxis
                        type="number"
                        tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                        axisLine={false}
                        tickLine={false}
                        width={90}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="count" fill="var(--color-count)" radius={[0, 6, 6, 0]} />
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
          transition={{ duration: 0.35, delay: 0.15, ease: 'easeOut' }}
          className="lg:col-span-2"
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">{t('TypeDistributionTitle')}</CardTitle>
              <CardDescription>{t('TypeDistributionDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-60 w-full sm:h-65 lg:h-70" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip
                      contentStyle={{
                        background: 'var(--popover)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        fontSize: 12,
                        color: 'var(--popover-foreground)',
                      }}
                      itemStyle={{ color: 'var(--popover-foreground)' }}
                      labelStyle={{ color: 'var(--popover-foreground)' }}
                      formatter={(value: number, name: string) => [formatter.format(value), name]}
                    />
                    <Pie
                      data={typeData}
                      dataKey="count"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={95}
                      paddingAngle={2}
                    >
                      {typeData.map((type) => (
                        <Cell
                          key={type.name}
                          fill={
                            PALETTE[
                              typeData.findIndex((item) => item.name === type.name) % PALETTE.length
                            ]
                          }
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
                {typeData.map((tp, i) => (
                  <div key={tp.name} className="flex items-center gap-2 text-xs">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
                    />
                    <span className="text-muted-foreground">{tp.name}</span>
                    <span className="font-medium tabular-nums">{formatter.format(tp.count)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
