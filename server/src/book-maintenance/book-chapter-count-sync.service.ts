import { InjectQueue } from '@nestjs/bullmq';
import { ConflictException, Injectable, Logger } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import type { CacheManager } from '../cache/cache.manager';
import type { PrismaService } from '../prisma/prisma.service';

import {
  BOOK_CHAPTER_COUNT_SYNC_ATTEMPTS,
  BOOK_CHAPTER_COUNT_SYNC_BACKOFF_DELAY_MS,
  BOOK_CHAPTER_COUNT_SYNC_BATCH_SIZE,
  BOOK_CHAPTER_COUNT_SYNC_COMPLETED_RETENTION_SECONDS,
  BOOK_CHAPTER_COUNT_SYNC_FAILED_RETENTION_SECONDS,
  BOOK_CHAPTER_COUNT_SYNC_JOB,
  BOOK_CHAPTER_COUNT_SYNC_QUEUE,
} from './book-maintenance.constants';

export interface BookChapterCountSyncJobData {
  readonly businessDay: string;
  readonly cursorId: number;
  readonly processedBooks: number;
  readonly correctedBooks: number;
  readonly startedAt: string;
}

export interface BookChapterCountSyncResult {
  readonly businessDay: string;
  readonly processedBooks: number;
  readonly correctedBooks: number;
  readonly completedAt: string;
}

export interface BookChapterCountSyncEnqueueResult {
  readonly started: boolean;
  readonly jobId: string;
  readonly businessDay: string;
}

@Injectable()
export class BookChapterCountSyncService {
  private readonly logger = new Logger(BookChapterCountSyncService.name);

  constructor(
    @InjectQueue(BOOK_CHAPTER_COUNT_SYNC_QUEUE)
    private readonly queue: Queue<
      BookChapterCountSyncJobData,
      BookChapterCountSyncResult,
      typeof BOOK_CHAPTER_COUNT_SYNC_JOB
    >,
    private readonly prisma: PrismaService,
    private readonly cacheManager: CacheManager,
  ) {}

  async enqueueDailySync(): Promise<BookChapterCountSyncEnqueueResult> {
    const businessDay = this.getBusinessDay();
    const jobId = this.buildDailyJobId(businessDay);

    const existingJob = await this.queue.getJob(jobId);

    if (existingJob) {
      throw new ConflictException(
        'Book chapter count synchronization has already been requested today.',
      );
    }

    const now = new Date();

    await this.queue.add(
      BOOK_CHAPTER_COUNT_SYNC_JOB,
      {
        businessDay,
        cursorId: 0,
        processedBooks: 0,
        correctedBooks: 0,
        startedAt: now.toISOString(),
      },
      {
        jobId,
        attempts: BOOK_CHAPTER_COUNT_SYNC_ATTEMPTS,
        backoff: {
          type: 'exponential',
          delay: BOOK_CHAPTER_COUNT_SYNC_BACKOFF_DELAY_MS,
        },
        removeOnComplete: {
          age: BOOK_CHAPTER_COUNT_SYNC_COMPLETED_RETENTION_SECONDS,
          count: 10,
        },
        removeOnFail: {
          age: BOOK_CHAPTER_COUNT_SYNC_FAILED_RETENTION_SECONDS,
          count: 10,
        },
        stackTraceLimit: 20,
      },
    );

    this.logger.log(
      `Book chapter count synchronization queued. jobId=${jobId} businessDay=${businessDay}`,
    );

    return {
      started: true,
      jobId,
      businessDay,
    };
  }

  async process(
    job: Job<
      BookChapterCountSyncJobData,
      BookChapterCountSyncResult,
      typeof BOOK_CHAPTER_COUNT_SYNC_JOB
    >,
  ): Promise<BookChapterCountSyncResult> {
    let cursorId = this.validatePositiveOrZeroInteger(job.data.cursorId, 'cursorId');
    let processedBooks = this.validatePositiveOrZeroInteger(
      job.data.processedBooks,
      'processedBooks',
    );
    let correctedBooks = this.validatePositiveOrZeroInteger(
      job.data.correctedBooks,
      'correctedBooks',
    );

    const startedAt = job.data.startedAt;

    const totalBooks = await this.prisma.book.count();
    const allCorrectedIds: number[] = [];

    for (;;) {
      const batchBookIds = await this.getNextBatchBookIds(cursorId);

      if (batchBookIds.length === 0) {
        break;
      }

      const lastBookId = batchBookIds[batchBookIds.length - 1];
      const correctedIds = await this.reconcileBatch(cursorId, lastBookId);

      allCorrectedIds.push(...correctedIds);

      processedBooks += batchBookIds.length;
      correctedBooks += correctedIds.length;
      cursorId = lastBookId;

      await job.updateData({
        businessDay: job.data.businessDay,
        cursorId,
        processedBooks,
        correctedBooks,
        startedAt,
      });

      const progress = this.calculateProgress(processedBooks, totalBooks);

      if (
        processedBooks === batchBookIds.length ||
        processedBooks % 5000 === 0 ||
        correctedIds.length > 0
      ) {
        await job.updateProgress(progress);
      }

      this.logger.log(
        `Book chapter count batch completed. jobId=${job.id} processed=${processedBooks} corrected=${correctedBooks} cursor=${cursorId}`,
      );
    }

    if (correctedBooks > 0) {
      await this.invalidateBookCountCaches(allCorrectedIds);
    }

    const completedAt = new Date().toISOString();

    this.logger.log(
      `Book chapter count synchronization completed. jobId=${job.id} processed=${processedBooks} corrected=${correctedBooks}`,
    );

    return {
      businessDay: job.data.businessDay,
      processedBooks,
      correctedBooks,
      completedAt,
    };
  }

  private async getNextBatchBookIds(cursorId: number): Promise<number[]> {
    const books = await this.prisma.book.findMany({
      where: {
        id: {
          gt: cursorId,
        },
      },
      orderBy: {
        id: 'asc',
      },
      take: BOOK_CHAPTER_COUNT_SYNC_BATCH_SIZE,
      select: {
        id: true,
      },
    });

    return books.map((book) => book.id);
  }

  private async reconcileBatch(cursorId: number, lastBookId: number): Promise<number[]> {
    const updatedRows = await this.prisma.$queryRaw<Array<{ id: number }>>`
      WITH desired_counts AS (
        SELECT
          b."id",
          COUNT(c."id") FILTER (
            WHERE c."publishStatus" = 'PUBLISHED'::"PublicationStatus"
          )::integer AS "chapterCount"
        FROM "Book" b
               LEFT JOIN "Chapter" c
                         ON c."bookId" = b."id"
        WHERE b."id" > ${cursorId}
          AND b."id" <= ${lastBookId}
        GROUP BY b."id"
      )
      UPDATE "Book" b
      SET "chapterCount" = desired_counts."chapterCount"
        FROM desired_counts
      WHERE b."id" = desired_counts."id"
        AND b."chapterCount" IS DISTINCT FROM desired_counts."chapterCount"
        RETURNING b."id";
    `;

    return updatedRows.map((row) => row.id);
  }

  private calculateProgress(processedBooks: number, totalBooks: number): number {
    if (totalBooks <= 0) {
      return 100;
    }

    return Math.min(100, Math.floor((processedBooks / totalBooks) * 100));
  }

  private async invalidateBookCountCaches(correctedIds: number[]): Promise<void> {
    const staticCachePromises = [
      this.cacheManager.del('books:browse:default'),
      this.cacheManager.del('stats:books'),
      this.cacheManager.del('stats:chapters:count'),
      this.cacheManager.bumpVersion('books:recommendation:version'),
    ];

    // Delete public detail caches per book
    const dynamicCachePromises = correctedIds.map((id) =>
      this.cacheManager.del(this.cacheManager.buildKey('books:detail:public', id)),
    );

    await Promise.allSettled([...staticCachePromises, ...dynamicCachePromises]);
  }

  private getBusinessDay(date = new Date()): string {
    const timeZone = process.env.ADMIN_MAINTENANCE_TIMEZONE?.trim() || 'UTC';

    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);

    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;

    if (!year || !month || !day) {
      throw new Error(`Unable to resolve maintenance business day for timezone ${timeZone}`);
    }

    return `${year}-${month}-${day}`;
  }

  private buildDailyJobId(businessDay: string): string {
    return `book-chapter-count-sync-${businessDay}`;
  }

  private validatePositiveOrZeroInteger(value: unknown, fieldName: string): number {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
      throw new Error(`Invalid ${fieldName} in maintenance job payload`);
    }

    return value;
  }
}
