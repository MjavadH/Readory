import { Module, type OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Meilisearch } from 'meilisearch';
import { PrismaModule } from '../prisma/prisma.module';
import meilisearchConfig from './config/meilisearch.config';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { SearchSyncProcessor } from './search-sync.processor';

@Module({
  imports: [ConfigModule.forFeature(meilisearchConfig), PrismaModule],
  controllers: [SearchController],
  providers: [
    {
      provide: 'MEILISEARCH_CLIENT',
      useFactory: () => {
        const host = process.env.MEILISEARCH_HOST;
        const apiKey = process.env.MEILISEARCH_API_KEY;

        if (!host) {
          throw new Error('MEILISEARCH_URL is not configured');
        }

        if (!apiKey) {
          throw new Error('MEILISEARCH_API_KEY is not configured');
        }

        return new Meilisearch({
          host,
          apiKey,
        });
      },
      inject: [ConfigService],
    },
    SearchService,
    SearchSyncProcessor,
  ],
  exports: [SearchService],
})
export class SearchModule implements OnModuleInit {
  constructor(private readonly searchService: SearchService) {}

  async onModuleInit() {
    await this.searchService.setupIndexes();
  }
}
