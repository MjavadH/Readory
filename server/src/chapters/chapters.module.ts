import { Module } from '@nestjs/common';
import { ChaptersService } from './chapters.service';
import { ChaptersController } from './chapters.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { WalletsModule } from '../wallets/wallets.module';
import { PublicModule } from '../public/public.module';
import { ChapterContentController } from './chapter-content.controller';
import { ChapterContentService } from './chapter-content.service';
import { StorageModule } from '../storage/storage.module';
import { CacheModule } from '../cache/cache.module';
import { ReaderModule } from '../reader/reader.module';
import { RecommendationService } from '../books/recommendation/recommendation.service';
import { OutboxModule } from '../outbox/outbox.module';
import { PdfProcessingService } from './pdf-processing.service';

@Module({
  imports: [
    OutboxModule,
    PrismaModule,
    WalletsModule,
    PublicModule,
    StorageModule,
    CacheModule,
    ReaderModule,
  ],
  providers: [ChaptersService, ChapterContentService, PdfProcessingService, RecommendationService],
  controllers: [ChaptersController, ChapterContentController],
})
export class ChaptersModule {}
