import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import {
  asCacheManager,
  asPrismaService,
  createMockCacheManager,
  createMockPrismaService,
  decimal,
  type MockCacheManager,
  type MockPrismaService,
} from '../../test/mocks';
import { CacheManager } from '../cache/cache.manager';
import { PrismaService } from '../prisma/prisma.service';
import { WalletsService } from './wallets.service';

const USER_ID = 10;
const WALLET_ID = 1;

describe('WalletsService', () => {
  let service: WalletsService;
  let prisma: MockPrismaService;
  let cacheManager: MockCacheManager;

  /** Money columns arrive from Prisma as Decimal, so fixtures must use it too. */
  const wallet = (balance: number) => ({
    id: WALLET_ID,
    userId: USER_ID,
    balance: decimal(balance),
  });

  beforeEach(async () => {
    prisma = createMockPrismaService();
    cacheManager = createMockCacheManager();

    prisma.wallet.upsert.mockResolvedValue(wallet(50));
    prisma.walletTransaction.aggregate.mockResolvedValue({ _sum: { amount: decimal(0) } });
    prisma.walletTransaction.count.mockResolvedValue(0);
    prisma.walletTransaction.findMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletsService,
        { provide: PrismaService, useValue: asPrismaService(prisma) },
        { provide: CacheManager, useValue: asCacheManager(cacheManager) },
      ],
    }).compile();

    service = module.get(WalletsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getWallet', () => {
    it('creates the wallet on first access via upsert', async () => {
      // Act
      await service.getWallet(USER_ID, { includeTransactions: false });

      // Assert: a missing wallet must be provisioned rather than 404.
      expect(prisma.wallet.upsert).toHaveBeenCalledWith({
        where: { userId: USER_ID },
        update: {},
        create: { userId: USER_ID, balance: 0 },
        select: { id: true, userId: true, balance: true },
      });
    });

    it('returns balance and totals as plain numbers when transactions are excluded', async () => {
      // Arrange
      prisma.walletTransaction.aggregate
        .mockResolvedValueOnce({ _sum: { amount: decimal(100) } })
        .mockResolvedValueOnce({ _sum: { amount: decimal(30) } });

      // Act
      const result = await service.getWallet(USER_ID, { includeTransactions: false });

      // Assert: Decimal is normalised to number for the API boundary.
      expect(result).toEqual({
        id: WALLET_ID,
        userId: USER_ID,
        balance: 50,
        totals: { deposits: 100, withdrawals: 30 },
      });
      expect(typeof result.balance).toBe('number');
      // No transaction listing should be fetched in this mode.
      expect(prisma.walletTransaction.findMany).not.toHaveBeenCalled();
    });

    it('coerces null aggregate sums to zero', async () => {
      // Arrange: Prisma returns null when no rows match.
      prisma.walletTransaction.aggregate.mockResolvedValue({ _sum: { amount: null } });

      // Act
      const result = await service.getWallet(USER_ID, { includeTransactions: false });

      // Assert
      expect(result.totals).toEqual({ deposits: 0, withdrawals: 0 });
    });

    it('returns recent transactions and reports hasMore when more exist', async () => {
      // Arrange
      const createdAt = new Date('2026-01-01T00:00:00.000Z');
      prisma.walletTransaction.count.mockResolvedValue(25);
      prisma.walletTransaction.findMany.mockResolvedValue([
        { id: 5, amount: decimal(75.5), type: 'CREDIT', reference: 'topup', createdAt },
      ]);

      // Act
      const result = await service.getWallet(USER_ID, { take: 10 });

      // Assert
      expect(result.transactions).toEqual({
        data: [{ id: 5, amount: 75.5, type: 'CREDIT', reference: 'topup', createdAt }],
        total: 25,
        hasMore: true,
      });
    });

    it('reports hasMore false when the page covers every transaction', async () => {
      // Arrange
      prisma.walletTransaction.count.mockResolvedValue(3);

      // Act
      const result = await service.getWallet(USER_ID, { take: 10 });

      // Assert
      expect(result.transactions?.hasMore).toBe(false);
    });

    it('clamps an out-of-range take to the 50 maximum', async () => {
      // Act
      await service.getWallet(USER_ID, { take: 9999 });

      // Assert
      expect(prisma.walletTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50, orderBy: { createdAt: 'desc' } }),
      );
    });

    it('paginates history mode and derives lastPage', async () => {
      // Arrange
      prisma.walletTransaction.count.mockResolvedValue(95);

      // Act
      const result = await service.getWallet(USER_ID, { page: 2, limit: 30 });

      // Assert
      expect(prisma.walletTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 30, take: 30 }),
      );
      expect(result.transactions).toMatchObject({ total: 95, page: 2, lastPage: 4 });
    });

    it('clamps a page below 1 and a limit above the cap', async () => {
      // Arrange
      prisma.walletTransaction.count.mockResolvedValue(10);

      // Act
      const result = await service.getWallet(USER_ID, { page: 0, limit: 500 });

      // Assert
      expect(result.transactions?.page).toBe(1);
      expect(prisma.walletTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100, skip: 0 }),
      );
    });

    it('defaults to history mode with page 1 and limit 30', async () => {
      // Act
      const result = await service.getWallet(USER_ID);

      // Assert
      expect(result.transactions).toMatchObject({ page: 1, lastPage: 1 });
      expect(prisma.walletTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 30 }),
      );
    });
  });

  describe('credit', () => {
    it('increments the balance, records a CREDIT row and busts the stats cache', async () => {
      // Arrange
      prisma.wallet.findUnique.mockResolvedValue(wallet(50));
      prisma.wallet.update.mockResolvedValue(wallet(150));

      // Act
      const result = await service.credit(USER_ID, 100, 'invoice-1');

      // Assert
      expect(prisma.wallet.update).toHaveBeenCalledWith({
        where: { userId: USER_ID },
        data: { balance: { increment: 100 } },
      });
      expect(prisma.walletTransaction.create).toHaveBeenCalledWith({
        data: {
          walletId: WALLET_ID,
          amount: 100,
          type: 'CREDIT',
          reference: 'invoice-1',
        },
      });
      expect(cacheManager.del).toHaveBeenCalledWith('stats:transactions');
      expect(result.balance.toNumber()).toBe(150);
    });

    it('runs inside a transaction when no client is supplied', async () => {
      // Arrange
      prisma.wallet.findUnique.mockResolvedValue(wallet(0));
      prisma.wallet.update.mockResolvedValue(wallet(5));

      // Act
      await service.credit(USER_ID, 5);

      // Assert: the balance read and write must be atomic.
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('joins an ambient transaction instead of opening its own', async () => {
      // Arrange: a caller-provided client (e.g. a payment callback).
      const ambient = createMockPrismaService();
      ambient.wallet.findUnique.mockResolvedValue(wallet(0));
      ambient.wallet.update.mockResolvedValue(wallet(20));

      // Act
      await service.credit(USER_ID, 20, 'ref', ambient as never);

      // Assert
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(ambient.wallet.update).toHaveBeenCalled();
    });

    it.each([0, -1, -0.5])('rejects a non-positive amount of %s', async (amount) => {
      // Act & Assert
      await expect(service.credit(USER_ID, amount)).rejects.toThrow(ForbiddenException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the wallet is missing', async () => {
      // Arrange
      prisma.wallet.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.credit(USER_ID, 10)).rejects.toThrow(NotFoundException);
      expect(prisma.wallet.update).not.toHaveBeenCalled();
    });

    it('does not bust the cache when the transaction fails', async () => {
      // Arrange
      prisma.wallet.findUnique.mockResolvedValue(wallet(0));
      prisma.wallet.update.mockRejectedValue(new Error('deadlock'));

      // Act & Assert
      await expect(service.credit(USER_ID, 10)).rejects.toThrow('deadlock');
      expect(cacheManager.del).not.toHaveBeenCalled();
    });
  });

  describe('debit', () => {
    it('decrements the balance and records a DEBIT row', async () => {
      // Arrange
      prisma.wallet.findUnique.mockResolvedValue(wallet(100));
      prisma.wallet.update.mockResolvedValue(wallet(60));

      // Act
      const result = await service.debit(USER_ID, 40, 'purchase-1');

      // Assert
      expect(prisma.wallet.update).toHaveBeenCalledWith({
        where: { userId: USER_ID },
        data: { balance: { decrement: 40 } },
      });
      expect(prisma.walletTransaction.create).toHaveBeenCalledWith({
        data: {
          walletId: WALLET_ID,
          amount: 40,
          type: 'DEBIT',
          reference: 'purchase-1',
        },
      });
      expect(result.balance.toNumber()).toBe(60);
    });

    it('throws ForbiddenException and records nothing when funds are insufficient', async () => {
      // Arrange: the decrement drives the balance negative.
      prisma.wallet.findUnique.mockResolvedValue(wallet(10));
      prisma.wallet.update.mockResolvedValue(wallet(-40));

      // Act & Assert
      await expect(service.debit(USER_ID, 50)).rejects.toThrow('Insufficient balance');
      // The throw happens before the ledger write, so the transaction rolls back
      // without leaving an orphaned DEBIT record.
      expect(prisma.walletTransaction.create).not.toHaveBeenCalled();
    });

    it('permits a debit that lands exactly on a zero balance', async () => {
      // Arrange: boundary case — zero is allowed, only negative is refused.
      prisma.wallet.findUnique.mockResolvedValue(wallet(50));
      prisma.wallet.update.mockResolvedValue(wallet(0));

      // Act
      const result = await service.debit(USER_ID, 50);

      // Assert
      expect(result.balance.toNumber()).toBe(0);
      expect(prisma.walletTransaction.create).toHaveBeenCalled();
    });

    it.each([0, -25])('rejects a non-positive amount of %s', async (amount) => {
      // Act & Assert
      await expect(service.debit(USER_ID, amount)).rejects.toThrow('Amount must be positive');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the wallet is missing', async () => {
      // Arrange
      prisma.wallet.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.debit(USER_ID, 10)).rejects.toThrow(NotFoundException);
    });

    it('joins an ambient transaction when one is provided', async () => {
      // Arrange
      const ambient = createMockPrismaService();
      ambient.wallet.findUnique.mockResolvedValue(wallet(100));
      ambient.wallet.update.mockResolvedValue(wallet(90));

      // Act
      await service.debit(USER_ID, 10, 'ref', ambient);

      // Assert
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(ambient.walletTransaction.create).toHaveBeenCalled();
    });

    it('does not bust the cache when the debit is rejected', async () => {
      // Arrange
      prisma.wallet.findUnique.mockResolvedValue(wallet(10));
      prisma.wallet.update.mockResolvedValue(wallet(-1));

      // Act & Assert
      await expect(service.debit(USER_ID, 11)).rejects.toThrow(ForbiddenException);
      expect(cacheManager.del).not.toHaveBeenCalled();
    });
  });
});
