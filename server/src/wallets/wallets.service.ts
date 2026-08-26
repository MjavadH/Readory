import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TransactionType } from '@prisma/client';
import { CacheManager } from '../cache/cache.manager';
import { calculateGrowth, clampInt } from '../common';
import { PrismaService } from '../prisma/prisma.service';

type GetWalletOptions = {
  includeTransactions?: boolean;

  take?: number;

  page?: number;
  limit?: number;
};

@Injectable()
export class WalletsService {
  constructor(
    private prisma: PrismaService,
    private readonly cacheManager: CacheManager,
  ) {}

  private async ensureWallet(userId: number) {
    return this.prisma.wallet.upsert({
      where: { userId },
      update: {},
      create: { userId, balance: 0 },
      select: { id: true, userId: true, balance: true },
    });
  }

  /**
   * Wallet getter used by dashboard:
   * - always returns wallet (creates if missing)
   * - includes totals: deposits/withdrawals
   * - optional transactions:
   *   - recent: { take }
   *   - history: { page, limit }
   */
  async getWallet(userId: number, options: GetWalletOptions = {}) {
    const includeTransactions = options.includeTransactions !== false;

    const wallet = await this.ensureWallet(userId);

    const [depositAgg, withdrawalAgg] = await Promise.all([
      this.prisma.walletTransaction.aggregate({
        where: { walletId: wallet.id, type: TransactionType.CREDIT },
        _sum: { amount: true },
      }),
      this.prisma.walletTransaction.aggregate({
        where: { walletId: wallet.id, type: TransactionType.DEBIT },
        _sum: { amount: true },
      }),
    ]);

    const totals = {
      deposits: Number(depositAgg._sum.amount || 0),
      withdrawals: Number(withdrawalAgg._sum.amount || 0),
    };

    if (!includeTransactions) {
      return {
        id: wallet.id,
        userId: wallet.userId,
        balance: Number(wallet.balance),
        totals,
      };
    }

    const total = await this.prisma.walletTransaction.count({
      where: { walletId: wallet.id },
    });

    // recent mode
    if (options.take != null) {
      const take = clampInt(options.take, 1, 50, 10);

      const rows = await this.prisma.walletTransaction.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        take,
        select: {
          id: true,
          amount: true,
          type: true,
          reference: true,
          createdAt: true,
        },
      });

      return {
        id: wallet.id,
        userId: wallet.userId,
        balance: Number(wallet.balance),
        totals,
        transactions: {
          data: rows.map((t) => ({
            id: t.id,
            amount: Number(t.amount),
            type: t.type,
            reference: t.reference,
            createdAt: t.createdAt,
          })),
          total,
          hasMore: total > take,
        },
      };
    }

    // history mode (paginated)
    const page = clampInt(options.page ?? 1, 1, 1_000_000, 1);
    const limit = clampInt(options.limit ?? 30, 1, 100, 30);
    const skip = (page - 1) * limit;

    const rows = await this.prisma.walletTransaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        amount: true,
        type: true,
        reference: true,
        createdAt: true,
      },
    });

    const lastPage = Math.max(1, Math.ceil(total / limit));

    return {
      id: wallet.id,
      userId: wallet.userId,
      balance: Number(wallet.balance),
      totals,
      transactions: {
        data: rows.map((t) => ({
          id: t.id,
          amount: Number(t.amount),
          type: t.type,
          reference: t.reference,
          createdAt: t.createdAt,
        })),
        total,
        page,
        lastPage,
        hasMore: page < lastPage,
      },
    };
  }

  async getAllTransactions(page: number, limit: number) {
    const skip = (page - 1) * limit;

    const CACHE_KEY = 'stats:transactions';
    let stats = null;

    const cachedStats = await this.cacheManager.getString(CACHE_KEY);

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
            where: { ...where, type: TransactionType.CREDIT },
          }),
          this.prisma.walletTransaction.aggregate({
            _sum: { amount: true },
            where: { ...where, type: TransactionType.DEBIT },
          }),
          this.prisma.walletTransaction.count({ where }),
        ]);

        return {
          credit: Number(creditSum._sum.amount || 0),
          debit: Number(debitSum._sum.amount || 0),
          count: count,
        };
      };

      const totalRecords = await this.prisma.walletTransaction.count();

      const statsGrouped = await this.prisma.walletTransaction.groupBy({
        by: ['type'],
        _sum: { amount: true },
        _count: { _all: true },
      });
      const totalCredits = statsGrouped.find((s) => s.type === TransactionType.CREDIT);
      const totalDebits = statsGrouped.find((s) => s.type === TransactionType.DEBIT);
      const currentStats = await getStatsForPeriod(startOfCurrentMonth, new Date());
      const lastMonthStats = await getStatsForPeriod(startOfLastMonth, startOfCurrentMonth);

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
        },
      };
      await this.cacheManager.setString(CACHE_KEY, JSON.stringify(stats), 3600);
    }
    const transactions = await this.prisma.walletTransaction.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        wallet: {
          include: {
            user: {
              select: { username: true, id: true },
            },
          },
        },
      },
    });
    return {
      transactions,
      hasMore: skip + limit < stats.total,
      stats: stats,
    };
  }

  // Credit the wallet with a certain amount
  async credit(userId: number, amount: number, reference?: string, tx?: Prisma.TransactionClient) {
    if (amount <= 0) {
      throw new ForbiddenException('Amount must be positive');
    }

    const creditWallet = async (client: Prisma.TransactionClient) => {
      const wallet = await client.wallet.findUnique({ where: { userId } });
      if (!wallet) {
        throw new NotFoundException('Wallet not found');
      }

      const updatedWallet = await client.wallet.update({
        where: { userId },
        data: { balance: { increment: amount } },
      });

      await client.walletTransaction.create({
        data: {
          walletId: updatedWallet.id,
          amount,
          type: TransactionType.CREDIT,
          reference,
        },
      });

      return updatedWallet;
    };

    const result = tx
      ? await creditWallet(tx)
      : await this.prisma.$transaction((client) => creditWallet(client));

    await this.cacheManager.del('stats:transactions');

    return result;
  }

  // Debit the wallet
  async debit(userId: number, amount: number, reference?: string, providedTx?: any) {
    if (amount <= 0) {
      throw new ForbiddenException('Amount must be positive');
    }

    const executeDebit = async (tx: any) => {
      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) throw new NotFoundException('Wallet not found');

      const updatedWallet = await tx.wallet.update({
        where: { userId },
        data: { balance: { decrement: amount } },
      });

      if (updatedWallet.balance.toNumber() < 0) {
        throw new ForbiddenException('Insufficient balance');
      }

      await tx.walletTransaction.create({
        data: {
          walletId: updatedWallet.id,
          amount,
          type: TransactionType.DEBIT,
          reference,
        },
      });
      return updatedWallet;
    };

    const result = providedTx
      ? await executeDebit(providedTx)
      : await this.prisma.$transaction(executeDebit);

    await this.cacheManager.del('stats:transactions');

    return result;
  }
}
