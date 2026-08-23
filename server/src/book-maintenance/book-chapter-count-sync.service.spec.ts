import { ConflictException } from '@nestjs/common';

import { BookChapterCountSyncService } from './book-chapter-count-sync.service';

describe('BookChapterCountSyncService', () => {
  const queue = {
    getJob: jest.fn(),
    add: jest.fn(),
  };

  const prisma = {
    book: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };

  const cacheManager = {
    del: jest.fn(),
    bumpVersion: jest.fn(),
  };

  let service: BookChapterCountSyncService;

  beforeEach(() => {
    jest.clearAllMocks();

    service = new BookChapterCountSyncService(
      queue as never,
      prisma as never,
      cacheManager as never,
    );
  });

  it('rejects a second request for the same business day', async () => {
    queue.getJob.mockResolvedValue({
      id: 'book-chapter-count-sync-2026-08-22',
    });

    await expect(service.enqueueDailySync()).rejects.toBeInstanceOf(ConflictException);

    expect(queue.add).not.toHaveBeenCalled();
  });

  it('enqueues exactly one maintenance job when none exists', async () => {
    queue.getJob.mockResolvedValue(undefined);
    queue.add.mockResolvedValue({
      id: 'book-chapter-count-sync-2026-08-22',
    });

    const result = await service.enqueueDailySync();

    expect(queue.add).toHaveBeenCalledTimes(1);
    expect(result.started).toBe(true);
    expect(result.jobId).toMatch(/^book-chapter-count-sync-\d{4}-\d{2}-\d{2}$/);
  });

  it('updates only mismatched books', async () => {
    prisma.book.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }]);

    prisma.$queryRaw.mockResolvedValue([{ id: 2 }]);

    prisma.book.count.mockResolvedValue(3);

    cacheManager.del.mockResolvedValue(undefined);
    cacheManager.bumpVersion.mockResolvedValue(undefined);

    const job = {
      id: 'book-chapter-count-sync-test',
      name: 'sync-published-chapter-counts',
      data: {
        businessDay: '2026-08-22',
        cursorId: 0,
        processedBooks: 0,
        correctedBooks: 0,
        startedAt: new Date().toISOString(),
      },
      updateData: jest.fn().mockResolvedValue(undefined),
      updateProgress: jest.fn().mockResolvedValue(undefined),
    };

    const result = await service.process(job as never);

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(result.processedBooks).toBe(3);
    expect(result.correctedBooks).toBe(1);

    expect(cacheManager.del).toHaveBeenCalled();
    expect(cacheManager.bumpVersion).toHaveBeenCalledWith('books:recommendation:version');
  });
});
