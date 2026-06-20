import { Injectable } from '@nestjs/common';
import { CacheManager } from './cache.manager';

@Injectable()
export class ChapterCache {
    private readonly listNamespace = 'chapters:list:v2';
    private readonly listVersionNamespace = 'chapters:list:version';

    constructor(private readonly cacheManager: CacheManager) {}

    async getListVersion(bookId: number): Promise<string> {
        const versionKey = this.cacheManager.buildKey(this.listVersionNamespace, bookId);
        return this.cacheManager.getVersion(versionKey);
    }

    async bumpListVersion(bookId: number): Promise<void> {
        const versionKey = this.cacheManager.buildKey(this.listVersionNamespace, bookId);
        await this.cacheManager.bumpVersion(versionKey);
    }

    buildListKey(params: {
        bookId: number;
        q?: string;
        page: number;
        limit: number;
        path: boolean;
        order: 'asc' | 'desc';
        version: string;
    }): string {
        return this.cacheManager.buildHashedKey(this.listNamespace, params);
    }
}
