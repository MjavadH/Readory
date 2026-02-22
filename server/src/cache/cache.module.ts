import { Global, Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { CacheManager } from './cache.manager';
import { ChapterCache } from './chapter-cache.service';
import { UserAccessCache } from './user-access-cache.service';

@Global()
@Module({
    imports: [RedisModule],
    providers: [CacheManager, ChapterCache, UserAccessCache],
    exports: [CacheManager, ChapterCache, UserAccessCache],
})
export class CacheModule {}
