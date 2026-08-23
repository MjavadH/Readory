import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { CacheModule } from '../cache/cache.module';
import { PrismaModule } from '../prisma/prisma.module';
import { BookChapterCountSyncProcessor } from './book-chapter-count-sync.processor';
import { BookChapterCountSyncService } from './book-chapter-count-sync.service';
import { BOOK_CHAPTER_COUNT_SYNC_QUEUE } from './book-maintenance.constants';
import { BookMaintenanceController } from './book-maintenance.controller';

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
