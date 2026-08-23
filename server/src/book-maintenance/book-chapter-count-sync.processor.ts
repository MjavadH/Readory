import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import type {
  BookChapterCountSyncJobData,
  BookChapterCountSyncResult,
  BookChapterCountSyncService,
} from './book-chapter-count-sync.service';
import {
  BOOK_CHAPTER_COUNT_SYNC_JOB,
  BOOK_CHAPTER_COUNT_SYNC_QUEUE,
} from './book-maintenance.constants';

@Processor(BOOK_CHAPTER_COUNT_SYNC_QUEUE, {
  concurrency: 1,
})
export class BookChapterCountSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(BookChapterCountSyncProcessor.name);

  constructor(private readonly syncService: BookChapterCountSyncService) {
    super();
  }

  async process(
    job: Job<
      BookChapterCountSyncJobData,
      BookChapterCountSyncResult,
      typeof BOOK_CHAPTER_COUNT_SYNC_JOB
    >,
  ): Promise<BookChapterCountSyncResult> {
    if (job.name !== BOOK_CHAPTER_COUNT_SYNC_JOB) {
      throw new Error(`Unsupported maintenance job: ${job.name}`);
    }

    this.logger.log(`Processing maintenance job ${job.id}`);

    return this.syncService.process(job);
  }
}
