import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { CacheManager } from '../cache/cache.manager';
import { PrismaService } from '../prisma/prisma.service';
import { WalletsService } from './wallets.service';

describe('WalletsService', () => {
  let service: WalletsService;
  let prisma: Record<string, any>;
  let cacheManager: Record<string, any>;

  beforeEach(async () => {
    prisma = {
      wallet: {
        upsert: jest.fn().mockResolvedValue({ id: 1, userId: 10, balance: 50 }),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      walletTransaction: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }),
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        groupBy: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
      },
      $transaction: jest.fn((fn: Function) => fn(prisma)),
    };

    cacheManager = {
      getString: jest.fn().mockResolvedValue(null),
      setString: jest.fn(),
      del: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletsService,
        { provide: PrismaService, useValue: prisma },
        { provide: CacheManager, useValue: cacheManager },
      ],
    }).compile();

    service = module.get<WalletsService>(WalletsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getWallet', () => {
    it('returns wallet without transactions when includeTransactions is false', async () => {
      prisma.walletTransaction.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 100 } })
        .mockResolvedValueOnce({ _sum: { amount: 30 } });

      const result = await service.getWallet(10, { includeTransactions: false });

      expect(result).toEqual({
        id: 1,
        userId: 10,
        balance: 50,
        totals: { deposits: 100, withdrawals: 30 },
      });
      expect(result).not.toHaveProperty('transactions');
    });

    it('returns recent transactions with take option', async () => {
      const tx = {
        id: 1,
        amount: { toString: () => '10' },
        type: 'CREDIT',
        reference: 'ref',
        createdAt: new Date(),
      };
      prisma.walletTransaction.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 100 } })
        .mockResolvedValueOnce({ _sum: { amount: 30 } });
      prisma.walletTransaction.count.mockResolvedValue(5);
      prisma.walletTransaction.findMany.mockResolvedValue([tx]);

      const result = await service.getWallet(10, { take: 3 });

      expect(result.transactions.data).toHaveLength(1);
      expect(result.transactions.hasMore).toBe(true);
    });

    it('returns paginated transactions in history mode', async () => {
      prisma.walletTransaction.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 0 } })
        .mockResolvedValueOnce({ _sum: { amount: 0 } });
      prisma.walletTransaction.count.mockResolvedValue(100);
      prisma.walletTransaction.findMany.mockResolvedValue([]);

      const result = await service.getWallet(10, { page: 2, limit: 10 });

      expect(result.transactions.page).toBe(2);
      expect(result.transactions.lastPage).toBe(10);
      expect(result.transactions.hasMore).toBe(true);
    });

    it('clamps take value to [1, 50]', async () => {
      prisma.walletTransaction.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
      prisma.walletTransaction.count.mockResolvedValue(0);
      prisma.walletTransaction.findMany.mockResolvedValue([]);

      await service.getWallet(10, { take: 999 });

      expect(prisma.walletTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50 }),
      );
    });

    it('creates wallet if not existing (ensureWallet)', async () => {
      prisma.walletTransaction.aggregate.mockResolvedValue({ _sum: { amount: 0 } });

      await service.getWallet(10, { includeTransactions: false });

      expect(prisma.wallet.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 10 } }),
      );
    });
  });

  describe('getAllTransactions', () => {
    it('returns cached stats when available', async () => {
      const stats = {
        total: 5,
        credits: 3,
        debits: 2,
        creditAmount: 100,
        debitAmount: 50,
        growth: { totalTransactions: 0, creditAmount: 0, debitAmount: 0 },
      };
      cacheManager.getString.mockResolvedValue(JSON.stringify(stats));
      prisma.walletTransaction.findMany.mockResolvedValue([]);

      const result = await service.getAllTransactions(1, 10);

      expect(result.stats).toEqual(stats);
    });

    it('fetches and caches stats when not cached', async () => {
      cacheManager.getString.mockResolvedValue(null);
      prisma.walletTransaction.count.mockResolvedValue(10);
      prisma.walletTransaction.groupBy.mockResolvedValue([
        { type: 'CREDIT', _sum: { amount: 100 }, _count: { _all: 5 } },
        { type: 'DEBIT', _sum: { amount: 50 }, _count: { _all: 5 } },
      ]);
      prisma.walletTransaction.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 20 } })
        .mockResolvedValueOnce({ _sum: { amount: 10 } })
        .mockResolvedValueOnce({ _sum: { amount: 15 } })
        .mockResolvedValueOnce({ _sum: { amount: 8 } });
      prisma.walletTransaction.findMany.mockResolvedValue([]);

      const result = await service.getAllTransactions(1, 10);

      expect(result.stats).toBeDefined();
      expect(result.stats.total).toBe(10);
      expect(cacheManager.setString).toHaveBeenCalledWith(
        'stats:transactions',
        expect.any(String),
        3600,
      );
    });
  });

  describe('credit', () => {
    it('throws ForbiddenException when amount <= 0', async () => {
      await expect(service.credit(1, 0)).rejects.toThrow(ForbiddenException);
      await expect(service.credit(1, -5)).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when wallet not found', async () => {
      prisma.wallet.findUnique.mockResolvedValue(null);
      await expect(service.credit(1, 10)).rejects.toThrow(NotFoundException);
    });

    it('credits wallet and creates transaction record', async () => {
      prisma.wallet.findUnique.mockResolvedValue({ id: 1, userId: 10, balance: 50 });
      prisma.wallet.update.mockResolvedValue({ id: 1, userId: 10, balance: 60 });

      const result = await service.credit(10, 10, 'deposit');

      expect(result.balance).toBe(60);
      expect(prisma.walletTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          amount: 10,
          type: 'CREDIT',
          reference: 'deposit',
        }),
      });
      expect(cacheManager.del).toHaveBeenCalledWith('stats:transactions');
    });
  });

  describe('debit', () => {
    it('throws ForbiddenException when amount <= 0', async () => {
      await expect(service.debit(1, 0)).rejects.toThrow(ForbiddenException);
      await expect(service.debit(1, -5)).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when wallet not found', async () => {
      prisma.wallet.findUnique.mockResolvedValue(null);
      await expect(service.debit(1, 10)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when balance insufficient', async () => {
      prisma.wallet.findUnique.mockResolvedValue({ id: 1, balance: { toNumber: () => 5 } });
      await expect(service.debit(1, 10)).rejects.toThrow(ForbiddenException);
    });

    it('debits wallet and creates transaction record', async () => {
      prisma.wallet.findUnique.mockResolvedValue({
        id: 1,
        userId: 10,
        balance: { toNumber: () => 50 },
      });
      prisma.wallet.update.mockResolvedValue({ id: 1, userId: 10, balance: 40 });

      const result = await service.debit(10, 10, 'purchase');

      expect(result.balance).toBe(40);
      expect(prisma.walletTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          amount: 10,
          type: 'DEBIT',
          reference: 'purchase',
        }),
      });
      expect(cacheManager.del).toHaveBeenCalledWith('stats:transactions');
    });
  });
});
