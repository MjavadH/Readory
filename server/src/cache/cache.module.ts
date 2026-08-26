import { Global, Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { CacheManager } from './cache.manager';
import { ChapterCache } from './chapter-cache.service';

@Global()
@Module({
  imports: [RedisModule],
  providers: [CacheManager, ChapterCache],
  exports: [CacheManager, ChapterCache],
})
export class CacheModule {}
