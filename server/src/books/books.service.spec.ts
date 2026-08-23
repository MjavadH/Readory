import { BadRequestException } from '@nestjs/common';
import type { CacheManager } from '../cache/cache.manager';
import type { PrismaService } from '../prisma/prisma.service';
import type { PublicService } from '../public/public.service';
import { BooksService } from './books.service';

describe('BooksService', () => {
  let service: BooksService;

  const txMock = {
    bookRating: { upsert: jest.fn() },
    book: { update: jest.fn() },
    bookRatingAggregate: jest.fn(),
  };

  const prisma = {
    book: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  } as unknown as jest.Mocked<PrismaService>;

  const publicService = {
    clearHomeCache: jest.fn(),
    clearGenresPageCache: jest.fn(),
  } as unknown as jest.Mocked<PublicService>;

  const cacheManager = {
    del: jest.fn(),
    getString: jest.fn(),
    setString: jest.fn(),
  } as unknown as jest.Mocked<CacheManager>;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BooksService(prisma, publicService, cacheManager);
  });

  it('rateBook returns updated aggregate on happy path', async () => {
    prisma.book.findUnique.mockResolvedValue({
      id: 10,
      updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    } as never);

    prisma.$transaction.mockImplementation(async (cb: any) => {
      const tx = {
        bookRating: {
          upsert: jest.fn(),
          aggregate: jest.fn().mockResolvedValue({ _avg: { rating: 4.5 }, _count: { rating: 2 } }),
        },
        book: { update: jest.fn() },
      };
      return cb(tx);
    });

    const result = await service.rateBook(1, 10, 5);

    expect(result).toEqual({ rating: 5, ratingAvg: 4.5, ratingCount: 2 });
    expect(publicService.clearHomeCache).toHaveBeenCalled();
  });

  it('rateBook throws on invalid rating', async () => {
    await expect(service.rateBook(1, 10, 0)).rejects.toBeInstanceOf(BadRequestException);
  });
});
