import { BookChapterCountSyncProcessor } from './book-chapter-count-sync.processor';

describe('BookChapterCountSyncProcessor', () => {
  it('delegates the job to the service', async () => {
    const syncService = {
      process: jest.fn().mockResolvedValue({
        businessDay: '2026-08-22',
        processedBooks: 100,
        correctedBooks: 2,
        completedAt: new Date().toISOString(),
      }),
    };

    const processor = new BookChapterCountSyncProcessor(syncService as never);

    const job = {
      id: 'book-chapter-count-sync-2026-08-22',
      name: 'sync-published-chapter-counts',
      data: {
        businessDay: '2026-08-22',
        cursorId: 0,
        processedBooks: 0,
        correctedBooks: 0,
        startedAt: new Date().toISOString(),
      },
    };

    await expect(processor.process(job as never)).resolves.toMatchObject({
      processedBooks: 100,
      correctedBooks: 2,
    });

    expect(syncService.process).toHaveBeenCalledWith(job);
  });

  it('rejects unknown job names', async () => {
    const syncService = {
      process: jest.fn(),
    };

    const processor = new BookChapterCountSyncProcessor(syncService as never);

    const job = {
      id: 'invalid',
      name: 'invalid-job',
      data: {},
    };

    await expect(processor.process(job as never)).rejects.toThrow(
      'Unsupported maintenance job: invalid-job',
    );
  });
});
