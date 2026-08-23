import { Injectable } from '@nestjs/common';
import type { CacheManager } from './cache.manager';

@Injectable()
export class UserAccessCache {
  private readonly namespace = 'user:access:v1';

  constructor(private readonly cacheManager: CacheManager) {}

  buildChapterAccessKey(userId: number, chapterId: number): string {
    return this.cacheManager.buildKey(this.namespace, 'chapter', userId, chapterId);
  }
}
