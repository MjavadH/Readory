import { Injectable, NotFoundException, ForbiddenException, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionType } from '@prisma/client';
import Redis from 'ioredis';

@Injectable()
export class WalletsService {
    constructor(
        private prisma: PrismaService,
        @Inject('REDIS_CLIENT') private readonly redis: Redis
    ) {}

    // Get a user’s wallet and balance
    async getWallet(userId: number) {
        const wallet = await this.prisma.wallet.findUnique({
            where: { userId },
            include: { transactions: { orderBy: { createdAt: 'desc' } } },
        });
        if (!wallet) {
            throw new NotFoundException('Wallet not found');
        }
        return wallet;
    }

    async getAllTransactions(page: number, limit: number) {
        const skip = (page - 1) * limit;

        const CACHE_KEY = 'stats:transactions';
        let stats = null;

        const cachedStats = await this.redis.get(CACHE_KEY);

        // Aggregate statistics for the dashboard
        if (cachedStats) {
            stats = JSON.parse(cachedStats);
        } else {
            const now = new Date();
            const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

            const getStatsForPeriod = async (start: Date, end: Date) => {
                const where: any = { createdAt: { gte: start, lt: end } };

                const [creditSum, debitSum, count] = await Promise.all([
                    this.prisma.walletTransaction.aggregate({
                        _sum: { amount: true },
                        where: { ...where, type: TransactionType.CREDIT }
                    }),
                    this.prisma.walletTransaction.aggregate({
                        _sum: { amount: true },
                        where: { ...where, type: TransactionType.DEBIT }
                    }),
                    this.prisma.walletTransaction.count({ where })
                ]);

                return {
                    credit: Number(creditSum._sum.amount || 0),
                    debit: Number(debitSum._sum.amount || 0),
                    count: count
                };
            };

            const totalRecords = await this.prisma.walletTransaction.count();

            const statsGrouped = await this.prisma.walletTransaction.groupBy({
                by: ['type'],
                _sum: {amount: true},
                _count: {_all: true},
            });
            const totalCredits = statsGrouped.find(s => s.type === TransactionType.CREDIT);
            const totalDebits = statsGrouped.find(s => s.type === TransactionType.DEBIT);
            const currentStats = await getStatsForPeriod(startOfCurrentMonth, new Date());
            const lastMonthStats = await getStatsForPeriod(startOfLastMonth, startOfCurrentMonth);

            const calculateGrowth = (current: number, previous: number) => {
                if (previous === 0) return current > 0 ? 100 : 0;
                return ((current - previous) / previous) * 100;
            };

            stats = {
                total: totalRecords,
                credits: totalCredits?._count._all || 0,
                debits: totalDebits?._count._all || 0,
                creditAmount: Number(totalCredits?._sum.amount) || 0,
                debitAmount: Number(totalDebits?._sum.amount) || 0,
                growth: {
                    totalTransactions: calculateGrowth(currentStats.count, lastMonthStats.count),
                    creditAmount: calculateGrowth(currentStats.credit, lastMonthStats.credit),
                    debitAmount: calculateGrowth(currentStats.debit, lastMonthStats.debit),
                }
            };
            await this.redis.set(CACHE_KEY, JSON.stringify(stats), 'EX', 3600);
        }
        const transactions = await this.prisma.walletTransaction.findMany({
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
                wallet: {
                    include: {
                        user: {
                            select: { username: true, id: true }
                        }
                    }
                }
            }
        });
        return {
            transactions,
            hasMore: skip + limit < stats.total,
            stats: stats
        };
    }

    // Credit the wallet with a certain amount
    async credit(userId: number, amount: number, reference?: string) {
        // Ensure amount is positive
        if (amount <= 0) {
            throw new ForbiddenException('Amount must be positive');
        }

        const result = await this.prisma.$transaction(async (tx) => {
            const wallet = await tx.wallet.findUnique({ where: { userId } });
            if (!wallet) {
                throw new NotFoundException('Wallet not found');
            }
            // Update balance
            const updatedWallet = await tx.wallet.update({
                where: { userId },
                data: { balance: { increment: amount } },
            });
            // Add transaction record
            await tx.walletTransaction.create({
                data: {
                    walletId: updatedWallet.id,
                    amount,
                    type: TransactionType.CREDIT,
                    reference,
                },
            });
            return updatedWallet;
        });
        await this.redis.del('stats:transactions');

        return result;
    }

    // Debit the wallet
    async debit(userId: number, amount: number, reference?: string) {
        if (amount <= 0) {
            throw new ForbiddenException('Amount must be positive');
        }
        const result = await this.prisma.$transaction(async (tx) => {
            const wallet = await tx.wallet.findUnique({ where: { userId } });
            if (!wallet) {
                throw new NotFoundException('Wallet not found');
            }
            if (wallet.balance.toNumber() < amount) {
                throw new ForbiddenException('Insufficient balance');
            }
            const updatedWallet = await tx.wallet.update({
                where: { userId },
                data: { balance: { decrement: amount } },
            });
            await tx.walletTransaction.create({
                data: {
                    walletId: updatedWallet.id,
                    amount,
                    type: TransactionType.DEBIT,
                    reference,
                },
            });
            return updatedWallet;
        });

        await this.redis.del('stats:transactions');

        return result;
    }
}
