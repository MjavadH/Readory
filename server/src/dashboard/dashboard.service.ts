import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { WalletsService } from '../wallets/wallets.service';
import {
  clampInt,
  normalizePagination,
  calculateGrowth,
  enrichLibraryGroups,
} from '../common/index.js';

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

    const [profile, continueReading, walletWithRecentTx, recentLibrary] =
      await Promise.all([
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
      .map((row) =>
        row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','),
      )
      .join('\n');
  }

  async getUserLibrary(userId: number, page = 1, limit = 24) {
    const {
      page: pageSafe,
      limit: limitSafe,
      skip,
    } = normalizePagination(page, limit, 100);

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

  private async getContinueReading(userId: number) {
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
            author: true,
            coverImage: true,
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

    return {
      book: row.book,
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
    const {
      page: pageSafe,
      limit: limitSafe,
      skip,
    } = normalizePagination(page, limit, 100);

    const total = await this.prisma.readingProgress.count({
      where: { userId, percent: { lt: 100 } },
    });

    const progressEntries = await this.prisma.readingProgress.findMany({
      where: {
        userId,
        percent: { lt: 100 },
      },
      include: {
        book: {
          select: {
            id: true,
            title: true,
            author: true,
            coverImage: true,
            type: { select: { slug: true, iconKey: true } },
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
      orderBy: { updatedAt: 'desc' },
      skip,
      take: limitSafe,
    });

    return {
      data: progressEntries.map((p) => ({
        book: p.book,
        chapter: {
          title: p.chapter.title,
          index: p.chapter.index,
          pageCount: p.chapter.pageCount,
        },
        progress: {
          lastPage: p.lastPage,
          percent: p.percent,
        },
        lastReadAt: p.updatedAt,
      })),
      total,
      page: pageSafe,
      lastPage: Math.max(1, Math.ceil(total / limitSafe)),
    };
  }

  async getAdminDashboardStats(permissions: string[], userId: number) {
    const isSuperAdmin = userId === 1;

    const canViewFinance =
      isSuperAdmin || permissions.includes('MANAGE_FINANCE');
    const canViewUsers =
      isSuperAdmin ||
      permissions.includes('MANAGE_USERS') ||
      permissions.includes('MANAGE_STAFF');
    const canViewBooks = isSuperAdmin || permissions.includes('MANAGE_BOOKS');

    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(now.getDate() - 60);

    const [
      totalUsers,
      newUsersLast30,
      newUsersPrev30,
      activeUsers,
      totalBooks,
      totalChapters,
      newBooksLast30,
      newBooksPrev30,
      financeStats,
      recentTransactions,
      recentUsers,
      recentBooks,
      recentChapters,
      userChartData,
      genreStats,
      typeStats,
    ] = await Promise.all([
      // Users
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      this.prisma.user.count({
        where: { createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
      }),
      this.prisma.user.count({
        where: { lastLoginAt: { gte: thirtyDaysAgo } },
      }),

      // Content
      this.prisma.book.count(),
      this.prisma.chapter.count(),
      this.prisma.book.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      this.prisma.book.count({
        where: { createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
      }),

      // Finance
      canViewFinance
        ? this.getFinanceStats(thirtyDaysAgo, sixtyDaysAgo)
        : Promise.resolve(null),

      // Recents
      canViewFinance
        ? this.prisma.walletTransaction.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' },
            include: {
              wallet: { include: { user: { select: { username: true } } } },
            },
          })
        : Promise.resolve([]),
      canViewUsers
        ? this.prisma.user.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' },
            select: { id: true, username: true, email: true, createdAt: true },
          })
        : Promise.resolve([]),
      canViewBooks
        ? this.prisma.book.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              title: true,
              author: true,
              createdAt: true,
              coverImage: true,
            },
          })
        : Promise.resolve([]),
      canViewBooks
        ? this.prisma.chapter.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' },
            include: { book: { select: { title: true } } },
          })
        : Promise.resolve([]),

      // Charts
      canViewUsers ? this.getUserRegistrationChart() : Promise.resolve([]),
      canViewBooks ? this.getGenreStats() : Promise.resolve([]),
      canViewBooks ? this.getTypeStats() : Promise.resolve([]),
    ]);

    return {
      summary: {
        users: canViewUsers
          ? {
              total: totalUsers,
              new: newUsersLast30,
              active: activeUsers,
              growth: calculateGrowth(newUsersLast30, newUsersPrev30),
            }
          : null,
        content: {
          books: totalBooks,
          chapters: totalChapters,
          growth: calculateGrowth(newBooksLast30, newBooksPrev30),
        },
        finance: financeStats,
      },
      charts: {
        userRegistrations: userChartData,
        genreDistribution: genreStats,
        typeDistribution: typeStats,
      },
      recent: {
        transactions: recentTransactions.map((t) => ({
          id: t.id,
          username: t.wallet?.user?.username || 'Unknown',
          amount: Number(t.amount),
          type: t.type,
          createdAt: t.createdAt,
        })),
        users: recentUsers,
        books: recentBooks,
        chapters: recentChapters.map((c) => ({
          id: c.id,
          title: c.title,
          bookTitle: c.book.title,
          createdAt: c.createdAt,
        })),
      },
    };
  }

  private async getFinanceStats(startDate: Date, prevDate: Date) {
    const currentMonthAgg = await this.prisma.walletTransaction.aggregate({
      where: { type: 'CREDIT', createdAt: { gte: startDate } },
      _sum: { amount: true },
    });
    const prevMonthAgg = await this.prisma.walletTransaction.aggregate({
      where: { type: 'CREDIT', createdAt: { gte: prevDate, lt: startDate } },
      _sum: { amount: true },
    });
    const totalRevenueAgg = await this.prisma.walletTransaction.aggregate({
      where: { type: 'CREDIT' },
      _sum: { amount: true },
    });

    const transactions = await this.prisma.walletTransaction.findMany({
      where: { type: 'CREDIT', createdAt: { gte: startDate } },
      select: { amount: true, createdAt: true },
    });

    const chartMap = new Map<string, number>();
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      chartMap.set(key, 0);
    }

    transactions.forEach((t) => {
      const day = t.createdAt.toISOString().split('T')[0];
      chartMap.set(day, (chartMap.get(day) || 0) + Number(t.amount));
    });

    const chartData = Array.from(chartMap.entries())
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalRevenue: Number(totalRevenueAgg._sum.amount || 0),
      monthlyRevenue: Number(currentMonthAgg._sum.amount || 0),
      growth: calculateGrowth(
        Number(currentMonthAgg._sum.amount),
        Number(prevMonthAgg._sum.amount),
      ),
      chartData,
    };
  }

  private async getUserRegistrationChart() {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);

    const users = await this.prisma.user.findMany({
      where: { createdAt: { gte: sixMonthsAgo } },
      select: { createdAt: true },
    });

    const monthMap = new Map<string, number>();
    for (let i = 0; i < 6; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = d.toLocaleString('default', { month: 'short' });
      if (!monthMap.has(key)) monthMap.set(key, 0);
    }

    users.forEach((u) => {
      const key = u.createdAt.toLocaleString('default', { month: 'short' });
      if (monthMap.has(key)) monthMap.set(key, (monthMap.get(key) || 0) + 1);
    });

    return Array.from(monthMap.entries())
      .map(([month, users]) => ({ month, users }))
      .reverse();
  }

  private async getGenreStats() {
    const genres = await this.prisma.genre.findMany({
      include: { _count: { select: { books: true } } },
    });

    const sorted = genres
      .map((g) => ({ name: g.name, value: g._count.books }))
      .sort((a, b) => b.value - a.value);

    if (sorted.length <= 5) return sorted;

    const top5 = sorted.slice(0, 5);
    const others = sorted.slice(5).reduce((acc, curr) => acc + curr.value, 0);

    return [...top5, { name: 'Others', value: others }];
  }

  private async getTypeStats() {
    const types = await this.prisma.bookType.findMany({
      include: { _count: { select: { books: true } } },
    });

    const sorted = types
      .map((t) => ({ name: t.name, value: t._count.books }))
      .sort((a, b) => b.value - a.value);

    if (sorted.length <= 5) return sorted;

    const top5 = sorted.slice(0, 5);
    const others = sorted.slice(5).reduce((acc, curr) => acc + curr.value, 0);

    return [...top5, { name: 'Others', value: others }];
  }
}
