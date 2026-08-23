import { Module } from '@nestjs/common';
import { CollectionsModule } from '../collections/collections.module';
import { OutboxModule } from '../outbox/outbox.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PublicModule } from '../public/public.module';
import { SearchModule } from '../search/search.module';
import { WalletsModule } from '../wallets/wallets.module';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';
import { RecommendationService } from './recommendation/recommendation.service';

@Module({
  imports: [
    OutboxModule,
    PrismaModule,
    WalletsModule,
    PublicModule,
    SearchModule,
    CollectionsModule,
  ],
  providers: [BooksService, RecommendationService],
  controllers: [BooksController],
  exports: [BooksService],
})
export class BooksModule {}
