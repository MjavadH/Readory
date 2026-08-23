import { Module } from '@nestjs/common';
import { RecommendationService } from '../books/recommendation/recommendation.service';
import { CacheModule } from '../cache/cache.module';
import { OutboxModule } from '../outbox/outbox.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PublicModule } from '../public/public.module';
import { ReaderModule } from '../reader/reader.module';
import { StorageModule } from '../storage/storage.module';
import { WalletsModule } from '../wallets/wallets.module';
import { ChapterContentController } from './chapter-content.controller';
import { ChapterContentService } from './chapter-content.service';
import { ChaptersController } from './chapters.controller';
import { ChaptersService } from './chapters.service';
import { PdfProcessingService } from './pdf-processing.service';
import { TextProcessingService } from './text-processing.service';

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
  providers: [
    ChaptersService,
    ChapterContentService,
    PdfProcessingService,
    TextProcessingService,
    RecommendationService,
  ],
  controllers: [ChaptersController, ChapterContentController],
})
export class ChaptersModule {}
