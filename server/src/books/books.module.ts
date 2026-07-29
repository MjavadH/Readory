import { Module } from '@nestjs/common';
import { BooksService } from './books.service';
import { BooksController } from './books.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { WalletsModule } from '../wallets/wallets.module';
import { PublicModule } from '../public/public.module';
import { RecommendationService } from './recommendation/recommendation.service';
import { CollectionsModule } from '../collections/collections.module';

@Module({
  imports: [PrismaModule, WalletsModule, PublicModule, CollectionsModule],
  providers: [BooksService, RecommendationService],
  controllers: [BooksController],
  exports: [BooksService],
})
export class BooksModule {}
