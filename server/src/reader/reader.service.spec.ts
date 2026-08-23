import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { CacheManager } from '../cache/cache.manager';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ReaderService } from './reader.service';

describe('ReaderService', () => {
  let service: ReaderService;

  const prismaMock = {
    chapter: { findFirst: jest.fn(), findUnique: jest.fn() },
    accessRecord: { findFirst: jest.fn() },
    readingProgress: { findUnique: jest.fn(), upsert: jest.fn() },
  };

  const storageMock = { getObjectBuffer: jest.fn() };
  const cacheMock = {
    buildKey: jest.fn().mockReturnValue('manifest:key'),
    getOrSet: jest.fn(async (_k: string, _opt: unknown, loader: () => Promise<unknown>) =>
      loader(),
    ),
    del: jest.fn(),
  };

  const redisMock = {
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn(),
    get: jest.fn().mockResolvedValue(null),
    zadd: jest.fn(),
    zremrangebyscore: jest.fn(),
    zcard: jest.fn().mockResolvedValue(1),
    set: jest.fn(),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ReaderService,
        {
          provide: JwtService,
          useValue: new JwtService({ secret: 'test-secret' }),
        },
        { provide: PrismaService, useValue: prismaMock },
        { provide: StorageService, useValue: storageMock },
        { provide: CacheManager, useValue: cacheMock },
        { provide: 'REDIS_CLIENT', useValue: redisMock },
      ],
    }).compile();

    service = module.get(ReaderService);
  });

  it('should reject session when no access', async () => {
    prismaMock.chapter.findFirst.mockResolvedValue({
      id: 1,
      bookId: 1,
      index: 1,
      isFree: false,
      contentVersion: 0,
      pageCount: 1,
      contentType: 'images',
    });
    prismaMock.accessRecord.findFirst.mockResolvedValue(null);
    await expect(
      service.createSession(10, 1, 1, {
        headers: { 'user-agent': 'jest' },
      } as never),
    ).rejects.toBeTruthy();
  });

  it('should upsert progress with clamp', async () => {
    prismaMock.chapter.findUnique.mockResolvedValue({
      id: 1,
      bookId: 3,
      isFree: true,
      pageCount: 10,
    });
    prismaMock.readingProgress.upsert.mockResolvedValue({
      lastPage: 10,
      percent: 100,
    });
    prismaMock.accessRecord.findFirst.mockResolvedValue({ id: 99 });

    const saved = await service.saveProgress(2, 1, 100);
    expect(prismaMock.readingProgress.upsert).toHaveBeenCalled();
    expect(saved).toEqual({ lastPage: 10, percent: 100 });
  });
});
