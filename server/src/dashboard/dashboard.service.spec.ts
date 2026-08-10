import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { WalletsService } from '../wallets/wallets.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: Record<string, any>;
  let authService: Record<string, any>;
  let walletsService: Record<string, any>;

  beforeEach(async () => {
    prisma = {
      readingProgress: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      accessRecord: {
        groupBy: jest.fn().mockResolvedValue([]),
      },
      book: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn(),
      },
      chapter: {
        groupBy: jest.fn().mockResolvedValue([]),
        count: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      user: {
        count: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      walletTransaction: {
        findMany: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      genre: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      bookType: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      $queryRaw: jest.fn().mockResolvedValue([{ count: 5n }]),
    };

    authService = {
      getProfile: jest.fn().mockResolvedValue({ id: 1, email: 'user@test.com' }),
    };

    walletsService = {
      getWallet: jest.fn().mockResolvedValue({
        balance: 100,
        transactions: [],
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuthService, useValue: authService },
        { provide: WalletsService, useValue: walletsService },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUserDashboardOverview', () => {
    it('returns overview with profile, wallet, continueReading, and recentLibrary', async () => {
      prisma.readingProgress.findFirst.mockResolvedValue(null);

      const result = await service.getUserDashboardOverview(1, { txLimit: 6, libraryLimit: 8 });

      expect(result.profile).toEqual({ id: 1, email: 'user@test.com' });
      expect(result.wallet).toEqual({ balance: 100 });
      expect(result.recentTransactions).toEqual([]);
      expect(result.continueReading).toBeNull();
      expect(result.recentLibrary).toEqual({ data: [] });
    });

    it('clamps txLimit and libraryLimit', async () => {
      prisma.readingProgress.findFirst.mockResolvedValue(null);

      await service.getUserDashboardOverview(1, { txLimit: 999, libraryLimit: 999 });

      expect(walletsService.getWallet).toHaveBeenCalledWith(1, { take: 20 });
    });

    it('returns continueReading when progress exists', async () => {
      const now = new Date();
      prisma.readingProgress.findFirst.mockResolvedValue({
        lastPage: 5,
        percent: 50,
        updatedAt: now,
        chapterId: 1,
        bookId: 1,
        book: {
          id: 1,
          type: { slug: 'manga', iconKey: null },
          title: 'Test',
          author: 'Auth',
          coverImage: 'img.jpg',
        },
        chapter: { title: 'Ch 1', index: 1, pageCount: 10 },
      });

      const result = await service.getUserDashboardOverview(1, { txLimit: 6, libraryLimit: 8 });

      expect(result.continueReading).toEqual({
        book: expect.objectContaining({ title: 'Test' }),
        chapter: expect.objectContaining({ title: 'Ch 1' }),
        progress: { lastPage: 5, percent: 50 },
        lastReadAt: now,
      });
    });
  });

  describe('exportTransactionsCsv', () => {
    it('returns CSV header for empty transactions', async () => {
      prisma.walletTransaction.findMany.mockResolvedValue([]);

      const csv = await service.exportTransactionsCsv(1);

      expect(csv).toContain('Row');
      expect(csv).toContain('Transaction ID');
    });

    it('sanitizes CSV injection characters in reference', async () => {
      prisma.walletTransaction.findMany.mockResolvedValue([
        {
          id: 1,
          createdAt: new Date('2025-01-01'),
          type: 'CREDIT',
          amount: 10,
          reference: '=FORMULA()',
        },
      ]);

      const csv = await service.exportTransactionsCsv(1);

      expect(csv).toContain("'=FORMULA()");
    });

    it('sanitizes references starting with +, -, @', async () => {
      prisma.walletTransaction.findMany.mockResolvedValue([
        { id: 1, createdAt: new Date('2025-01-01'), type: 'CREDIT', amount: 10, reference: '+cmd' },
        { id: 2, createdAt: new Date('2025-01-01'), type: 'DEBIT', amount: 5, reference: '-rm' },
        { id: 3, createdAt: new Date('2025-01-01'), type: 'CREDIT', amount: 3, reference: '@sum' },
      ]);

      const csv = await service.exportTransactionsCsv(1);

      expect(csv).toContain("'+cmd");
      expect(csv).toContain("'-rm");
      expect(csv).toContain("'@sum");
    });
  });

  describe('getUserLibrary', () => {
    it('returns empty library when no access records', async () => {
      const result = await service.getUserLibrary(1);

      expect(result.data).toEqual([]);
      expect(result.total).toBe(5);
    });

    it('returns library items with correct purchase percentages', async () => {
      prisma.accessRecord.groupBy.mockResolvedValue([
        { bookId: 1, _count: { _all: 3 }, _max: { purchasedAt: new Date() } },
      ]);
      prisma.book.findMany.mockResolvedValue([
        {
          id: 1,
          title: 'Book',
          author: 'Auth',
          coverImage: 'img',
          updatedAt: new Date(),
          type: { slug: 'manga' },
        },
      ]);
      prisma.chapter.groupBy.mockResolvedValue([{ bookId: 1, _count: { _all: 10 } }]);

      const result = await service.getUserLibrary(1);

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toEqual(
        expect.objectContaining({
          purchasedChapters: 3,
          totalChapters: 10,
          purchasedPercent: 30,
        }),
      );
    });

    it('handles books not found in DB', async () => {
      prisma.accessRecord.groupBy.mockResolvedValue([
        { bookId: 999, _count: { _all: 1 }, _max: { purchasedAt: new Date() } },
      ]);

      const result = await service.getUserLibrary(1);

      expect(result.data).toEqual([]);
    });

    it('caps purchasedPercent at 100', async () => {
      prisma.accessRecord.groupBy.mockResolvedValue([
        { bookId: 1, _count: { _all: 15 }, _max: { purchasedAt: new Date() } },
      ]);
      prisma.book.findMany.mockResolvedValue([
        {
          id: 1,
          title: 'Book',
          author: 'A',
          coverImage: '',
          updatedAt: new Date(),
          type: { slug: 'x' },
        },
      ]);
      prisma.chapter.groupBy.mockResolvedValue([{ bookId: 1, _count: { _all: 10 } }]);

      const result = await service.getUserLibrary(1);

      expect(result.data[0].purchasedPercent).toBe(100);
    });
  });

  describe('getReadingProgress', () => {
    it('returns paginated reading progress', async () => {
      prisma.readingProgress.count.mockResolvedValue(2);
      prisma.readingProgress.findMany.mockResolvedValue([
        {
          lastPage: 3,
          percent: 30,
          updatedAt: new Date(),
          book: {
            id: 1,
            title: 'Book',
            author: 'A',
            coverImage: '',
            type: { slug: 'manga', iconKey: null },
          },
          chapter: { title: 'Ch 1', index: 1, pageCount: 10 },
        },
      ]);

      const result = await service.getReadingProgress(1, 1, 24);

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toEqual(
        expect.objectContaining({
          progress: { lastPage: 3, percent: 30 },
        }),
      );
      expect(result.total).toBe(2);
    });
  });

  describe('getAdminDashboardStats', () => {
    beforeEach(() => {
      prisma.user.count.mockResolvedValue(10);
      prisma.book.count.mockResolvedValue(5);
      prisma.chapter.count.mockResolvedValue(50);
    });

    it('returns stats for super admin (userId=1)', async () => {
      const result = await service.getAdminDashboardStats([], 1);

      expect(result.summary.users).not.toBeNull();
      expect(result.summary.finance).not.toBeNull();
      expect(result.summary.content).toEqual(
        expect.objectContaining({
          books: 5,
          chapters: 50,
        }),
      );
    });

    it('returns null finance stats when user lacks MANAGE_FINANCE', async () => {
      const result = await service.getAdminDashboardStats(['MANAGE_USERS', 'MANAGE_BOOKS'], 999);

      expect(result.summary.finance).toBeNull();
    });

    it('returns null user stats when user lacks MANAGE_USERS/MANAGE_STAFF', async () => {
      const result = await service.getAdminDashboardStats(['MANAGE_FINANCE'], 999);

      expect(result.summary.users).toBeNull();
    });

    it('calculates growth correctly', async () => {
      prisma.user.count
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(20)
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(50);

      const result = await service.getAdminDashboardStats(['MANAGE_USERS'], 999);

      expect(result.summary.users!.growth).toBe(100);
    });

    it('handles zero previous growth', async () => {
      prisma.user.count
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(50);

      const result = await service.getAdminDashboardStats(['MANAGE_USERS'], 999);

      expect(result.summary.users!.growth).toBe(100);
    });

    it('handles genre stats with more than 5 genres', async () => {
      const genres = Array.from({ length: 8 }, (_, i) => ({
        name: `Genre ${i}`,
        _count: { books: 10 - i },
      }));
      prisma.genre.findMany.mockResolvedValue(genres);

      const result = await service.getAdminDashboardStats(['MANAGE_BOOKS'], 999);

      expect(result.charts.genreDistribution.length).toBe(6);
      expect(result.charts.genreDistribution[5].name).toBe('Others');
    });

    it('handles type stats with 5 or fewer types', async () => {
      const types = [
        { name: 'Manga', _count: { books: 5 } },
        { name: 'Novel', _count: { books: 3 } },
      ];
      prisma.bookType.findMany.mockResolvedValue(types);

      const result = await service.getAdminDashboardStats(['MANAGE_BOOKS'], 999);

      expect(result.charts.typeDistribution).toEqual([
        { name: 'Manga', value: 5 },
        { name: 'Novel', value: 3 },
      ]);
    });
  });
});
