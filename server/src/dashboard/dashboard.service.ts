import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
    constructor(private prisma: PrismaService) {}

    async getDashboardStats(permissions: string[], userId: number) {
        const isSuperAdmin = userId === 1;

        const canViewFinance = isSuperAdmin || permissions.includes('MANAGE_FINANCE');
        const canViewUsers = isSuperAdmin || permissions.includes('MANAGE_USERS') || permissions.includes('MANAGE_STAFF');
        const canViewBooks = isSuperAdmin || permissions.includes('MANAGE_BOOKS');

        const now = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(now.getDate() - 30);

        const sixtyDaysAgo = new Date();
        sixtyDaysAgo.setDate(now.getDate() - 60);

        const [
            totalUsers, newUsersLast30, newUsersPrev30, activeUsers,
            totalBooks, totalChapters, newBooksLast30, newBooksPrev30,
            financeStats, recentTransactions, recentUsers, recentBooks, recentChapters,
            userChartData, genreStats
        ] = await Promise.all([
            // Users
            this.prisma.user.count(),
            this.prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
            this.prisma.user.count({ where: { createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } }),
            this.prisma.user.count({ where: { lastLoginAt: { gte: thirtyDaysAgo } } }),

            // Content
            this.prisma.book.count(),
            this.prisma.chapter.count(),
            this.prisma.book.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
            this.prisma.book.count({ where: { createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } }),

            // Finance
            canViewFinance ? this.getFinanceStats(thirtyDaysAgo, sixtyDaysAgo) : Promise.resolve(null),

            // Recents
            canViewFinance
                ? this.prisma.walletTransaction.findMany({
                    take: 5, orderBy: { createdAt: 'desc' },
                    include: { wallet: { include: { user: { select: { username: true } } } } }
                }) : Promise.resolve([]),
            canViewUsers
                ? this.prisma.user.findMany({
                    take: 5, orderBy: { createdAt: 'desc' },
                    select: { id: true, username: true, email: true, createdAt: true }
                }) : Promise.resolve([]),
            canViewBooks
                ? this.prisma.book.findMany({
                    take: 5, orderBy: { createdAt: 'desc' },
                    select: { id: true, title: true, author: true, createdAt: true, coverImage: true }
                }) : Promise.resolve([]),
            canViewBooks
                ? this.prisma.chapter.findMany({
                    take: 5, orderBy: { createdAt: 'desc' },
                    include: { book: { select: { title: true } } }
                }) : Promise.resolve([]),

            // Charts
            canViewUsers ? this.getUserRegistrationChart() : Promise.resolve([]),
            canViewBooks ? this.getGenreStats() : Promise.resolve([])
        ]);

        return {
            summary: {
                users: canViewUsers ? {
                    total: totalUsers, new: newUsersLast30, active: activeUsers,
                    growth: this.calculateGrowth(newUsersLast30, newUsersPrev30)
                } : null,
                content: {
                    books: totalBooks, chapters: totalChapters,
                    growth: this.calculateGrowth(newBooksLast30, newBooksPrev30)
                },
                finance: financeStats
            },
            charts: {
                userRegistrations: userChartData,
                genreDistribution: genreStats
            },
            recent: {
                transactions: recentTransactions.map(t => ({
                    id: t.id, username: t.wallet?.user?.username || 'Unknown',
                    amount: Number(t.amount), type: t.type, createdAt: t.createdAt
                })),
                users: recentUsers,
                books: recentBooks,
                chapters: recentChapters.map(c => ({
                    id: c.id, title: c.title, bookTitle: c.book.title, createdAt: c.createdAt
                }))
            }
        };
    }

    private calculateGrowth(current: number, previous: number): number {
        if (previous === 0) return current > 0 ? 100 : 0;
        return Number((((current - previous) / previous) * 100).toFixed(1));
    }

    private async getFinanceStats(startDate: Date, prevDate: Date) {
        const currentMonthAgg = await this.prisma.walletTransaction.aggregate({
            where: { type: 'CREDIT', createdAt: { gte: startDate } },
            _sum: { amount: true }
        });
        const prevMonthAgg = await this.prisma.walletTransaction.aggregate({
            where: { type: 'CREDIT', createdAt: { gte: prevDate, lt: startDate } },
            _sum: { amount: true }
        });
        const totalRevenueAgg = await this.prisma.walletTransaction.aggregate({
            where: { type: 'CREDIT' },
            _sum: { amount: true }
        });

        const transactions = await this.prisma.walletTransaction.findMany({
            where: { type: 'CREDIT', createdAt: { gte: startDate } },
            select: { amount: true, createdAt: true }
        });

        const chartMap = new Map<string, number>();
        for (let i = 0; i < 30; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const key = d.toISOString().split('T')[0];
            chartMap.set(key, 0);
        }

        transactions.forEach(t => {
            const day = t.createdAt.toISOString().split('T')[0];
            chartMap.set(day, (chartMap.get(day) || 0) + Number(t.amount));
        });

        const chartData = Array.from(chartMap.entries())
            .map(([date, amount]) => ({ date, amount }))
            .sort((a, b) => a.date.localeCompare(b.date));

        return {
            totalRevenue: Number(totalRevenueAgg._sum.amount || 0),
            monthlyRevenue: Number(currentMonthAgg._sum.amount || 0),
            growth: this.calculateGrowth(Number(currentMonthAgg._sum.amount), Number(prevMonthAgg._sum.amount)),
            chartData
        };
    }

    private async getUserRegistrationChart() {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
        sixMonthsAgo.setDate(1);

        const users = await this.prisma.user.findMany({
            where: { createdAt: { gte: sixMonthsAgo } },
            select: { createdAt: true }
        });

        const monthMap = new Map<string, number>();
        for (let i = 0; i < 6; i++) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const key = d.toLocaleString('default', { month: 'short' });
            if (!monthMap.has(key)) monthMap.set(key, 0);
        }

        users.forEach(u => {
            const key = u.createdAt.toLocaleString('default', { month: 'short' });
            if (monthMap.has(key)) monthMap.set(key, (monthMap.get(key) || 0) + 1);
        });

        return Array.from(monthMap.entries()).map(([month, users]) => ({ month, users })).reverse();
    }

    private async getGenreStats() {
        const genres = await this.prisma.genre.findMany({
            include: { _count: { select: { books: true } } }
        });

        const sorted = genres
            .map(g => ({ name: g.name, value: g._count.books }))
            .sort((a, b) => b.value - a.value);

        if (sorted.length <= 5) return sorted;

        const top5 = sorted.slice(0, 5);
        const others = sorted.slice(5).reduce((acc, curr) => acc + curr.value, 0);

        return [...top5, { name: 'Others', value: others }];
    }
}