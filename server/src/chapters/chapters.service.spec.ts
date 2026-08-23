import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { CacheManager } from '../cache/cache.manager';
import { ChapterCache } from '../cache/chapter-cache.service';
import { PrismaService } from '../prisma/prisma.service';
import { PublicService } from '../public/public.service';
import { WalletsService } from '../wallets/wallets.service';
import { ChaptersService } from './chapters.service';

describe('ChaptersService', () => {
  let service: ChaptersService;
  let prisma: Record<string, any>;
  let walletsService: Record<string, any>;
  let publicService: Record<string, any>;
  let cacheManager: Record<string, any>;
  let chapterCache: Record<string, any>;

  beforeEach(async () => {
    prisma = {
      chapter: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      book: {
        update: jest.fn(),
      },
      accessRecord: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn((args: unknown) => {
        if (Array.isArray(args)) return Promise.all(args);
        if (typeof args === 'function') return args(prisma);
        return Promise.resolve(args);
      }),
    };

    walletsService = { debit: jest.fn() };
    publicService = { clearHomeCache: jest.fn() };
    cacheManager = {
      del: jest.fn(),
      getOrSet: jest.fn(async (_k: string, _opt: unknown, loader: () => Promise<unknown>) =>
        loader(),
      ),
    };
    chapterCache = {
      getListVersion: jest.fn().mockResolvedValue(1),
      buildListKey: jest.fn().mockReturnValue('chapters:cache:key'),
      bumpListVersion: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChaptersService,
        { provide: PrismaService, useValue: prisma },
        { provide: WalletsService, useValue: walletsService },
        { provide: PublicService, useValue: publicService },
        { provide: CacheManager, useValue: cacheManager },
        { provide: ChapterCache, useValue: chapterCache },
      ],
    }).compile();

    service = module.get<ChaptersService>(ChaptersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('listChapters', () => {
    it('returns paginated chapters with default params', async () => {
      const items = [
        {
          id: 1,
          title: 'Ch 1',
          index: 1,
          price: { toNumber: () => 2.5 },
          isFree: false,
          updatedAt: new Date(),
        },
      ];
      prisma.$transaction.mockResolvedValue([items, 1]);

      const result = await service.listChapters(1, {});

      expect(result.items[0].price).toBe(2.5);
      expect(result.pagination).toEqual(expect.objectContaining({ page: 1 }));
    });

    it('returns items with null price when price is null', async () => {
      const items = [
        { id: 1, title: 'Ch 1', index: 1, price: null, isFree: true, updatedAt: new Date() },
      ];
      prisma.$transaction.mockResolvedValue([items, 1]);

      const result = await service.listChapters(1, {});

      expect(result.items[0].price).toBeNull();
    });

    it('skips cache for pages > 20', async () => {
      const items = [
        { id: 1, title: 'Ch', index: 1, price: null, isFree: true, updatedAt: new Date() },
      ];
      prisma.$transaction.mockResolvedValue([items, 500]);

      await service.listChapters(1, { page: 21, limit: 10 });

      expect(chapterCache.getListVersion).not.toHaveBeenCalled();
    });

    it('uses cache for pages <= 20', async () => {
      const items = [
        { id: 1, title: 'Ch', index: 1, price: null, isFree: true, updatedAt: new Date() },
      ];
      prisma.$transaction.mockResolvedValue([items, 50]);

      await service.listChapters(1, { page: 1, limit: 10 });

      expect(chapterCache.getListVersion).toHaveBeenCalledWith(1);
      expect(cacheManager.getOrSet).toHaveBeenCalled();
    });

    it('respects order param', async () => {
      prisma.$transaction.mockResolvedValue([[], 0]);
      await service.listChapters(1, { order: 'desc' });
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('handles search query', async () => {
      prisma.$transaction.mockResolvedValue([[], 0]);
      await service.listChapters(1, { q: 'chapter title' });
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('createChapter', () => {
    it('creates a chapter and invalidates caches', async () => {
      const chapter = { id: 1, title: 'Ch 1', index: 1 };
      prisma.chapter.create.mockResolvedValue(chapter);
      prisma.book.update.mockResolvedValue({});

      const result = await service.createChapter(1, { title: 'Ch 1', index: 1 });

      expect(result).toEqual(chapter);
      expect(cacheManager.del).toHaveBeenCalledWith('stats:chapters:count');
      expect(publicService.clearHomeCache).toHaveBeenCalled();
      expect(chapterCache.bumpListVersion).toHaveBeenCalledWith(1);
    });

    it('creates a free chapter with null price', async () => {
      prisma.chapter.create.mockResolvedValue({ id: 1 });
      prisma.book.update.mockResolvedValue({});

      await service.createChapter(1, { title: 'Free Ch', index: 2, isFree: true, price: 10 });

      expect(prisma.chapter.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isFree: true, price: null }),
        }),
      );
    });

    it('creates chapter with Decimal price when not free', async () => {
      prisma.chapter.create.mockResolvedValue({ id: 1 });
      prisma.book.update.mockResolvedValue({});

      await service.createChapter(1, { title: 'Paid Ch', index: 3, price: 5 });

      const callData = prisma.chapter.create.mock.calls[0][0].data;
      expect(callData.isFree).toBe(false);
      expect(callData.price).toBeInstanceOf(Prisma.Decimal);
    });

    it('throws ConflictException on duplicate index', async () => {
      prisma.chapter.create.mockRejectedValue({ code: 'P2002' });
      await expect(service.createChapter(1, { title: 'Ch', index: 1 })).rejects.toThrow(
        ConflictException,
      );
    });

    it('rethrows unexpected errors', async () => {
      prisma.chapter.create.mockRejectedValue(new Error('DB fail'));
      await expect(service.createChapter(1, { title: 'Ch', index: 1 })).rejects.toThrow('DB fail');
    });
  });

  describe('updateChapter', () => {
    it('throws NotFoundException when chapter not found', async () => {
      prisma.chapter.findFirst.mockResolvedValue(null);
      await expect(service.updateChapter(1, 99, { title: 'New' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('updates chapter and invalidates caches', async () => {
      prisma.chapter.findFirst.mockResolvedValue({
        id: 1,
        bookId: 1,
        isFree: false,
        price: new Prisma.Decimal(5),
      });
      const updated = {
        id: 1,
        title: 'Updated',
        index: 1,
        price: new Prisma.Decimal(5),
        isFree: false,
      };
      prisma.chapter.update.mockResolvedValue(updated);
      prisma.book.update.mockResolvedValue({});

      const result = await service.updateChapter(1, 1, { title: 'Updated' });

      expect(result).toEqual(updated);
      expect(publicService.clearHomeCache).toHaveBeenCalled();
      expect(chapterCache.bumpListVersion).toHaveBeenCalledWith(1);
    });

    it('sets price to null when chapter becomes free', async () => {
      prisma.chapter.findFirst.mockResolvedValue({
        id: 1,
        bookId: 1,
        isFree: false,
        price: new Prisma.Decimal(5),
      });
      prisma.chapter.update.mockResolvedValue({ id: 1 });
      prisma.book.update.mockResolvedValue({});

      await service.updateChapter(1, 1, { isFree: true });

      expect(prisma.chapter.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ price: null }),
        }),
      );
    });

    it('throws ConflictException on duplicate index', async () => {
      prisma.chapter.findFirst.mockResolvedValue({ id: 1, bookId: 1, isFree: false, price: null });
      prisma.chapter.update.mockRejectedValue({ code: 'P2002' });
      await expect(service.updateChapter(1, 1, { index: 2 })).rejects.toThrow(ConflictException);
    });
  });

  describe('deleteChapter', () => {
    it('throws NotFoundException when chapter not found', async () => {
      prisma.chapter.findFirst.mockResolvedValue(null);
      await expect(service.deleteChapter(1, 99)).rejects.toThrow(NotFoundException);
    });

    it('deletes chapter and invalidates caches', async () => {
      prisma.chapter.findFirst.mockResolvedValue({ id: 5, bookId: 1 });
      prisma.chapter.delete.mockResolvedValue(undefined);
      prisma.book.update.mockResolvedValue({});

      const result = await service.deleteChapter(1, 5);

      expect(result).toEqual({ id: 5, deleted: true });
      expect(cacheManager.del).toHaveBeenCalledWith('stats:chapters:count');
      expect(publicService.clearHomeCache).toHaveBeenCalled();
      expect(chapterCache.bumpListVersion).toHaveBeenCalledWith(1);
    });
  });

  describe('getAccessibleChapterByIndex', () => {
    it('throws NotFoundException when chapter not found', async () => {
      prisma.chapter.findFirst.mockResolvedValue(null);
      await expect(service.getAccessibleChapterByIndex(1, 1, 1)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when user has no access', async () => {
      prisma.chapter.findFirst.mockResolvedValue({ id: 1, bookId: 1, isFree: false, price: null });
      prisma.accessRecord.findFirst.mockResolvedValue(null);
      await expect(service.getAccessibleChapterByIndex(1, 1, 1)).rejects.toThrow(NotFoundException);
    });

    it('returns chapter when user has access via free chapter', async () => {
      const chapter = {
        id: 1,
        bookId: 1,
        title: 'Ch 1',
        index: 1,
        contentPath: '/path',
        isFree: true,
        price: null,
        updatedAt: new Date(),
      };
      prisma.chapter.findFirst.mockResolvedValue(chapter);

      const result = await service.getAccessibleChapterByIndex(1, 1, 10);

      expect(result.price).toBeNull();
      expect(result.isFree).toBe(true);
    });

    it('returns chapter with numeric price', async () => {
      const chapter = {
        id: 1,
        bookId: 1,
        title: 'Ch 1',
        index: 1,
        contentPath: '/path',
        isFree: false,
        price: { toNumber: () => 3.5 },
        updatedAt: new Date(),
      };
      prisma.chapter.findFirst.mockResolvedValue(chapter);
      prisma.accessRecord.findFirst.mockResolvedValue({ id: 1 });

      const result = await service.getAccessibleChapterByIndex(1, 1, 10);

      expect(result.price).toBe(3.5);
    });
  });

  describe('purchaseChapter', () => {
    it('throws NotFoundException when chapter not found', async () => {
      prisma.chapter.findUnique.mockResolvedValue(null);
      await expect(service.purchaseChapter(1, 99)).rejects.toThrow(NotFoundException);
    });

    it('grants access for free chapter', async () => {
      const chapter = {
        id: 1,
        index: 1,
        isFree: true,
        price: null,
        book: { id: 1, title: 'Book' },
      };
      prisma.chapter.findUnique.mockResolvedValue(chapter);
      prisma.accessRecord.findFirst.mockResolvedValue(null);
      const record = { id: 1, userId: 10, chapterId: 1, bookId: 1 };
      prisma.accessRecord.create.mockResolvedValue(record);

      const result = await service.purchaseChapter(10, 1);

      expect(result).toEqual(record);
      expect(walletsService.debit).not.toHaveBeenCalled();
    });

    it('returns existing access record for free chapter', async () => {
      const chapter = {
        id: 1,
        index: 1,
        isFree: true,
        price: null,
        book: { id: 1, title: 'Book' },
      };
      prisma.chapter.findUnique.mockResolvedValue(chapter);
      const existing = { id: 5, userId: 10, chapterId: 1, bookId: 1 };
      prisma.accessRecord.findFirst.mockResolvedValue(existing);

      const result = await service.purchaseChapter(10, 1);

      expect(result).toEqual(existing);
    });

    it('returns existing access record for paid chapter already purchased', async () => {
      const chapter = {
        id: 1,
        index: 1,
        isFree: false,
        price: { toNumber: () => 5 },
        book: { id: 1, title: 'Book' },
      };
      prisma.chapter.findUnique.mockResolvedValue(chapter);
      const existing = { id: 5 };
      prisma.accessRecord.findFirst.mockResolvedValue(existing);

      const result = await service.purchaseChapter(10, 1);

      expect(result).toEqual(existing);
      expect(walletsService.debit).not.toHaveBeenCalled();
    });

    it('debits wallet and creates access for paid chapter', async () => {
      const chapter = {
        id: 1,
        index: 1,
        isFree: false,
        price: { toNumber: () => 5 },
        book: { id: 1, title: 'Book' },
      };
      prisma.chapter.findUnique.mockResolvedValue(chapter);
      prisma.accessRecord.findFirst.mockResolvedValue(null);
      const record = { id: 99 };
      prisma.accessRecord.create.mockResolvedValue(record);

      const result = await service.purchaseChapter(10, 1);

      expect(walletsService.debit).toHaveBeenCalledWith(10, 5, 'Purchase chapter 1 | Book');
      expect(result).toEqual(record);
    });
  });
});
