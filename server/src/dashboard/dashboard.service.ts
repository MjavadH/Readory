import { Injectable } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { CacheManager } from '../cache/cache.manager';
import { calculateGrowth, clampInt, enrichLibraryGroups, normalizePagination } from '../common';
import { PrismaService } from '../prisma/prisma.service';
import { WalletsService } from '../wallets/wallets.service';

type OverviewOptions = {
  txLimit: number;
  libraryLimit: number;
};

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly walletsService: WalletsService,
    private readonly cacheManager: CacheManager,
  ) {}

  private async countDistinctBooks(userId: number) {
    const rows = await this.prisma.$queryRaw<
      { count: bigint }[]
    >`SELECT COUNT(DISTINCT "bookId") AS count FROM "AccessRecord" WHERE "userId" = ${userId} AND "bookId" IS NOT NULL`;
    return Number(rows[0]?.count ?? 0n);
  }

  async getUserDashboardOverview(userId: number, options: OverviewOptions) {
    const txLimit = clampInt(options.txLimit, 1, 20, 6);
    const libraryLimit = clampInt(options.libraryLimit, 1, 30, 8);

    const [profile, continueReading, walletWithRecentTx, recentLibrary] = await Promise.all([
      this.authService.getProfile(userId),
      this.getContinueReading(userId),
      this.walletsService.getWallet(userId, { take: txLimit }),
      this.getRecentLibrary(userId, libraryLimit),
    ]);

    return {
      profile,
      wallet: { balance: walletWithRecentTx.balance },
      recentTransactions: walletWithRecentTx.transactions,
      continueReading,
      recentLibrary,
    };
  }

  async exportTransactionsCsv(userId: number) {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const transactions = await this.prisma.walletTransaction.findMany({
      where: {
        wallet: {
          userId,
        },
        createdAt: {
          gte: oneYearAgo,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Prevent CSV Formula Injection by sanitizing values starting with =, +, -, @
    const sanitizeForCsv = (val: any) => {
      const str = String(val ?? '');
      if (
        str.startsWith('=') ||
        str.startsWith('+') ||
        str.startsWith('-') ||
        str.startsWith('@')
      ) {
        return `'${str}`;
      }
      return str;
    };

    const rows = [
      ['Row', 'Transaction ID', 'Date', 'Type', 'Amount', 'Reference'],
      ...transactions.map((tx, index) => [
        index + 1,
        tx.id,
        tx.createdAt.toISOString(),
        tx.type,
        Number(tx.amount),
        sanitizeForCsv(tx.reference),
      ]),
    ];

    return rows
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');
  }

  async getUserLibrary(userId: number, page = 1, limit = 24) {
    const { page: pageSafe, limit: limitSafe, skip } = normalizePagination(page, limit, 100);

    const [totalBooks, groups] = await Promise.all([
      this.countDistinctBooks(userId),
      this.prisma.accessRecord.groupBy({
        by: ['bookId'],
        where: { userId },
        _count: { _all: true },
        _max: { purchasedAt: true },
        orderBy: { _max: { purchasedAt: 'desc' } },
        skip,
        take: limitSafe,
      }),
    ]);

    const items = await enrichLibraryGroups(this.prisma, groups);

    return {
      data: items,
      total: totalBooks,
      page: pageSafe,
      lastPage: Math.max(1, Math.ceil(totalBooks / limitSafe)),
    };
  }

  private async getRecentLibrary(userId: number, take: number) {
    const groups = await this.prisma.accessRecord.groupBy({
      by: ['bookId'],
      where: { userId },
      _count: { _all: true },
      _max: { purchasedAt: true },
      orderBy: { _max: { purchasedAt: 'desc' } },
      take,
    });

    const items = await enrichLibraryGroups(this.prisma, groups);

    return {
      data: items,
    };
  }

  async getContinueReading(userId: number) {
    const row = await this.prisma.readingProgress.findFirst({
      where: { userId, percent: { lt: 100 } },
      orderBy: { updatedAt: 'desc' },
      select: {
        lastPage: true,
        percent: true,
        updatedAt: true,
        chapterId: true,
        bookId: true,
        book: {
          select: {
            id: true,
            type: { select: { slug: true, iconKey: true } },
            title: true,
            coverImage: true,
            contributors: {
              select: {
                role: true,
                contributor: { select: { name: true } },
              },
            },
          },
        },
        chapter: {
          select: {
            title: true,
            index: true,
            pageCount: true,
          },
        },
      },
    });

    if (!row) return null;

    const mainContributor =
      row.book.contributors.find((a) => a.role === 'AUTHOR') || row.book.contributors[0];

    return {
      book: {
        id: row.book.id,
        type: row.book.type,
        title: row.book.title,
        coverImage: row.book.coverImage,
        contributors: mainContributor ? mainContributor.contributor.name : null,
      },
      chapter: {
        title: row.chapter.title,
        index: row.chapter.index,
        pageCount: row.chapter.pageCount,
      },
      progress: {
        lastPage: row.lastPage,
        percent: row.percent,
      },
      lastReadAt: row.updatedAt,
    };
  }

  async getReadingProgress(userId: number, page = 1, limit = 24) {
    const { page: pageSafe, limit: limitSafe, skip } = normalizePagination(page, limit, 100);

    const total = await this.prisma.readingProgress.count({
      where: { userId, percent: { lt: 100 } },
    });

    const progressEntries = await this.prisma.readingProgress.findMany({
      where: { userId, percent: { lt: 100 } },
      include: {
        book: {
          select: {
            id: true,
            title: true,
            coverImage: true,
            type: { select: { slug: true, iconKey: true } },
            contributors: {
              select: {
                role: true,
                contributor: { select: { name: true } },
              },
            },
          },
        },
        chapter: {
          select: { title: true, index: true, pageCount: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
      skip,
      take: limitSafe,
    });

    return {
      data: progressEntries.map((p) => {
        const mainContributor =
          p.book.contributors.find((a) => a.role === 'AUTHOR') || p.book.contributors[0];

        return {
          book: {
            id: p.book.id,
            title: p.book.title,
            coverImage: p.book.coverImage,
            type: p.book.type,
            contributors: mainContributor ? mainContributor.contributor.name : null,
          },
          chapter: {
            title: p.chapter.title,
            index: p.chapter.index,
            pageCount: p.chapter.pageCount,
          },
          progress: { lastPage: p.lastPage, percent: p.percent },
          lastReadAt: p.updatedAt,
        };
      }),
      total,
      page: pageSafe,
      lastPage: Math.max(1, Math.ceil(total / limitSafe)),
    };
  }

  private getRollingDates() {
    const now = new Date();
    const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const d60 = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    // Normalized to the first day of 5 months ago to establish a clean 6-month historical window
    const m6 = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    m6.setHours(0, 0, 0, 0);

    return { now, d30, d60, m6 };
  }

  async getAdminOverview(permissions: string[], userId: number) {
    const isSuperAdmin = userId === 1;
    const canViewFinance = isSuperAdmin || permissions.includes('MANAGE_FINANCE');

    return this.cacheManager.getOrSet(
      'admin:dashboard:overview',
      { ttlSeconds: 300, earlyRefreshWindowSeconds: 30 },
      async () => {
        const { d30, d60 } = this.getRollingDates();

        const [
          totalUsers,
          newUsersLast30,
          newUsersPrev30,
          totalBooks,
          totalChapters,
          financeCurrent,
          financePrev,
        ] = await Promise.all([
          this.prisma.user.count(),
          this.prisma.user.count({ where: { createdAt: { gte: d30 } } }),
          this.prisma.user.count({ where: { createdAt: { gte: d60, lt: d30 } } }),
          this.prisma.book.count(),
          this.prisma.chapter.count(),
          canViewFinance
            ? this.prisma.walletTransaction.aggregate({
                where: { type: 'CREDIT', createdAt: { gte: d30 } },
                _sum: { amount: true },
              })
            : Promise.resolve({ _sum: { amount: 0 } }),
          canViewFinance
            ? this.prisma.walletTransaction.aggregate({
                where: { type: 'CREDIT', createdAt: { gte: d60, lt: d30 } },
                _sum: { amount: true },
              })
            : Promise.resolve({ _sum: { amount: 0 } }),
        ]);

        return {
          users: {
            total: totalUsers,
            new30d: newUsersLast30,
            growthPercent: calculateGrowth(newUsersLast30, newUsersPrev30),
          },
          content: {
            books: totalBooks,
            chapters: totalChapters,
          },
          finance: canViewFinance
            ? {
                revenue30d: Number(financeCurrent._sum.amount || 0),
                growthPercent: calculateGrowth(
                  Number(financeCurrent._sum.amount || 0),
                  Number(financePrev._sum.amount || 0),
                ),
              }
            : null,
        };
      },
    );
  }

  async getAdminFinanceData(permissions: string[], userId: number) {
    const isSuperAdmin = userId === 1;
    if (!isSuperAdmin && !permissions.includes('MANAGE_FINANCE')) return null;

    return this.cacheManager.getOrSet(
      'admin:dashboard:finance',
      { ttlSeconds: 1800, earlyRefreshWindowSeconds: 120 },
      async () => {
        const { d30 } = this.getRollingDates();

        const [recentTxs, topWallets, totalSystemBalances, recentActivity] = await Promise.all([
          this.prisma.walletTransaction.findMany({
            where: { type: 'CREDIT', createdAt: { gte: d30 } },
            select: { amount: true, createdAt: true },
          }),
          this.prisma.walletTransaction.groupBy({
            by: ['walletId'],
            where: { type: 'CREDIT' },
            _sum: { amount: true },
            orderBy: { _sum: { amount: 'desc' } },
            take: 5,
          }),
          this.prisma.wallet.aggregate({
            _sum: { balance: true },
          }),
          this.prisma.walletTransaction.groupBy({
            by: ['type'],
            where: { createdAt: { gte: d30 } },
            _sum: { amount: true },
          }),
        ]);

        const walletIds = topWallets.map((w) => w.walletId);
        const walletsMeta = await this.prisma.wallet.findMany({
          where: { id: { in: walletIds } },
          select: {
            id: true,
            user: { select: { id: true, username: true, email: true } },
          },
        });

        const topSpenders = topWallets.map((w) => ({
          spent: Number(w._sum.amount || 0),
          user: walletsMeta.find((meta) => meta.id === w.walletId)?.user,
        }));

        const chartMap = new Map<string, number>();
        for (let i = 0; i < 30; i++) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          chartMap.set(d.toISOString().split('T')[0], 0);
        }

        recentTxs.forEach((t) => {
          const day = t.createdAt.toISOString().split('T')[0];
          if (chartMap.has(day)) {
            chartMap.set(day, chartMap.get(day)! + Number(t.amount));
          }
        });

        const credit30d = Number(recentActivity.find((a) => a.type === 'CREDIT')?._sum.amount || 0);
        const debit30d = Number(recentActivity.find((a) => a.type === 'DEBIT')?._sum.amount || 0);

        return {
          riskManagement: {
            stagnantCapital: Number(totalSystemBalances._sum.balance || 0),
            deposit30d: credit30d,
            spent30d: debit30d,
            burnRateRatio: credit30d > 0 ? Number((debit30d / credit30d).toFixed(4)) : 0,
          },
          topSpenders,
          dailyRevenue: Array.from(chartMap.entries())
            .map(([date, amount]) => ({ date, amount }))
            .sort((a, b) => a.date.localeCompare(b.date)),
        };
      },
    );
  }

  async getAdminContentAnalytics(permissions: string[], userId: number) {
    const isSuperAdmin = userId === 1;
    if (!isSuperAdmin && !permissions.includes('MANAGE_BOOKS')) return null;

    return this.cacheManager.getOrSet(
      'admin:dashboard:content',
      { ttlSeconds: 900, earlyRefreshWindowSeconds: 60 },
      async () => {
        const [topAccessed, topRated, trending, genreDist, typeDist] = await Promise.all([
          this.prisma.accessRecord.groupBy({
            by: ['bookId'],
            _count: { bookId: true },
            orderBy: { _count: { bookId: 'desc' } },
            take: 5,
          }),
          this.prisma.book.findMany({
            where: { ratingCount: { gte: 5 } },
            orderBy: { ratingAvg: 'desc' },
            take: 6,
            select: { id: true, title: true, ratingAvg: true, ratingCount: true },
          }),
          this.prisma.book.findMany({
            orderBy: { trendScore: 'desc' },
            take: 10,
            select: { id: true, title: true, trendScore: true, coverImage: true },
          }),
          this.prisma.genre.findMany({
            select: { name: true, _count: { select: { books: true } } },
            orderBy: { books: { _count: 'desc' } },
            take: 8,
          }),
          this.prisma.bookType.findMany({
            select: { name: true, _count: { select: { books: true } } },
          }),
        ]);

        const bookIds = topAccessed.map((t) => t.bookId);
        const booksMeta = await this.prisma.book.findMany({
          where: { id: { in: bookIds } },
          select: { id: true, title: true, coverImage: true },
        });

        return {
          trendingBooks: trending.map((b) => ({
            ...b,
            trendScore: Number(b.trendScore),
          })),
          topAccessedBooks: topAccessed.map((access) => ({
            accessCount: access._count.bookId,
            book: booksMeta.find((b) => b.id === access.bookId),
          })),
          highestRatedBooks: topRated.map((b) => ({
            ...b,
            ratingAvg: Number(b.ratingAvg),
          })),
          genreDistribution: genreDist.map((g) => ({
            name: g.name,
            count: g._count.books,
          })),
          typeDistribution: typeDist.map((t) => ({
            name: t.name,
            count: t._count.books,
          })),
        };
      },
    );
  }

  async getAdminUserAnalytics(permissions: string[], userId: number) {
    const isSuperAdmin = userId === 1;
    if (
      !isSuperAdmin &&
      !permissions.includes('MANAGE_USERS') &&
      !permissions.includes('MANAGE_STAFF')
    ) {
      return null;
    }

    return this.cacheManager.getOrSet(
      'admin:dashboard:users',
      { ttlSeconds: 3600, earlyRefreshWindowSeconds: 300 },
      async () => {
        const { m6 } = this.getRollingDates();

        const [recentUsers, bannedCount, roleDist] = await Promise.all([
          this.prisma.user.findMany({
            where: { createdAt: { gte: m6 } },
            select: { createdAt: true },
          }),
          this.prisma.user.count({ where: { isBanned: true } }),
          this.prisma.role.findMany({
            select: { name: true, _count: { select: { users: true } } },
          }),
        ]);

        const monthMap = new Map<string, number>();
        const currentDate = new Date();

        for (let i = 0; i < 6; i++) {
          const d = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
          const isoFormat = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
          monthMap.set(isoFormat, 0);
        }

        recentUsers.forEach((u) => {
          const d = u.createdAt;
          const isoFormat = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
          if (monthMap.has(isoFormat)) {
            monthMap.set(isoFormat, monthMap.get(isoFormat)! + 1);
          }
        });

        return {
          bannedTotal: bannedCount,
          roleDistribution: roleDist.map((r) => ({
            role: r.name,
            count: r._count.users,
          })),
          registrationTimeline: Array.from(monthMap.entries())
            .map(([date, count]) => ({ date, count }))
            .sort((a, b) => a.date.localeCompare(b.date)),
        };
      },
    );
  }
}
