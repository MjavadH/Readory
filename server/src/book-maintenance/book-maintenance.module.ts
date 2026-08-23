import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { PrismaModule } from '../prisma/prisma.module';
import { CacheModule } from '../cache/cache.module';

import { BOOK_CHAPTER_COUNT_SYNC_QUEUE } from './book-maintenance.constants';

import { BookMaintenanceController } from './book-maintenance.controller';
import { BookChapterCountSyncService } from './book-chapter-count-sync.service';
import { BookChapterCountSyncProcessor } from './book-chapter-count-sync.processor';

@Module({
  imports: [
    PrismaModule,
    CacheModule,
    BullModule.registerQueue({
      name: BOOK_CHAPTER_COUNT_SYNC_QUEUE,
    }),
  ],
  controllers: [BookMaintenanceController],
  providers: [BookChapterCountSyncService, BookChapterCountSyncProcessor],
})
export class BookMaintenanceModule {}
