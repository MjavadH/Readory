import { Injectable, Inject, Logger } from '@nestjs/common';
import { Meilisearch, Index } from 'meilisearch';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, PublicationStatus } from '@prisma/client';
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
  type: { name: string; slug: string };
  genres: { name: string; slug: string }[];
  contributors: string | null;
  ratingAvg: number;
  ratingCount: number;
  isFeatured: boolean;
  status: string;
  chapterCount: number;
  updatedAt: string;
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private bookIndex: Index<BookSearchDocument>;

  constructor(
    @Inject('MEILISEARCH_CLIENT') private readonly client: Meilisearch,
    private readonly prisma: PrismaService,
  ) {
    this.bookIndex = this.client.index('books');
  }

  async setupIndexes() {
    try {
      await this.bookIndex.updateFilterableAttributes([
        'bookTypeSlug',
        'genreSlugs',
        'publishStatus',
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
      this.logger.log('Meilisearch indexes and settings configured successfully.');
    } catch (error) {
      this.logger.error('Failed to configure Meilisearch settings', error);
    }
  }

  async liveSearch(query: string) {
    const result = await this.bookIndex.search(query, {
      limit: 5,
      filter: ['publishStatus = "published"'],
      attributesToRetrieve: ['id', 'title', 'coverImage', 'bookTypeSlug'],
    });
    return result.hits;
  }

  async browseSearch(query: SearchQueryDto) {
    const limit = query.limit ? Math.min(Math.max(Number(query.limit), 1), 50) : 18;
    const offset = query.cursor ? parseInt(query.cursor, 10) : 0;

    const filterArray: string[] = ['publishStatus = "PUBLISHED"'];

    if (query.types && query.types.length > 0) {
      const typeFilters = query.types.map((t) => `bookTypeSlug = "${t}"`).join(' OR ');
      filterArray.push(`(${typeFilters})`);
    }

    if (query.genres && query.genres.length > 0) {
      const genreFilters = query.genres.map((g) => `genreSlugs = "${g}"`).join(' AND ');
      filterArray.push(`(${genreFilters})`);
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
    });

    const hasMore = result.hits.length > limit;
    const hits = hasMore ? result.hits.slice(0, limit) : result.hits;

    // Map fields directly to preserve frontend compatibility.
    const items = hits.map((hit) => ({
      id: hit.id,
      title: hit.title,
      coverImage: hit.coverImage,
      type: hit.type,
      contributors: hit.contributors,
      ratingAvg: hit.ratingAvg,
      ratingCount: hit.ratingCount,
      genres: hit.genres,
      isFeatured: hit.isFeatured,
      status: hit.status,
      chapterCount: hit.chapterCount,
      updatedAt: hit.updatedAt,
    }));

    const nextCursor = hasMore ? String(offset + limit) : null;

    return { items, nextCursor, hasMore };
  }

  async syncAllDatabaseBooks() {
    let cursorId: number | undefined = undefined;
    const batchSize = 500;

    type SyncBookType = Prisma.BookGetPayload<{
      include: {
        type: { select: { name: true; slug: true } };
        genres: { select: { genre: { select: { name: true; slug: true } } } };
        contributors: {
          select: { role: true; contributor: { select: { name: true } } };
        };
      };
    }>;

    while (true) {
      const queryOptions: Prisma.BookFindManyArgs = {
        take: batchSize,
        include: {
          type: { select: { name: true, slug: true } },
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

      const documents: BookSearchDocument[] = books.map((book: SyncBookType) => {
        const mainContributor =
          book.contributors.find((a) => a.role === 'AUTHOR') || book.contributors[0];

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

          type: book.type,
          genres: book.genres.map((bg) => bg.genre),
          contributors: mainContributor ? mainContributor.contributor.name : null,
          ratingAvg: Number(Number(book.ratingAvg).toFixed(2)),
          ratingCount: book.ratingCount,
          isFeatured: book.isFeatured,
          status: book.status,
          chapterCount: book.chapterCount,
          updatedAt: (book.lastContentUpdate ?? book.updatedAt).toISOString(),
        };
      });

      await this.bookIndex.addDocuments(documents);
      cursorId = books[books.length - 1].id;
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
