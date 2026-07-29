import { Module } from '@nestjs/common';
import { CollectionsController, UserCollectionsController } from './collections.controller';
import { CollectionsService } from './collections.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [PrismaModule, CacheModule],
  controllers: [CollectionsController, UserCollectionsController],
  providers: [CollectionsService],
  exports: [CollectionsService],
})
export class CollectionsModule {}
