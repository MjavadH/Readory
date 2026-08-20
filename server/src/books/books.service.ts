import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CollectionType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CacheManager } from '../cache/cache.manager';
import { PublicService } from '../public/public.service';
import { createHash } from 'crypto';
import { clamp, normalizeQ, normalizeSlug, slugify, toNumber } from '../common';
import { CollectionsService } from '../collections/collections.service';
import {
  RELATED_EXPONENTIAL_DECAY_LAMBDA,
  RELATED_FRESHNESS_WEIGHT,
  RELATED_GENRE_WEIGHT,
  RELATED_POPULARITY_WEIGHT,
  RELATED_TYPE_WEIGHT,
} from './recommendation/recommendation.constants';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { DomainEventType, PublicationStatus } from '@readory/shared';
import { OutboxService } from '../outbox/outbox.service';
import { BrowseSort } from './dto/base-browse.dto';
import { SearchService } from '../search/search.service';
import { BrowseBooksDto } from './dto/browse-books.dto';

const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
type StatusFilter = 'all' | 'published' | 'draft' | 'featured';

@Injectable()
export class BooksService {
  constructor(
    private prisma: PrismaService,
    private publicService: PublicService,
    private readonly cacheManager: CacheManager,
    private readonly collectionsService: CollectionsService,
    private readonly outbox: OutboxService,
    private readonly searchService: SearchService,
  ) {}

  private readonly CACHE_KEY_BROWSE_DEFAULT = 'books:browse:default';
  private readonly CACHE_KEY_STATE_BOOK = 'stats:books';
  private readonly CACHE_KEY_STATE_CHAPTERS_COUNT = 'stats:chapters:count';
  private readonly CACHE_KEY_GENRES_ALL = 'genres:all';
  private readonly CACHE_KEY_RECOMMENDATION_VERSION = 'books:recommendation:version';

  async browse(args: BrowseBooksDto) {
    type FetchedBookType = Prisma.BookGetPayload<{
      select: {
        id: true;
        title: true;
        coverImage: true;
        type: { select: { name: true; slug: true } };
        contributors: { select: { role: true; contributor: { select: { name: true } } } };
        ratingAvg: true;
        ratingCount: true;
        genres: { select: { genre: { select: { name: true; slug: true } } } };
        isFeatured: true;
        status: true;
        chapterCount: true;
        updatedAt: true;
        lastContentUpdate: true;
      };
    }>;

    // Define hydrated item interface for frontend
    interface BrowseItem {
      id: number;
      title: string;
      coverImage: string | null;
      type: { name: string; slug: string };
      contributors: string | null;
      ratingAvg: number;
      ratingCount: number;
      genres: { name: string; slug: string }[];
      isFeatured: boolean;
      status: string;
      chapterCount: number;
      updatedAt: string;
    }

    const isDefaultView =
      (!args.types || args.types.length === 0) &&
      (!args.genres || args.genres.length === 0) &&
      (!args.q || args.q.trim() === '') &&
      !args.cursor &&
      (args.sort === 'recently_updated' || !args.sort);

    if (isDefaultView) {
      const cached = await this.cacheManager.getString(this.CACHE_KEY_BROWSE_DEFAULT);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    const { ids, nextCursor, hasMore } = await this.searchService.browseSearch(args);

    let items: BrowseItem[] = [];

    if (ids.length > 0) {
      const fetchedBooks = (await this.prisma.book.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          title: true,
          coverImage: true,
          type: { select: { name: true, slug: true } },
          contributors: {
            select: { role: true, contributor: { select: { name: true } } },
          },
          ratingAvg: true,
          ratingCount: true,
          genres: {
            select: { genre: { select: { name: true, slug: true } } },
          },
          isFeatured: true,
          status: true,
          chapterCount: true,
          updatedAt: true,
          lastContentUpdate: true,
        },
      })) as FetchedBookType[];

      const bookMap = new Map<number, FetchedBookType>(fetchedBooks.map((b) => [b.id, b]));

      items = ids
        .map((id): BrowseItem | null => {
          const b = bookMap.get(id);
          if (!b) return null;

          const mainContributor =
            b.contributors.find((a) => a.role === 'AUTHOR') || b.contributors[0];

          return {
            id: b.id,
            title: b.title,
            coverImage: b.coverImage,
            type: b.type,
            contributors: mainContributor ? mainContributor.contributor.name : null,
            ratingAvg: Number(b.ratingAvg),
            ratingCount: b.ratingCount,
            genres: b.genres.map((g) => g.genre),
            isFeatured: b.isFeatured,
            status: b.status,
            chapterCount: b.chapterCount,
            updatedAt: (b.lastContentUpdate ?? b.updatedAt).toISOString(),
          };
        })
        .filter((item): item is BrowseItem => item !== null);
    }

    const result = { items, nextCursor, hasMore };

    if (isDefaultView) {
      await this.cacheManager.setString(this.CACHE_KEY_BROWSE_DEFAULT, JSON.stringify(result), 90);
    }

    return result;
  }

  async browseByType(
    typeParam: string,
    args: {
      genres?: string[];
      q?: string;
      sort?: BrowseSort;
      limit?: number;
      cursor?: string;
    },
  ) {
    const typeSlug = slugify(typeParam);
    if (!typeSlug) throw new NotFoundException('book type not found');

    // Cache: type existence (reduces DB hits for invalid slugs)
    const existsKey = `books:browse:booktype:${typeSlug}`;
    const existsCached = await this.cacheManager.getString(existsKey);

    let exists: boolean;
    if (existsCached === '1') {
      exists = true;
    } else if (existsCached === '0') {
      exists = false;
    } else {
      const found = await this.prisma.bookType.findUnique({
        where: { slug: typeSlug, isActive: true },
        select: { id: true },
      });
      exists = Boolean(found);
      await this.cacheManager.setString(existsKey, exists ? '1' : '0', 3600);
    }

    if (!exists) throw new NotFoundException('book type not found');

    // We cache only the first page (no cursor) to avoid huge cache growth.
    const hasCursor = Boolean(args.cursor && args.cursor.trim().length);
    if (!hasCursor) {
      const cacheKey = this.buildTypeBrowseCacheKey(typeSlug, args);
      const cached = await this.cacheManager.getString(cacheKey);
      if (cached) {
        try {
          return JSON.parse(cached) as {
            items: unknown[];
            nextCursor: string | null;
          };
        } catch {
          await this.cacheManager.del(cacheKey);
        }
      }

      const result = await this.browse({
        ...args,
        types: [typeSlug], // force constant type, ignore any client type
      });

      // Short TTL keeps data fresh while cutting DB load heavily.
      await this.cacheManager.setString(cacheKey, JSON.stringify(result), 90);
      return result;
    }

    // Cursor pages: no cache
    return this.browse({
      ...args,
      types: [typeSlug],
    });
  }

  async browseByGenre(
    slugParam: string,
    query: {
      types?: string[];
      q?: string;
      sort?: any;
      limit?: number;
      cursor?: string;
    },
  ) {
    const slug = normalizeSlug(slugParam);
    if (!SAFE_SLUG.test(slug)) throw new NotFoundException('genre not found');

    // Validate type filters (slugs) defensively (prevents abuse)
    const types = (query.types ?? []).map((t) => normalizeSlug(t)).filter(Boolean);

    if (types.length > 10) throw new BadRequestException('too many types');
    if (types.some((t) => !SAFE_SLUG.test(t))) throw new BadRequestException('invalid type slug');

    const q = normalizeQ(query.q);
    const limit = clamp(query.limit ?? 24, 1, 50);
    const sort = query.sort ?? 'recently_updated';
    const cursor = (query.cursor ?? '').trim();

    // Resolve genre (cached)
    const genre = await this.getGenreBySlugCached(slug);
    if (!genre) throw new NotFoundException('genre not found');

    const hasCursor = cursor.length > 0;

    // Cache only first page to prevent cache explosion
    if (!hasCursor) {
      const cacheKey = this.buildGenreBrowseCacheKey(slug, {
        types,
        q,
        sort,
        limit,
      });

      const cached = await this.cacheManager.getString(cacheKey);
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch {
          await this.cacheManager.del(cacheKey);
        }
      }

      const [allGenres, browseRes] = await Promise.all([
        this.getAllGenresCached(),
        this.browse({
          types: types.length ? types : undefined,
          genres: [slug], // single genre constraint
          q,
          sort,
          limit,
          cursor: undefined,
        }),
      ]);

      const response = {
        genre,
        allGenres,
        items: browseRes.items,
        nextCursor: browseRes.nextCursor,
      };

      // Small TTL keeps it fresh, cuts DB load hard
      await this.cacheManager.setString(cacheKey, JSON.stringify(response), 90);
      return response;
    }

    // Cursor pages (no cache)
    const [allGenres, browseRes] = await Promise.all([
      this.getAllGenresCached(),
      this.browse({
        types: types.length ? types : undefined,
        genres: [slug],
        q,
        sort,
        limit,
        cursor,
      }),
    ]);

    return {
      genre,
      allGenres,
      items: browseRes.items,
      nextCursor: browseRes.nextCursor,
    };
  }

  private buildTypeBrowseCacheKey(
    typeSlug: string,
    args: { genres?: string[]; q?: string; sort?: BrowseSort; limit?: number },
  ) {
    const sort = args.sort ?? 'recently_updated';
    const limit = clamp(args.limit ?? 24, 1, 50);
    const q = (args.q ?? '').trim().toLowerCase();

    const genres = (args.genres ?? [])
      .map((g) => g.trim().toLowerCase())
      .filter(Boolean)
      .sort();

    const fingerprint = createHash('sha256')
      .update(JSON.stringify({ typeSlug, sort, limit, q, genres }))
      .digest('hex')
      .slice(0, 24);

    return `books:type:browse:v1:${typeSlug}:${fingerprint}`;
  }

  private async getAllGenresCached() {
    const cached = await this.cacheManager.getString(this.CACHE_KEY_GENRES_ALL);
    if (cached) {
      try {
        return JSON.parse(cached) as Array<{
          id: number;
          name: string;
          slug: string;
          iconKey: string | null;
        }>;
      } catch {
        await this.cacheManager.del(this.CACHE_KEY_GENRES_ALL);
      }
    }

    const allGenres = await this.prisma.genre.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true, iconKey: true },
    });

    await this.cacheManager.setString(this.CACHE_KEY_GENRES_ALL, JSON.stringify(allGenres), 3600);
    return allGenres;
  }

  private async getGenreBySlugCached(slug: string) {
    const key = `genre:slug:${slug}`;
    const cached = await this.cacheManager.getString(key);
    if (cached) {
      try {
        return JSON.parse(cached) as {
          id: number;
          name: string;
          slug: string;
          iconKey: string | null;
        };
      } catch {
        await this.cacheManager.del(key);
      }
    }

    const genre = await this.prisma.genre.findUnique({
      where: { slug },
      select: { id: true, name: true, slug: true, iconKey: true },
    });

    if (!genre) return null;

    await this.cacheManager.setString(key, JSON.stringify(genre), 3600);
    return genre;
  }

  private buildGenreBrowseCacheKey(
    genreSlug: string,
    args: { types?: string[]; q?: string; sort?: string; limit?: number },
  ) {
    const sort = (args.sort ?? 'recently_updated').toString();
    const limit = clamp(args.limit ?? 24, 1, 50);
    const q = (args.q ?? '').trim().toLowerCase();

    const types = (args.types ?? [])
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
      .sort();

    const fp = createHash('sha256')
      .update(JSON.stringify({ genreSlug, sort, limit, q, types }))
      .digest('hex')
      .slice(0, 24);

    return `books:genre:browse:${genreSlug}:${fp}`;
  }

  // List all books
  async listAll(args: { page: number; limit: number; q?: string; status: StatusFilter }) {
    const page = clamp(args.page, 1, 10_000);
    const limit = clamp(args.limit, 1, 50);
    const q = normalizeQ(args.q);
    const skip = (page - 1) * limit;

    // Fetch global dashboard stats independently
    const globalStatsPromise = this.prisma.$transaction([
      this.prisma.book.count(),
      this.prisma.book.count({ where: { publishStatus: PublicationStatus.PUBLISHED } }),
      this.prisma.book.count({ where: { publishStatus: PublicationStatus.DRAFT } }),
      this.prisma.book.count({ where: { isFeatured: true } }),
    ]);

    let books: any[] = [];
    let filteredTotal: number;

    if (q) {
      const searchResult = await this.searchService.adminSearchBookIds(q, {
        status: args.status,
        offset: skip,
        limit,
      });

      filteredTotal = searchResult.total;

      if (searchResult.ids.length > 0) {
        const fetchedBooks = await this.prisma.book.findMany({
          where: { id: { in: searchResult.ids } },
          select: {
            id: true,
            title: true,
            originalTitle: true,
            alternativeTitles: true,
            contributors: {
              select: { role: true, contributor: { select: { name: true } } },
            },
            coverImage: true,
            publishStatus: true,
            isFeatured: true,
            status: true,
            ageRating: true,
            publicationYear: true,
            chapterCount: true,
            lastContentUpdate: true,
            ratingAvg: true,
            ratingCount: true,
            updatedAt: true,
            genres: {
              include: { genre: { select: { id: true, name: true, slug: true } } },
              take: 3,
            },
            type: { select: { name: true } },
          },
        });

        const bookMap = new Map(fetchedBooks.map((b) => [b.id, b]));
        books = searchResult.ids.map((id) => bookMap.get(id)).filter(Boolean);
      }
    } else {
      // Fallback to Prisma chronological order when no search query
      const where: Prisma.BookWhereInput = {};
      if (args.status === 'published') where.publishStatus = PublicationStatus.PUBLISHED;
      else if (args.status === 'draft') where.publishStatus = PublicationStatus.DRAFT;
      else if (args.status === 'featured') where.isFeatured = true;

      filteredTotal = await this.prisma.book.count({ where });

      books = await this.prisma.book.findMany({
        where,
        orderBy: { lastContentUpdate: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          originalTitle: true,
          alternativeTitles: true,
          contributors: {
            select: { role: true, contributor: { select: { name: true } } },
          },
          coverImage: true,
          publishStatus: true,
          isFeatured: true,
          status: true,
          ageRating: true,
          publicationYear: true,
          chapterCount: true,
          lastContentUpdate: true,
          ratingAvg: true,
          ratingCount: true,
          updatedAt: true,
          genres: {
            include: { genre: { select: { id: true, name: true, slug: true } } },
            take: 3,
          },
          type: { select: { name: true } },
        },
      });
    }

    const [total, published, drafts, featured] = await globalStatsPromise;

    const formattedBooks = books.map((b) => {
      const mainContributor =
        b.contributors.find((a: any) => a.role === 'AUTHOR') || b.contributors[0];
      return {
        ...b,
        contributors: mainContributor ? mainContributor.contributor.name : null,
      };
    });

    return {
      books: formattedBooks,
      hasMore: skip + books.length < filteredTotal,
      stats: { total, Published: published, Drafts: drafts, Featured: featured },
      page,
      limit,
    };
  }

  async getRelatedBooks(bookId: number, limitInput: number) {
    const limit = clamp(limitInput || 12, 1, 24);

    const version = await this.cacheManager.getVersion(this.CACHE_KEY_RECOMMENDATION_VERSION);

    const cacheKey = this.buildRelatedBooksCacheKey(version, bookId, limit);

    return this.cacheManager.getOrSet(
      cacheKey,
      {
        ttlSeconds: 1800,
        earlyRefreshWindowSeconds: 300,
      },
      async () => {
        const sourceBook = await this.prisma.book.findUnique({
          where: { id: bookId, publishStatus: PublicationStatus.PUBLISHED },
          select: {
            id: true,
            typeId: true,
            genres: { select: { genreId: true } },
          },
        });

        if (!sourceBook) {
          throw new NotFoundException('book not found');
        }

        const genreIds = sourceBook.genres.map((g) => g.genreId);
        const safeGenreIds = genreIds.length > 0 ? genreIds : [-1];

        const rankedCandidates = await this.prisma.$queryRaw<{ id: number; score: number }[]>`
            WITH SourceGenres AS (
              SELECT unnest(ARRAY[${Prisma.join(safeGenreIds)}]::integer[]) AS genre_id
            ),
                 CandidateData AS (
                   SELECT
                     b.id,
                     b."typeId",
                     b."popularityScore"::float,
                     COALESCE(b."lastContentUpdate", b."updatedAt") AS "contentDate",
                     (
                       SELECT COUNT(*)::float
                       FROM "BookGenre" bg
                       WHERE bg."bookId" = b.id AND bg."genreId" IN (SELECT genre_id FROM SourceGenres)
                     ) AS intersection_count,
                     (
                       SELECT COUNT(*)::float
                       FROM "BookGenre" bg
                       WHERE bg."bookId" = b.id
                     ) AS target_genre_count
                   FROM "Book" b
                   WHERE b."publishStatus" = ${PublicationStatus.PUBLISHED}
                     AND b.id != ${bookId}::integer
              AND (
              b."typeId" = ${sourceBook.typeId}::integer
              OR EXISTS (
              SELECT 1 FROM "BookGenre" bg
              WHERE bg."bookId" = b.id AND bg."genreId" IN (SELECT genre_id FROM SourceGenres)
              )
              )
              )
            SELECT
              id,
              (
                -- Jaccard Similarity
                (intersection_count / NULLIF(${genreIds.length}::float + target_genre_count - intersection_count, 0)) * ${RELATED_GENRE_WEIGHT}::float

              -- Type Match Weight
              + (CASE WHEN "typeId" = ${sourceBook.typeId}::integer THEN ${RELATED_TYPE_WEIGHT}::float ELSE 0 END)

              -- Popularity Weight
              + ("popularityScore" / 100.0) * ${RELATED_POPULARITY_WEIGHT}::float

              -- Exponential Freshness Decay Weight
              + (EXP(-${RELATED_EXPONENTIAL_DECAY_LAMBDA}::float * (EXTRACT(EPOCH FROM (NOW() - "contentDate")) / 86400.0))) * ${RELATED_FRESHNESS_WEIGHT}::float
              ) AS "score"
            FROM CandidateData
            ORDER BY "score" DESC
              LIMIT ${limit}::integer;
          `;

        if (!rankedCandidates.length) {
          return { items: [], generatedAt: new Date().toISOString() };
        }

        const candidateIds = rankedCandidates.map((c) => c.id);
        const scoreMap = new Map(rankedCandidates.map((c) => [c.id, c.score]));

        const fullBooks = await this.prisma.book.findMany({
          where: { id: { in: candidateIds } },
          select: {
            id: true,
            title: true,
            coverImage: true,
            contributors: {
              select: {
                role: true,
                contributor: { select: { name: true } },
              },
            },
            type: { select: { name: true, slug: true } },
            ratingAvg: true,
            ratingCount: true,
            popularityScore: true,
            isFeatured: true,
            chapterCount: true,
            updatedAt: true,
            lastContentUpdate: true,
            genres: {
              select: {
                genre: { select: { id: true, name: true, slug: true } },
              },
            },
          },
        });

        const items = fullBooks
          .map((book) => {
            const mainContributor =
              book.contributors.find((a) => a.role === 'AUTHOR') || book.contributors[0];
            return {
              id: book.id,
              title: book.title,
              coverImage: book.coverImage,
              contributors: mainContributor ? mainContributor.contributor.name : null,
              type: book.type,
              ratingAvg: Number(toNumber(book.ratingAvg).toFixed(2)),
              ratingCount: book.ratingCount,
              popularityScore: Number(toNumber(book.popularityScore).toFixed(4)),
              genres: book.genres.map((g) => g.genre).sort((a, b) => a.name.localeCompare(b.name)),
              chapterCount: book.chapterCount,
              isFeatured: book.isFeatured,
              updatedAt: (book.lastContentUpdate ?? book.updatedAt).toISOString(),
              score: Number(scoreMap.get(book.id)?.toFixed(4) || 0),
            };
          })
          .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return b.popularityScore - a.popularityScore; // Tie-breaker
          });

        return {
          items,
          generatedAt: new Date().toISOString(),
        };
      },
    );
  }

  async getPopularBooks(limitInput: number) {
    const limit = clamp(limitInput || 12, 1, 50);

    const version = await this.cacheManager.getVersion(this.CACHE_KEY_RECOMMENDATION_VERSION);
    const cacheKey = this.cacheManager.buildKey('books:popular', version, limit);

    return this.cacheManager.getOrSet(
      cacheKey,
      {
        ttlSeconds: 1800,
        earlyRefreshWindowSeconds: 300,
      },
      async () => {
        const books = await this.prisma.book.findMany({
          where: { publishStatus: PublicationStatus.PUBLISHED },
          orderBy: [{ popularityScore: 'desc' }, { ratingCount: 'desc' }, { id: 'desc' }],
          take: limit,
          select: {
            id: true,
            title: true,
            coverImage: true,
            ratingAvg: true,
            ratingCount: true,
            chapterCount: true,
            type: { select: { id: true, name: true, slug: true } },
            contributors: {
              select: {
                role: true,
                contributor: { select: { name: true } },
              },
            },
            genres: {
              select: { genre: { select: { id: true, name: true, slug: true } } },
            },
          },
        });

        return books.map((b) => {
          const mainContributor =
            b.contributors.find((a) => a.role === 'AUTHOR') || b.contributors[0];
          return {
            id: b.id,
            title: b.title,
            coverImage: b.coverImage,
            type: b.type,
            ratingAvg: Number(toNumber(b.ratingAvg).toFixed(2)),
            ratingCount: b.ratingCount,
            chapterCount: b.chapterCount,
            genres: b.genres.map((g) => g.genre),
            contributors: mainContributor ? mainContributor.contributor.name : null,
          };
        });
      },
    );
  }

  // Get book
  async findById(id: number) {
    const book = await this.prisma.book.findUnique({
      where: { id, publishStatus: PublicationStatus.PUBLISHED },
      select: {
        id: true,
        title: true,
        originalTitle: true,
        alternativeTitles: true,
        contributors: {
          select: {
            role: true,
            contributor: { select: { id: true, name: true, slug: true } },
          },
        },
        description: true,
        coverImage: true,
        isFeatured: true,
        status: true,
        ageRating: true,
        publicationYear: true,
        chapterCount: true,
        lastContentUpdate: true,
        ratingAvg: true,
        ratingCount: true,
        updatedAt: true,
        genres: {
          select: {
            genre: {
              select: { id: true, name: true, slug: true, iconKey: true },
            },
          },
        },
        type: { select: { name: true, slug: true, iconKey: true } },
      },
    });

    if (!book) throw new NotFoundException('book not found');

    return {
      ...book,
      genres: book.genres.map((g) => g.genre),
      contributors: book.contributors.map((a) => ({
        id: a.contributor.id,
        name: a.contributor.name,
        slug: a.contributor.slug,
        role: a.role,
      })),
    };
  }

  // Get full book details
  async fullBookDetails(id: number) {
    const book = await this.prisma.book.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        originalTitle: true,
        alternativeTitles: true,
        contributors: {
          select: {
            role: true,
            contributor: { select: { id: true, name: true, slug: true } },
          },
        },
        description: true,
        coverImage: true,
        isFeatured: true,
        status: true,
        ageRating: true,
        publicationYear: true,
        chapterCount: true,
        lastContentUpdate: true,
        publishStatus: true,
        ratingAvg: true,
        ratingCount: true,
        updatedAt: true,
        createdAt: true,
        genres: {
          select: {
            genre: {
              select: { id: true, name: true, slug: true, iconKey: true },
            },
          },
        },
        type: { select: { id: true, name: true, slug: true, iconKey: true } },
      },
    });

    if (!book) throw new NotFoundException('book not found');

    return {
      ...book,
      genres: book.genres.map((g) => g.genre),
      contributors: book.contributors.map((a) => ({
        id: a.contributor.id,
        name: a.contributor.name,
        slug: a.contributor.slug,
        role: a.role,
      })),
    };
  }

  async getViewerState(bookId: number, userId: number) {
    const bookExists = await this.prisma.book.findUnique({
      where: { id: bookId },
      select: { id: true },
    });
    if (!bookExists) throw new NotFoundException('Book not found');

    const [myRating, purchased, favorite] = await Promise.all([
      this.prisma.bookRating.findUnique({
        where: { userId_bookId: { userId, bookId } },
        select: { rating: true },
      }),
      this.prisma.accessRecord.findMany({
        where: { userId, chapter: { bookId } },
        select: { chapterId: true },
      }),
      this.prisma.collectionItem.findFirst({
        where: { bookId, collection: { ownerId: userId, type: CollectionType.FAVORITES } },
        select: { id: true },
      }),
    ]);

    return {
      myRating: myRating?.rating ?? null,
      purchasedChapterIds: purchased
        .map((row) => row.chapterId)
        .filter((chapterId): chapterId is number => typeof chapterId === 'number'),
      isFavorited: !!favorite,
    };
  }

  // Admin: create a new book
  async create(data: CreateBookDto) {
    const { genreIds, typeId, contributors, ...rest } = data;

    const foundType = await this.prisma.bookType.findUnique({
      where: { id: typeId },
      select: { id: true },
    });

    if (!foundType) {
      throw new BadRequestException('book type not found');
    }

    const payload: Prisma.BookCreateInput = {
      title: rest.title,
      type: { connect: { id: foundType.id } },
      genres: {
        create: genreIds.map((genreId) => ({
          genre: { connect: { id: genreId } },
        })),
      },
    };

    if (rest.originalTitle !== undefined) payload.originalTitle = rest.originalTitle;
    if (rest.alternativeTitles !== undefined) payload.alternativeTitles = rest.alternativeTitles;
    if (rest.description !== undefined) payload.description = rest.description;
    if (rest.coverImage !== undefined) {
      payload.coverMedia = { connect: { code: rest.coverImage } };
    }
    if (rest.publishStatus !== undefined) payload.publishStatus = rest.publishStatus;
    if (rest.isFeatured !== undefined) payload.isFeatured = rest.isFeatured;
    if (rest.status !== undefined) payload.status = rest.status;
    if (rest.ageRating !== undefined) payload.ageRating = rest.ageRating;
    if (rest.publicationYear !== undefined) payload.publicationYear = rest.publicationYear;

    if (contributors && contributors.length > 0) {
      payload.contributors = {
        create: contributors.map((a) => ({
          contributor: { connect: { id: a.contributorId } },
          role: a.role,
        })),
      };
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const book = await tx.book.create({
        data: payload,
        include: {
          coverMedia: { select: { code: true, filename: true } },
          genres: {
            select: { genre: { select: { id: true, name: true, slug: true } } },
          },
          type: { select: { id: true, name: true, slug: true } },
          contributors: {
            select: { role: true, contributor: { select: { id: true, name: true } } },
          },
        },
      });

      if (book.publishStatus === PublicationStatus.PUBLISHED) {
        await this.outbox.create(tx, {
          type: DomainEventType.BOOK_PUBLISHED,
          version: 1,
          aggregateType: 'Book',
          aggregateId: String(book.id),
          payload: {
            bookId: book.id,
            title: book.title,
            bookType: book.type.slug,
            coverImage: book.coverImage,
            publishedAt: new Date().toISOString(),
          },
        });
      }

      if (contributors && contributors.length > 0) {
        await tx.contributor.updateMany({
          where: { id: { in: contributors.map((a) => a.contributorId) } },
          data: { bookCount: { increment: 1 } },
        });
      }

      return book;
    });

    await this.publicService.clearGenresPageCache();
    await this.invalidateCache();
    return created;
  }

  // Admin: update a book
  async update(id: number, data: UpdateBookDto) {
    const { genreIds, typeId, coverImage, contributors, ...rest } = data;

    const currentBook = await this.prisma.book.findUnique({
      where: { id },
      select: {
        title: true,
        publishStatus: true,
        contributors: { select: { contributorId: true } },
      },
    });

    if (!currentBook) throw new NotFoundException('book not found');

    let typeConnect: Prisma.BookUpdateInput = {};
    if (typeId !== undefined) typeConnect = { type: { connect: { id: typeId } } };

    const updateData: Prisma.BookUpdateInput = {
      ...rest,
      ...(coverImage !== undefined
        ? {
            coverMedia: coverImage ? { connect: { code: coverImage } } : { disconnect: true },
          }
        : {}),
      ...typeConnect,
      ...(genreIds
        ? {
            genres: {
              deleteMany: {},
              create: genreIds.map((genreId) => ({
                genre: { connect: { id: genreId } },
              })),
            },
          }
        : {}),
    };

    let addedIds: number[] = [];
    let removedIds: number[] = [];

    if (contributors !== undefined) {
      const currentContributorIds = currentBook.contributors.map((a) => a.contributorId);
      const newContributorIds = contributors.map((a) => a.contributorId);

      addedIds = newContributorIds.filter((id) => !currentContributorIds.includes(id));
      removedIds = currentContributorIds.filter((id) => !newContributorIds.includes(id));

      updateData.contributors = {
        deleteMany: {},
        create: contributors.map((a) => ({
          contributor: { connect: { id: a.contributorId } },
          role: a.role,
        })),
      };
    }

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        if (removedIds.length > 0) {
          await tx.contributor.updateMany({
            where: { id: { in: removedIds } },
            data: { bookCount: { decrement: 1 } },
          });
        }

        if (addedIds.length > 0) {
          await tx.contributor.updateMany({
            where: { id: { in: addedIds } },
            data: { bookCount: { increment: 1 } },
          });
        }

        const updatedBook = await tx.book.update({
          where: { id },
          data: updateData,
          include: {
            coverMedia: { select: { code: true, filename: true } },
            genres: {
              select: { genre: { select: { id: true, name: true, slug: true } } },
            },
            type: { select: { id: true, name: true, slug: true } },
            contributors: {
              select: { role: true, contributor: { select: { id: true, name: true } } },
            },
          },
        });
        const wasPublished = currentBook.publishStatus === PublicationStatus.PUBLISHED;
        const isPublished = updatedBook.publishStatus === PublicationStatus.PUBLISHED;

        if (!wasPublished && isPublished) {
          await this.outbox.create(tx, {
            type: DomainEventType.BOOK_PUBLISHED,
            version: 1,
            aggregateType: 'Book',
            aggregateId: String(updatedBook.id),
            payload: {
              bookId: updatedBook.id,
              title: updatedBook.title,
              bookType: updatedBook.type.slug,
              coverImage: updatedBook.coverImage,
              publishedAt: new Date().toISOString(),
            },
          });
        }

        await this.outbox.create(tx, {
          type: DomainEventType.BOOK_UPDATED,
          version: 1,
          aggregateType: 'Book',
          aggregateId: String(updatedBook.id),
          payload: {
            bookId: updatedBook.id,
            title: updatedBook.title,
            bookType: updatedBook.type.slug,
            genres: updatedBook.genres.map((item) => item.genre.slug),
            status: updatedBook.status,
            trendScore: Number(updatedBook.trendScore ?? 0),
            popularityScore: Number(updatedBook.popularityScore ?? 0),
            coverImage: updatedBook.coverImage,
            updatedAt: (updatedBook.lastContentUpdate ?? updatedBook.updatedAt).toISOString(),
          },
        });

        return updatedBook;
      });

      await this.publicService.clearGenresPageCache();
      await this.invalidateCache();
      return updated;
    } catch (err: any) {
      if (err?.code === 'P2025') throw new NotFoundException('book not found');
      throw err;
    }
  }

  async rateBook(userId: number, bookId: number, rating: number) {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new BadRequestException('invalid rating');
    }

    const book = await this.prisma.book.findUnique({
      where: { id: bookId },
      select: { id: true, updatedAt: true },
    });

    if (!book) {
      throw new NotFoundException('book not found');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.bookRating.upsert({
        where: { userId_bookId: { userId, bookId } },
        create: { userId, bookId, rating },
        update: { rating },
      });

      const aggregate = await tx.bookRating.aggregate({
        where: { bookId },
        _avg: { rating: true },
        _count: { rating: true },
      });

      const ratingAvg = Number((aggregate._avg.rating ?? 0).toFixed(2));
      const ratingCount = aggregate._count.rating;

      await tx.book.update({
        where: { id: bookId },
        data: {
          ratingAvg: new Prisma.Decimal(ratingAvg),
          ratingCount,
          updatedAt: book.updatedAt,
        },
      });

      return {
        rating,
        ratingAvg,
        ratingCount,
      };
    });

    await this.publicService.clearHomeCache();

    await this.cacheManager.bumpVersion(this.CACHE_KEY_RECOMMENDATION_VERSION);

    return result;
  }

  async deleteById(id: number) {
    const record = await this.prisma.book.findUnique({
      where: { id },
      select: {
        title: true,
        publishStatus: true,
        contributors: { select: { contributorId: true } },
      },
    });

    if (!record) throw new NotFoundException('book not found');

    await this.prisma.$transaction(async (tx) => {
      const contributorIds = record.contributors.map((a) => a.contributorId);
      if (contributorIds.length > 0) {
        await tx.contributor.updateMany({
          where: { id: { in: contributorIds } },
          data: { bookCount: { decrement: 1 } },
        });
      }

      const collectionCounts = await tx.collectionItem.groupBy({
        by: ['collectionId'],
        where: { bookId: id },
        _count: { _all: true },
      });

      await this.outbox.create(tx, {
        type: DomainEventType.BOOK_DELETED,
        version: 1,
        aggregateType: 'Book',
        aggregateId: String(id),
        payload: {
          bookId: id,
        },
      });

      await tx.book.delete({ where: { id } });

      for (const row of collectionCounts) {
        await tx.collection.update({
          where: { id: row.collectionId },
          data: { bookCount: { decrement: row._count._all } },
        });
      }
    });

    await this.invalidateCache();
    return { id, deleted: true };
  }

  async toggleFavorite(userId: number, bookId: number) {
    const bookExists = await this.prisma.book.findUnique({
      where: { id: bookId },
      select: { id: true },
    });

    if (!bookExists) {
      throw new NotFoundException('book not found');
    }

    const collection = await this.collectionsService.ensureFavoritesCollection(userId);

    const result = await this.prisma.$transaction(async (tx) => {
      await this.lockCollection(tx, collection.id);

      const existing = await tx.collectionItem.findUnique({
        where: {
          collectionId_bookId: {
            collectionId: collection.id,
            bookId,
          },
        },
      });

      if (existing) {
        await tx.collectionItem.delete({ where: { id: existing.id } });
        await tx.collection.update({
          where: { id: collection.id },
          data: { bookCount: { decrement: 1 } },
        });
        await tx.book.update({ where: { id: bookId }, data: { favoriteCount: { decrement: 1 } } });

        return {
          favorited: false,
        };
      }

      const position = await this.nextItemPosition(tx, collection.id);
      await tx.collectionItem.create({
        data: {
          collectionId: collection.id,
          bookId,
          position,
        },
      });
      await tx.collection.update({
        where: { id: collection.id },
        data: { bookCount: { increment: 1 } },
      });
      await tx.book.update({ where: { id: bookId }, data: { favoriteCount: { increment: 1 } } });

      return {
        favorited: true,
      };
    });

    await this.publicService.clearHomeCache();

    await this.cacheManager.bumpVersion(this.CACHE_KEY_RECOMMENDATION_VERSION);

    return result;
  }

  async getFavorites(userId: number, args: { page: number; limit: number }) {
    const page = clamp(args.page, 1, 10_000);
    const limit = clamp(args.limit, 1, 50);
    const skip = (page - 1) * limit;

    const collection = await this.collectionsService.ensureFavoritesCollection(userId);

    const favorites = await this.prisma.collectionItem.findMany({
      where: { collectionId: collection.id },
      orderBy: { position: 'asc' },
      skip,
      take: limit,
      select: {
        book: {
          select: {
            id: true,
            title: true,
            contributors: {
              select: {
                role: true,
                contributor: { select: { name: true } },
              },
            },
            coverImage: true,
            ratingAvg: true,
            ratingCount: true,
            updatedAt: true,
            type: {
              select: {
                name: true,
                slug: true,
              },
            },
            chapterCount: true,
            genres: {
              select: { genre: { select: { name: true, slug: true } } },
            },
          },
        },
      },
    });

    const data = favorites.map(({ book }) => {
      const mainContributor =
        book.contributors.find((a) => a.role === 'AUTHOR') || book.contributors[0];
      return {
        id: book.id,
        title: book.title,
        contributors: mainContributor ? mainContributor.contributor.name : null,
        coverImage: book.coverImage,
        ratingAvg: Number(toNumber(book.ratingAvg).toFixed(2)),
        ratingCount: book.ratingCount,
        updatedAt: book.updatedAt.toISOString(),
        type: book.type,
        chapterCount: book.chapterCount,
        genres: book.genres.map((g) => g.genre),
      };
    });

    return {
      data,
      total: collection.bookCount,
      page,
      lastPage: Math.max(1, Math.ceil(collection.bookCount / limit)),
    };
  }

  private async lockCollection(tx: Prisma.TransactionClient, collectionId: number) {
    await tx.$queryRaw`SELECT id FROM "Collection" WHERE id = ${collectionId} FOR UPDATE`;
  }

  private async nextItemPosition(tx: Prisma.TransactionClient, collectionId: number) {
    const aggregate = await tx.collectionItem.aggregate({
      where: { collectionId },
      _max: { position: true },
    });
    return (aggregate._max.position ?? 0) + 1;
  }

  private buildRelatedBooksCacheKey(version: string, bookId: number, limit: number) {
    return this.cacheManager.buildKey('books:related', version, bookId, limit);
  }

  private async invalidateCache() {
    await this.cacheManager.del(this.CACHE_KEY_BROWSE_DEFAULT);
    await this.cacheManager.del(this.CACHE_KEY_STATE_BOOK);
    await this.cacheManager.del(this.CACHE_KEY_STATE_CHAPTERS_COUNT);
    await this.cacheManager.del(this.CACHE_KEY_GENRES_ALL);
    await this.cacheManager.bumpVersion(this.CACHE_KEY_RECOMMENDATION_VERSION);
    await this.publicService.clearHomeCache();
  }
}
