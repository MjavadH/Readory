import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma, PublicationStatus } from '@prisma/client';
import { Index, Meilisearch } from 'meilisearch';
import { normalizeAndValidateSlug } from '../common';
import { PrismaService } from '../prisma/prisma.service';
import { SearchQueryDto } from './dto/search-query.dto';

export interface BookSearchDocument {
  id: number;
  title: string;
  originalTitle: string | null;
  alternativeTitles: string[];
  coverImage: string | null;
  bookTypeSlug: string;
  genreSlugs: string[];
  publishStatus: PublicationStatus | string;
  trendScore: number;
  popularityScore: number;
  createdAt: number;
  lastContentUpdate: number;
  typeIsActive: boolean;
  status: string;
  ageRating: string | null;
  isFeatured: boolean;
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private bookIndex: Index<BookSearchDocument>;
  private fullSyncRunning = false;

  constructor(
    @Inject('MEILISEARCH_CLIENT') private readonly client: Meilisearch,
    private readonly prisma: PrismaService,
  ) {
    this.bookIndex = this.client.index('books');
  }

  private buildSlugFilter(attribute: string, values: string[], operator: 'OR' | 'AND'): string {
    const normalizedValues = values.map(normalizeAndValidateSlug);

    return `(${normalizedValues
      .map((value) => `${attribute} = "${value}"`)
      .join(` ${operator} `)})`;
  }

  async setupIndexes() {
    try {
      await this.bookIndex.updateFilterableAttributes([
        'bookTypeSlug',
        'genreSlugs',
        'publishStatus',
        'typeIsActive',
        'status',
        'ageRating',
        'isFeatured',
      ]);
      await this.bookIndex.updateSortableAttributes([
        'trendScore',
        'popularityScore',
        'createdAt',
        'lastContentUpdate',
        'id',
      ]);
      await this.bookIndex.updateSearchableAttributes([
        'title',
        'originalTitle',
        'alternativeTitles',
      ]);
      await this.bookIndex.updateTypoTolerance({
        minWordSizeForTypos: { oneTypo: 4, twoTypos: 8 },
      });

      await this.bookIndex.updatePagination({ maxTotalHits: 100000 });
      this.logger.log('Meilisearch indexes and settings configured successfully.');
    } catch (error) {
      this.logger.error(
        'Failed to configure Meilisearch settings',
        error instanceof Error ? error.stack : String(error),
      );

      throw error;
    }
  }

  async liveSearch(query: string) {
    const result = await this.bookIndex.search(query, {
      limit: 5,
      filter: ['publishStatus = "PUBLISHED"', 'typeIsActive = true'],
      attributesToRetrieve: ['id', 'title', 'coverImage', 'bookTypeSlug'],
    });
    return result.hits;
  }

  async browseSearch(query: SearchQueryDto) {
    const MAX_SEARCH_OFFSET = 10000;
    const limit = query.limit ? Math.min(Math.max(Number(query.limit), 1), 50) : 18;
    const offset = query.cursor ? Number.parseInt(query.cursor, 10) : 0;

    if (!Number.isSafeInteger(offset) || offset < 0) {
      throw new BadRequestException('Invalid cursor');
    }

    if (offset > MAX_SEARCH_OFFSET) {
      throw new BadRequestException('Pagination limit exceeded.');
    }

    const filterArray: string[] = ['publishStatus = "PUBLISHED"', 'typeIsActive = true'];

    if (query.types?.length) {
      filterArray.push(this.buildSlugFilter('bookTypeSlug', query.types, 'OR'));
    }

    if (query.genres?.length) {
      filterArray.push(this.buildSlugFilter('genreSlugs', query.genres, 'AND'));
    }

    if (query.status?.length) {
      filterArray.push(this.buildSlugFilter('status', query.status, 'OR'));
    }

    if (query.ageRatings?.length) {
      filterArray.push(this.buildSlugFilter('ageRating', query.ageRatings, 'OR'));
    }

    let sortParams = ['lastContentUpdate:desc', 'id:desc'];
    if (query.sort === 'newest') sortParams = ['createdAt:desc', 'id:desc'];
    if (query.sort === 'oldest') sortParams = ['createdAt:asc', 'id:asc'];
    if (query.sort === 'most_popular') sortParams = ['popularityScore:desc', 'id:desc'];
    if (query.sort === 'trend') sortParams = ['trendScore:desc', 'id:desc'];
    if (query.sort === 'recently_updated') sortParams = ['lastContentUpdate:desc', 'id:desc'];

    const result = await this.bookIndex.search(query.q || '', {
      filter: filterArray,
      sort: sortParams,
      limit: limit + 1,
      offset: offset,
      attributesToRetrieve: ['id'],
    });

    const hasMore = result.hits.length > limit;
    const hits = hasMore ? result.hits.slice(0, limit) : result.hits;

    const ids = hits.map((hit) => hit.id);
    const nextCursor = hasMore ? String(offset + limit) : null;

    return { ids, nextCursor, hasMore };
  }

  async adminSearchBookIds(q: string, args: { status: string; offset: number; limit: number }) {
    const filter: string[] = [];

    if (args.status === 'published') {
      filter.push(`publishStatus = "PUBLISHED"`);
    } else if (args.status === 'draft') {
      filter.push(`publishStatus = "DRAFT"`);
    } else if (args.status === 'featured') {
      filter.push(`isFeatured = true`);
    }

    const result = await this.bookIndex.search(q, {
      filter: filter.length > 0 ? filter : undefined,
      offset: args.offset,
      limit: args.limit,
      attributesToRetrieve: ['id'], // Retrieve only IDs for performance
    });

    return {
      ids: result.hits.map((hit) => hit.id),
      total: result.estimatedTotalHits || 0,
    };
  }

  async startFullSync(): Promise<{ started: boolean }> {
    if (this.fullSyncRunning) {
      return { started: false };
    }

    this.fullSyncRunning = true;

    setImmediate(() => {
      void this.syncAllDatabaseBooks()
        .catch((error: unknown) => {
          this.logger.error('Full search synchronization failed', error);
        })
        .finally(() => {
          this.fullSyncRunning = false;
        });
    });

    return { started: true };
  }

  async syncAllDatabaseBooks() {
    let cursorId: number | undefined;
    const batchSize = 500;

    type SyncBookType = Prisma.BookGetPayload<{
      include: {
        type: { select: { name: true; slug: true; isActive: true } };
        genres: { select: { genre: { select: { name: true; slug: true } } } };
        contributors: {
          select: { role: true; contributor: { select: { name: true } } };
        };
      };
    }>;

    while (true) {
      const queryOptions: Prisma.BookFindManyArgs = {
        take: batchSize,
        orderBy: {
          id: 'asc',
        },
        include: {
          type: { select: { name: true, slug: true, isActive: true } },
          genres: { select: { genre: { select: { name: true, slug: true } } } },
          contributors: {
            select: { role: true, contributor: { select: { name: true } } },
          },
        },
      };

      if (cursorId) {
        queryOptions.skip = 1;
        queryOptions.cursor = { id: cursorId };
      }

      const books = (await this.prisma.book.findMany(queryOptions)) as SyncBookType[];

      if (books.length === 0) break;

      try {
        const documents: BookSearchDocument[] = books.map((book: SyncBookType) => {
          return {
            id: book.id,
            title: book.title,
            originalTitle: book.originalTitle,
            alternativeTitles: book.alternativeTitles,
            coverImage: book.coverImage || null,
            bookTypeSlug: book.type.slug,
            genreSlugs: book.genres.map((bg) => bg.genre.slug),
            publishStatus: book.publishStatus,
            trendScore: Number(book.trendScore || 0),
            popularityScore: Number(book.popularityScore || 0),
            createdAt: book.createdAt.getTime(),
            lastContentUpdate: (book.lastContentUpdate ?? book.updatedAt).getTime(),
            typeIsActive: book.type.isActive,
            isFeatured: book.isFeatured,
            status: book.status,
            ageRating: book.ageRating,
          };
        });

        await this.bookIndex.addDocuments(documents);
        cursorId = books[books.length - 1].id;
      } catch (error) {
        this.logger.error(`Batch sync failed at cursor ${cursorId}`, error);
        throw error;
      }
    }

    this.logger.log('Database synchronization completed.');
  }

  async syncBook(document: BookSearchDocument) {
    await this.bookIndex.addDocuments([document]);
  }

  async deleteBook(bookId: number) {
    await this.bookIndex.deleteDocument(bookId);
  }
}
