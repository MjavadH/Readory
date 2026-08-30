import { Test, type TestingModule } from '@nestjs/testing';
import {
  asCacheManager,
  asPrismaService,
  createMockCacheManager,
  createMockPrismaService,
  type MockCacheManager,
  type MockPrismaService,
} from '../../test/mocks';
import { AuthService } from '../auth/auth.service';
import { CacheManager } from '../cache/cache.manager';
import { PrismaService } from '../prisma/prisma.service';
import { WalletsService } from '../wallets/wallets.service';
import { DashboardService } from './dashboard.service';

/**
 * Minimal stand-ins for the two collaborating services. Only the methods
 * DashboardService actually calls are stubbed, so if it starts depending on
 * something new the failure is explicit rather than silently `undefined`.
 */
type MockAuthService = { getProfile: jest.Mock };
type MockWalletsService = { getWallet: jest.Mock };

const ADMIN_USER_ID = 42;
const SUPER_ADMIN_USER_ID = 1;

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: MockPrismaService;
  let cacheManager: MockCacheManager;
  let authService: MockAuthService;
  let walletsService: MockWalletsService;

  beforeEach(async () => {
    prisma = createMockPrismaService();
    cacheManager = createMockCacheManager();
    authService = { getProfile: jest.fn() };
    walletsService = { getWallet: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: asPrismaService(prisma) },
        { provide: CacheManager, useValue: asCacheManager(cacheManager) },
        { provide: AuthService, useValue: authService },
        { provide: WalletsService, useValue: walletsService },
      ],
    }).compile();

    service = module.get(DashboardService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserDashboardOverview', () => {
    it('aggregates profile, wallet balance, recent transactions and library', async () => {
      // Arrange
      const profile = { id: 7, email: 'reader@test.com' };
      const transactions = [{ id: 11, amount: 250 }];
      authService.getProfile.mockResolvedValue(profile);
      walletsService.getWallet.mockResolvedValue({ balance: 500, transactions });
      prisma.readingProgress.findFirst.mockResolvedValue(null);
      prisma.accessRecord.groupBy.mockResolvedValue([]);

      // Act
      const result = await service.getUserDashboardOverview(7, {
        txLimit: 6,
        libraryLimit: 8,
      });

      // Assert
      expect(result).toEqual({
        profile,
        wallet: { balance: 500 },
        recentTransactions: transactions,
        continueReading: null,
        recentLibrary: { data: [] },
      });
      expect(authService.getProfile).toHaveBeenCalledWith(7);
    });

    it('clamps txLimit to the 1..20 range and libraryLimit to 1..30', async () => {
      // Arrange
      authService.getProfile.mockResolvedValue({ id: 7 });
      walletsService.getWallet.mockResolvedValue({ balance: 0, transactions: [] });
      prisma.readingProgress.findFirst.mockResolvedValue(null);
      prisma.accessRecord.groupBy.mockResolvedValue([]);

      // Act
      await service.getUserDashboardOverview(7, { txLimit: 999, libraryLimit: 999 });

      // Assert: txLimit clamped to the documented maximum of 20.
      expect(walletsService.getWallet).toHaveBeenCalledWith(7, { take: 20 });
      // libraryLimit clamped to 30 and forwarded as the groupBy `take`.
      expect(prisma.accessRecord.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({ take: 30 }),
      );
    });

    it('falls back to defaults when limits are not finite', async () => {
      // Arrange
      authService.getProfile.mockResolvedValue({ id: 7 });
      walletsService.getWallet.mockResolvedValue({ balance: 0, transactions: [] });
      prisma.readingProgress.findFirst.mockResolvedValue(null);
      prisma.accessRecord.groupBy.mockResolvedValue([]);

      // Act
      await service.getUserDashboardOverview(7, {
        txLimit: Number.NaN,
        libraryLimit: Number.NaN,
      });

      // Assert: clampInt's fallbacks are 6 (tx) and 8 (library).
      expect(walletsService.getWallet).toHaveBeenCalledWith(7, { take: 6 });
      expect(prisma.accessRecord.groupBy).toHaveBeenCalledWith(expect.objectContaining({ take: 8 }));
    });

    it('projects continueReading from the most recent unfinished progress row', async () => {
      // Arrange
      const updatedAt = new Date('2026-02-01T10:00:00.000Z');
      authService.getProfile.mockResolvedValue({ id: 7 });
      walletsService.getWallet.mockResolvedValue({ balance: 0, transactions: [] });
      prisma.accessRecord.groupBy.mockResolvedValue([]);
      prisma.readingProgress.findFirst.mockResolvedValue({
        lastPage: 5,
        percent: 50,
        updatedAt,
        chapterId: 3,
        bookId: 1,
        book: {
          id: 1,
          title: 'Test Book',
          coverImage: 'cover.jpg',
          type: { slug: 'manga', iconKey: null },
          contributors: [{ role: 'AUTHOR', contributor: { name: 'Ada' } }],
        },
        chapter: { title: 'Chapter 1', index: 1, pageCount: 10 },
      });

      // Act
      const result = await service.getUserDashboardOverview(7, {
        txLimit: 6,
        libraryLimit: 8,
      });

      // Assert
      expect(result.continueReading).toMatchObject({
        book: expect.objectContaining({ id: 1, title: 'Test Book' }),
        chapter: expect.objectContaining({ title: 'Chapter 1', index: 1 }),
      });
      // Only unfinished chapters qualify for "continue reading".
      expect(prisma.readingProgress.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 7, percent: { lt: 100 } },
          orderBy: { updatedAt: 'desc' },
        }),
      );
    });
  });

  describe('exportTransactionsCsv', () => {
    it('returns only the header row when there are no transactions', async () => {
      // Arrange
      prisma.walletTransaction.findMany.mockResolvedValue([]);

      // Act
      const csv = await service.exportTransactionsCsv(7);

      // Assert
      expect(csv).toBe('"Row","Transaction ID","Date","Type","Amount","Reference"');
    });

    it('restricts the export to the caller and the trailing year', async () => {
      // Arrange
      prisma.walletTransaction.findMany.mockResolvedValue([]);

      // Act
      await service.exportTransactionsCsv(7);

      // Assert
      const [[args]] = prisma.walletTransaction.findMany.mock.calls;
      expect(args.where.wallet).toEqual({ userId: 7 });
      expect(args.where.createdAt.gte).toBeInstanceOf(Date);
      expect(args.orderBy).toEqual({ createdAt: 'desc' });
    });

    it.each([
      ['=cmd|calc', "'=cmd|calc"],
      ['+1234', "'+1234"],
      ['-1234', "'-1234"],
      ['@SUM(A1)', "'@SUM(A1)"],
    ])('neutralises CSV formula injection for reference %s', async (reference, expected) => {
      // Arrange
      prisma.walletTransaction.findMany.mockResolvedValue([
        {
          id: 1,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          type: 'CREDIT',
          amount: 100,
          reference,
        },
      ]);

      // Act
      const csv = await service.exportTransactionsCsv(7);

      // Assert: the payload is prefixed with an apostrophe so spreadsheet
      // software treats it as text rather than evaluating it as a formula.
      expect(csv.split('\n')[1]).toContain(`"${expected}"`);
    });

    it('escapes embedded double quotes by doubling them', async () => {
      // Arrange
      prisma.walletTransaction.findMany.mockResolvedValue([
        {
          id: 1,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          type: 'CREDIT',
          amount: 100,
          reference: 'say "hi"',
        },
      ]);

      // Act
      const csv = await service.exportTransactionsCsv(7);

      // Assert
      expect(csv.split('\n')[1]).toContain('"say ""hi"""');
    });

    it('leaves a benign reference untouched and numbers rows from 1', async () => {
      // Arrange
      prisma.walletTransaction.findMany.mockResolvedValue([
        {
          id: 91,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          type: 'DEBIT',
          amount: 40,
          reference: 'order-1',
        },
      ]);

      // Act
      const csv = await service.exportTransactionsCsv(7);

      // Assert
      expect(csv.split('\n')[1]).toBe(
        '"1","91","2026-01-01T00:00:00.000Z","DEBIT","40","order-1"',
      );
    });
  });

  describe('getUserLibrary', () => {
    it('returns an empty page when the user owns nothing', async () => {
      // Arrange
      prisma.$queryRaw.mockResolvedValue([{ count: 0n }]);
      prisma.accessRecord.groupBy.mockResolvedValue([]);

      // Act
      const result = await service.getUserLibrary(7);

      // Assert
      expect(result).toEqual({ data: [], total: 0, page: 1, lastPage: 1 });
      // No book lookup should be attempted for an empty group set.
      expect(prisma.book.findMany).not.toHaveBeenCalled();
    });

    it('computes the purchased percentage per book', async () => {
      // Arrange
      prisma.$queryRaw.mockResolvedValue([{ count: 1n }]);
      prisma.accessRecord.groupBy.mockResolvedValue([
        { bookId: 1, _count: { _all: 5 }, _max: { purchasedAt: new Date('2026-01-01') } },
      ]);
      prisma.book.findMany.mockResolvedValue([
        {
          id: 1,
          title: 'Book',
          coverImage: null,
          updatedAt: new Date('2026-01-01'),
          chapterCount: 10,
          type: { slug: 'manga' },
          contributors: [{ role: 'AUTHOR', contributor: { name: 'Ada' } }],
        },
      ]);

      // Act
      const result = await service.getUserLibrary(7);

      // Assert: 5 of 10 chapters owned.
      expect(result.data[0]).toMatchObject({
        purchasedChapters: 5,
        totalChapters: 10,
        purchasedPercent: 50,
      });
      expect(result.data[0].book.contributors).toBe('Ada');
    });

    it('caps purchasedPercent at 100 when access records exceed chapter count', async () => {
      // Arrange: stale chapterCount lower than the number of access records.
      prisma.$queryRaw.mockResolvedValue([{ count: 1n }]);
      prisma.accessRecord.groupBy.mockResolvedValue([
        { bookId: 1, _count: { _all: 12 }, _max: { purchasedAt: null } },
      ]);
      prisma.book.findMany.mockResolvedValue([
        {
          id: 1,
          title: 'Book',
          coverImage: null,
          updatedAt: new Date('2026-01-01'),
          chapterCount: 10,
          type: null,
          contributors: [],
        },
      ]);

      // Act
      const result = await service.getUserLibrary(7);

      // Assert
      expect(result.data[0].purchasedPercent).toBe(100);
      expect(result.data[0].book.contributors).toBeNull();
    });

    it('reports 0 percent when the book has no chapters yet', async () => {
      // Arrange
      prisma.$queryRaw.mockResolvedValue([{ count: 1n }]);
      prisma.accessRecord.groupBy.mockResolvedValue([
        { bookId: 1, _count: { _all: 1 }, _max: { purchasedAt: null } },
      ]);
      prisma.book.findMany.mockResolvedValue([
        {
          id: 1,
          title: 'Book',
          coverImage: null,
          updatedAt: new Date('2026-01-01'),
          chapterCount: 0,
          type: null,
          contributors: [],
        },
      ]);

      // Act
      const result = await service.getUserLibrary(7);

      // Assert: guards against division by zero.
      expect(result.data[0].purchasedPercent).toBe(0);
    });

    it('skips groups whose book no longer exists', async () => {
      // Arrange: access record points at a deleted book.
      prisma.$queryRaw.mockResolvedValue([{ count: 1n }]);
      prisma.accessRecord.groupBy.mockResolvedValue([
        { bookId: 404, _count: { _all: 1 }, _max: { purchasedAt: null } },
      ]);
      prisma.book.findMany.mockResolvedValue([]);

      // Act
      const result = await service.getUserLibrary(7);

      // Assert: the orphaned row is dropped rather than throwing.
      expect(result.data).toEqual([]);
      expect(result.total).toBe(1);
    });

    it('derives lastPage from the distinct book count and clamps the limit', async () => {
      // Arrange
      prisma.$queryRaw.mockResolvedValue([{ count: 250n }]);
      prisma.accessRecord.groupBy.mockResolvedValue([]);

      // Act: a limit above the 100 cap must be clamped.
      const result = await service.getUserLibrary(7, 2, 500);

      // Assert
      expect(result.page).toBe(2);
      expect(result.lastPage).toBe(Math.ceil(250 / 100));
      expect(prisma.accessRecord.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100, skip: 100 }),
      );
    });
  });

  describe('getReadingProgress', () => {
    it('maps progress rows and prefers the AUTHOR contributor', async () => {
      // Arrange
      const updatedAt = new Date('2026-03-03T00:00:00.000Z');
      prisma.readingProgress.count.mockResolvedValue(1);
      prisma.readingProgress.findMany.mockResolvedValue([
        {
          lastPage: 3,
          percent: 30,
          updatedAt,
          book: {
            id: 1,
            title: 'Book',
            coverImage: 'c.jpg',
            type: { slug: 'novel', iconKey: null },
            contributors: [
              { role: 'ARTIST', contributor: { name: 'Artist' } },
              { role: 'AUTHOR', contributor: { name: 'Author' } },
            ],
          },
          chapter: { title: 'Ch', index: 2, pageCount: 10 },
        },
      ]);

      // Act
      const result = await service.getReadingProgress(7);

      // Assert: AUTHOR wins even though ARTIST appears first.
      expect(result.data[0].book.contributors).toBe('Author');
      expect(result.data[0]).toMatchObject({
        progress: { lastPage: 3, percent: 30 },
        lastReadAt: updatedAt,
      });
      expect(result).toMatchObject({ total: 1, page: 1, lastPage: 1 });
    });

    it('falls back to the first contributor when no AUTHOR is present', async () => {
      // Arrange
      prisma.readingProgress.count.mockResolvedValue(1);
      prisma.readingProgress.findMany.mockResolvedValue([
        {
          lastPage: 1,
          percent: 10,
          updatedAt: new Date(),
          book: {
            id: 1,
            title: 'Book',
            coverImage: null,
            type: null,
            contributors: [{ role: 'ARTIST', contributor: { name: 'Only Artist' } }],
          },
          chapter: { title: 'Ch', index: 1, pageCount: 5 },
        },
      ]);

      // Act
      const result = await service.getReadingProgress(7);

      // Assert
      expect(result.data[0].book.contributors).toBe('Only Artist');
    });

    it('returns null contributors when the book has none', async () => {
      // Arrange
      prisma.readingProgress.count.mockResolvedValue(1);
      prisma.readingProgress.findMany.mockResolvedValue([
        {
          lastPage: 1,
          percent: 10,
          updatedAt: new Date(),
          book: { id: 1, title: 'Book', coverImage: null, type: null, contributors: [] },
          chapter: { title: 'Ch', index: 1, pageCount: 5 },
        },
      ]);

      // Act
      const result = await service.getReadingProgress(7);

      // Assert
      expect(result.data[0].book.contributors).toBeNull();
    });

    it('excludes completed books and paginates', async () => {
      // Arrange
      prisma.readingProgress.count.mockResolvedValue(60);
      prisma.readingProgress.findMany.mockResolvedValue([]);

      // Act
      const result = await service.getReadingProgress(7, 2, 24);

      // Assert
      expect(prisma.readingProgress.count).toHaveBeenCalledWith({
        where: { userId: 7, percent: { lt: 100 } },
      });
      expect(prisma.readingProgress.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 24, take: 24, orderBy: { updatedAt: 'desc' } }),
      );
      expect(result.lastPage).toBe(3);
    });
  });

  describe('getAdminOverview', () => {
    /** Arranges the seven parallel counts/aggregates getAdminOverview performs. */
    const arrangeOverview = (opts: {
      totalUsers?: number;
      new30?: number;
      prev30?: number;
      books?: number;
      chapters?: number;
      revenueNow?: number;
      revenuePrev?: number;
    }) => {
      prisma.user.count
        .mockResolvedValueOnce(opts.totalUsers ?? 0)
        .mockResolvedValueOnce(opts.new30 ?? 0)
        .mockResolvedValueOnce(opts.prev30 ?? 0);
      prisma.book.count.mockResolvedValue(opts.books ?? 0);
      prisma.chapter.count.mockResolvedValue(opts.chapters ?? 0);
      prisma.walletTransaction.aggregate
        .mockResolvedValueOnce({ _sum: { amount: opts.revenueNow ?? 0 } })
        .mockResolvedValueOnce({ _sum: { amount: opts.revenuePrev ?? 0 } });
    };

    it('caches the overview under a stable key with a 5 minute TTL', async () => {
      // Arrange
      arrangeOverview({});

      // Act
      await service.getAdminOverview(['MANAGE_FINANCE'], ADMIN_USER_ID);

      // Assert
      expect(cacheManager.getOrSet).toHaveBeenCalledWith(
        'admin:dashboard:overview',
        { ttlSeconds: 300, earlyRefreshWindowSeconds: 30 },
        expect.any(Function),
      );
    });

    it('serves the cached payload without querying the database', async () => {
      // Arrange: simulate a cache hit by not invoking the loader.
      const cached = { users: { total: 1, new30d: 0, growthPercent: 0 } };
      cacheManager.getOrSet.mockResolvedValue(cached);

      // Act
      const result = await service.getAdminOverview([], ADMIN_USER_ID);

      // Assert
      expect(result).toBe(cached);
      expect(prisma.user.count).not.toHaveBeenCalled();
    });

    it('computes user growth against the previous 30-day window', async () => {
      // Arrange
      arrangeOverview({ totalUsers: 100, new30: 20, prev30: 10, books: 5, chapters: 50 });

      // Act
      const result = await service.getAdminOverview(['MANAGE_FINANCE'], ADMIN_USER_ID);

      // Assert: (20-10)/10 = +100%.
      expect(result.users).toEqual({ total: 100, new30d: 20, growthPercent: 100 });
      expect(result.content).toEqual({ books: 5, chapters: 50 });
    });

    it('reports 100% growth when the previous window was zero', async () => {
      // Arrange
      arrangeOverview({ new30: 7, prev30: 0 });

      // Act
      const result = await service.getAdminOverview([], ADMIN_USER_ID);

      // Assert
      expect(result.users.growthPercent).toBe(100);
    });

    it('reports 0% growth when both windows are zero', async () => {
      // Arrange
      arrangeOverview({ new30: 0, prev30: 0 });

      // Act
      const result = await service.getAdminOverview([], ADMIN_USER_ID);

      // Assert
      expect(result.users.growthPercent).toBe(0);
    });

    it('omits finance data when the caller lacks MANAGE_FINANCE', async () => {
      // Arrange
      arrangeOverview({ revenueNow: 999 });

      // Act
      const result = await service.getAdminOverview(['MANAGE_USERS'], ADMIN_USER_ID);

      // Assert: finance must be withheld, and no revenue query issued.
      expect(result.finance).toBeNull();
      expect(prisma.walletTransaction.aggregate).not.toHaveBeenCalled();
    });

    it('includes finance data for a caller holding MANAGE_FINANCE', async () => {
      // Arrange
      arrangeOverview({ revenueNow: 300, revenuePrev: 150 });

      // Act
      const result = await service.getAdminOverview(['MANAGE_FINANCE'], ADMIN_USER_ID);

      // Assert
      expect(result.finance).toEqual({ revenue30d: 300, growthPercent: 100 });
    });

    it('grants finance data to the super admin without an explicit permission', async () => {
      // Arrange
      arrangeOverview({ revenueNow: 80, revenuePrev: 80 });

      // Act
      const result = await service.getAdminOverview([], SUPER_ADMIN_USER_ID);

      // Assert: userId 1 is privileged by design.
      expect(result.finance).toEqual({ revenue30d: 80, growthPercent: 0 });
    });
  });

  describe('getAdminFinanceData', () => {
    it('returns null for a caller without MANAGE_FINANCE', async () => {
      // Act
      const result = await service.getAdminFinanceData(['MANAGE_USERS'], ADMIN_USER_ID);

      // Assert: short-circuits before touching the cache or database.
      expect(result).toBeNull();
      expect(cacheManager.getOrSet).not.toHaveBeenCalled();
    });

    it('allows the super admin through the permission gate', async () => {
      // Arrange
      cacheManager.getOrSet.mockResolvedValue({ ok: true });

      // Act
      const result = await service.getAdminFinanceData([], SUPER_ADMIN_USER_ID);

      // Assert
      expect(result).toEqual({ ok: true });
      expect(cacheManager.getOrSet).toHaveBeenCalled();
    });
  });
});
