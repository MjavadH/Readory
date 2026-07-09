import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CacheManager } from '../cache/cache.manager';
import { PublicService } from '../public/public.service';
import { createHash } from 'crypto';
import {
  clamp,
  toNumber,
  normalizeQ,
  normalizeSlug,
  slugify,
} from '../common';
import {RecommendationService} from "./recommendation/recommendation.service";
import {
  RELATED_EXPONENTIAL_DECAY_LAMBDA, RELATED_FRESHNESS_WEIGHT, RELATED_GENRE_WEIGHT,
  RELATED_POPULARITY_WEIGHT,
  RELATED_TYPE_WEIGHT
} from "./recommendation/recommendation.constants";
import {CreateBookDto} from "./dto/create-book.dto"
import {UpdateBookDto} from "./dto/update-book.dto";
import {PublicationStatus} from "@readory/shared";

const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
type StatusFilter = 'all' | 'published' | 'draft' | 'featured';
type BrowseSort = 'newest' | 'oldest' | 'most_popular' | 'recently_updated';

type CursorPayload = { sort: BrowseSort; id: number; v: string };

function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodeCursor(cursor?: string): CursorPayload | null {
  if (!cursor) return null;
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    const obj = JSON.parse(raw);
    if (
      !obj ||
      typeof obj !== 'object' ||
      typeof obj.id !== 'number' ||
      typeof obj.sort !== 'string'
    )
      return null;
    return obj as CursorPayload;
  } catch {
    return null;
  }
}

@Injectable()
export class BooksService {
  constructor(
    private prisma: PrismaService,
    private publicService: PublicService,
    private readonly cacheManager: CacheManager,
    private readonly recommendationService: RecommendationService,
  ) {}

  private readonly CACHE_KEY_BROWSE_DEFAULT = 'books:browse:default';
  private readonly CACHE_KEY_STATE_BOOK = 'stats:books';
  private readonly CACHE_KEY_STATE_CHAPTERS_COUNT = 'stats:chapters:count';
  private readonly CACHE_KEY_GENRES_ALL = 'genres:all';
  private readonly CACHE_KEY_RECOMMENDATION_VERSION = 'books:recommendation:version';

  async browse(args: {
    types?: string[];
    genres?: string[];
    q?: string;
    sort?: BrowseSort;
    limit?: number;
    cursor?: string;
  }) {
    const isDefaultView =
        (!args.types || args.types.length === 0) &&
        (!args.genres || args.genres.length === 0) &&
        (!args.q || args.q.trim() === '') &&
        !args.cursor &&
        (args.sort === 'recently_updated' || !args.sort);

    if (isDefaultView) {
      const cached = await this.cacheManager.getString(
          this.CACHE_KEY_BROWSE_DEFAULT,
      );
      if (cached) {
        return JSON.parse(cached);
      }
    }

    const limitRaw = Number(args.limit) || 18;
    const limit = clamp(limitRaw, 1, 50);
    const sort: BrowseSort = args.sort ?? 'recently_updated';
    const q = normalizeQ(args.q);

    const where: Prisma.BookWhereInput = {
      publishStatus: PublicationStatus.PUBLISHED,
      type: { isActive: true },
    };

    if (args.types?.length) {
      where.type = { is: { slug: { in: args.types } } };
    }

    if (q) {
      where.OR = this.buildBookSearchWhere(q);
    }

    if (args.genres?.length) {
      const existingAnd = Array.isArray(where.AND)
          ? where.AND
          : where.AND
              ? [where.AND]
              : [];

      where.AND = [
        ...existingAnd,
        ...args.genres.map((slug) => ({
          genres: { some: { genre: { slug } } },
        })),
      ];
    }

    const cursor = decodeCursor(args.cursor);
    const take = limit + 1;

    const { orderBy, seekWhere, cursorValue } = this.buildBrowseSort(
        sort,
        cursor,
    );

    const rows = await this.prisma.book.findMany({
      where: seekWhere ? { AND: [where, seekWhere] } : where,
      orderBy,
      take,
      select: {
        id: true,
        title: true,
        coverImage: true,
        type: { select: { name: true, slug: true } },
        contributors: {
          select: {
            role: true,
            contributor: { select: { name: true } },
          },
        },
        ratingAvg: true,
        ratingCount: true,
        isFeatured: true,
        createdAt: true,
        updatedAt: true,
        lastContentUpdate: true,
        status: true,
        chapterCount: true,
        genres: { select: { genre: { select: { name: true, slug: true } } } },
      },
    });

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;

    const items = pageRows.map((b) => {
      const mainContributor = b.contributors.find((a) => a.role === 'AUTHOR') || b.contributors[0];
      return {
        id: b.id,
        title: b.title,
        coverImage: b.coverImage,
        type: b.type,
        contributors: mainContributor ? mainContributor.contributor.name : null,
        ratingAvg: Number(toNumber(b.ratingAvg).toFixed(2)),
        ratingCount: b.ratingCount,
        genres: b.genres.map((g) => g.genre),
        isFeatured: b.isFeatured,
        status: b.status,
        chapterCount: b.chapterCount,
        updatedAt: (b.lastContentUpdate ?? b.updatedAt).toISOString(),
      };
    });

    let nextCursor: string | null = null;
    if (hasMore) {
      const last = pageRows[pageRows.length - 1];
      nextCursor = encodeCursor({ sort, id: last.id, v: cursorValue(last) });
    }

    const result = { items, nextCursor, hasMore };

    if (isDefaultView) {
      await this.cacheManager.setString(
          this.CACHE_KEY_BROWSE_DEFAULT,
          JSON.stringify(result),
          90,
      );
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
    const types = (query.types ?? [])
      .map((t) => normalizeSlug(t))
      .filter(Boolean);

    if (types.length > 10) throw new BadRequestException('too many types');
    if (types.some((t) => !SAFE_SLUG.test(t)))
      throw new BadRequestException('invalid type slug');

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

  private buildBookSearchWhere(q: string): Prisma.BookWhereInput[] {
    return [
      { title: { contains: q, mode: 'insensitive' } },
      { originalTitle: { contains: q, mode: 'insensitive' } },
      { alternativeTitles: { has: q } },
    ];
  }

  private buildTypeBrowseCacheKey(
    typeSlug: string,
    args: { genres?: string[]; q?: string; sort?: BrowseSort; limit?: number },
  ) {
    const sort = (args.sort ?? 'recently_updated') as BrowseSort;
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

  private buildBrowseSort(
    sort: BrowseSort,
    cursor: CursorPayload | null,
  ): {
    orderBy: Prisma.BookOrderByWithRelationInput[];
    seekWhere: Prisma.BookWhereInput | null;
    cursorValue: (row: any) => string;
  } {
    // Stable seek pagination using (sortField, id) tie-breaker.
    if (sort === 'newest') {
      const orderBy: Prisma.BookOrderByWithRelationInput[] = [
        { createdAt: 'desc' },
        { id: 'desc' },
      ];
      const seekWhere = cursor
        ? {
            OR: [
              { createdAt: { lt: new Date(cursor.v) } },
              {
                AND: [
                  { createdAt: { equals: new Date(cursor.v) } },
                  { id: { lt: cursor.id } },
                ],
              },
            ],
          }
        : null;

      return {
        orderBy,
        seekWhere,
        cursorValue: (r) => r.createdAt.toISOString(),
      };
    }

    if (sort === 'oldest') {
      const orderBy: Prisma.BookOrderByWithRelationInput[] = [
        { createdAt: 'asc' },
        { id: 'asc' },
      ];
      const seekWhere = cursor
        ? {
            OR: [
              { createdAt: { gt: new Date(cursor.v) } },
              {
                AND: [
                  { createdAt: { equals: new Date(cursor.v) } },
                  { id: { gt: cursor.id } },
                ],
              },
            ],
          }
        : null;

      return {
        orderBy,
        seekWhere,
        cursorValue: (r) => r.createdAt.toISOString(),
      };
    }

    if (sort === 'most_popular') {
      // Popular = ratingAvg desc, ratingCount desc, updatedAt desc, id desc
      const orderBy: Prisma.BookOrderByWithRelationInput[] = [
        { ratingAvg: 'desc' },
        { ratingCount: 'desc' },
        { updatedAt: 'desc' },
        { id: 'desc' },
      ];

      // Cursor.v is JSON string of compound fields
      const seekWhere = cursor ? this.popularSeekWhere(cursor) : null;

      return {
        orderBy,
        seekWhere,
        cursorValue: (r) =>
          JSON.stringify({
            ratingAvg: toNumber(r.ratingAvg),
            ratingCount: r.ratingCount,
            updatedAt: r.updatedAt.toISOString(),
          }),
      };
    }

    // recently_updated (default)
    const orderBy: Prisma.BookOrderByWithRelationInput[] = [
      { lastContentUpdate: 'desc' },
      { id: 'desc' },
    ];
    const seekWhere = cursor
      ? {
          OR: [
            { lastContentUpdate: { lt: new Date(cursor.v) } },
            {
              AND: [
                { lastContentUpdate: { equals: new Date(cursor.v) } },
                { id: { lt: cursor.id } },
              ],
            },
          ],
        }
      : null;

    return {
      orderBy,
      seekWhere,
      cursorValue: (r) => (r.lastContentUpdate ?? r.updatedAt).toISOString(),
    };
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

    await this.cacheManager.setString(
      this.CACHE_KEY_GENRES_ALL,
      JSON.stringify(allGenres),
      3600,
    );
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

  private popularSeekWhere(cursor: CursorPayload): Prisma.BookWhereInput {
    let v: { ratingAvg: number; ratingCount: number; updatedAt: string } | null;
    try {
      v = JSON.parse(cursor.v);
    } catch {
      v = null;
    }
    if (!v) return { id: { lt: cursor.id } };

    const avg = new Prisma.Decimal(v.ratingAvg);
    const count = v.ratingCount;
    const updatedAt = new Date(v.updatedAt);

    return {
      OR: [
        { ratingAvg: { lt: avg } },
        {
          AND: [{ ratingAvg: { equals: avg } }, { ratingCount: { lt: count } }],
        },
        {
          AND: [
            { ratingAvg: { equals: avg } },
            { ratingCount: { equals: count } },
            { updatedAt: { lt: updatedAt } },
          ],
        },
        {
          AND: [
            { ratingAvg: { equals: avg } },
            { ratingCount: { equals: count } },
            { updatedAt: { equals: updatedAt } },
            { id: { lt: cursor.id } },
          ],
        },
      ],
    };
  }

  // List all books
  async listAll(args: {
    page: number;
    limit: number;
    q?: string;
    status: StatusFilter;
  }) {
    const page = clamp(args.page, 1, 10_000);
    const limit = clamp(args.limit, 1, 50);
    const q = normalizeQ(args.q);

    const where: Prisma.BookWhereInput = {};
    if (q) {
      where.OR = this.buildBookSearchWhere(q);
    }
    switch (args.status) {
      case 'all':
        break;
      case 'published':
        where.publishStatus = PublicationStatus.PUBLISHED;
        break;
      case 'draft':
        where.publishStatus = PublicationStatus.DRAFT;
        break;
      case 'featured':
        where.isFeatured = true;
        break;
    }

    const skip = (page - 1) * limit;

    const [total, published, drafts, books] = await this.prisma.$transaction([
      this.prisma.book.count(),
      this.prisma.book.count({ where: { publishStatus: PublicationStatus.PUBLISHED } }),
      this.prisma.book.count({ where: { publishStatus: PublicationStatus.DRAFT } }),
      this.prisma.book.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          originalTitle: true,
          alternativeTitles: true,
          contributors: {
            select: {
              role: true,
              contributor: { select: { name: true } },
            },
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
            include: {
              genre: { select: { id: true, name: true, slug: true } },
            },
            take: 3,
          },
          type: { select: { name: true } },
        },
      }),
    ]);

    const formattedBooks = books.map((b) => {
      const mainContributor = b.contributors.find((a) => a.role === 'AUTHOR') || b.contributors[0];
      return {
        ...b,
        contributors: mainContributor ? mainContributor.contributor.name : null,
      };
    });

    return {
      books: formattedBooks,
      hasMore: skip + books.length < total,
      stats: { total, Published: published, Drafts: drafts },
      page,
      limit,
    };
  }

  async getRelatedBooks(bookId: number, limitInput: number) {
    const limit = clamp(limitInput || 12, 1, 24);

    const version = await this.cacheManager.getVersion(
        this.CACHE_KEY_RECOMMENDATION_VERSION,
    );

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
                const mainContributor = book.contributors.find((a) => a.role === 'AUTHOR') || book.contributors[0];
                return {
                  id: book.id,
                  title: book.title,
                  coverImage: book.coverImage,
                  contributors: mainContributor ? mainContributor.contributor.name : null,
                  type: book.type,
                  ratingAvg: Number(toNumber(book.ratingAvg).toFixed(2)),
                  ratingCount: book.ratingCount,
                  popularityScore: Number(book.popularityScore),
                  genres: book.genres
                      .map((g) => g.genre)
                      .sort((a, b) => a.name.localeCompare(b.name)),
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
      this.prisma.favoriteBook.findUnique({
        where: { userId_bookId: { userId, bookId } },
        select: { id: true },
      }),
    ]);

    return {
      myRating: myRating?.rating ?? null,
      purchasedChapterIds: purchased
        .map((row) => row.chapterId)
        .filter(
          (chapterId): chapterId is number => typeof chapterId === 'number',
        ),
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
          contributors: { select: { role: true, contributor: { select: { id: true, name: true } } } },
        },
      });

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
  async update(
      id: number,
      data: UpdateBookDto,
  ) {
    const { genreIds, typeId, coverImage, contributors, ...rest } = data;

    const currentBook = await this.prisma.book.findUnique({
      where: { id },
      select: { contributors: { select: { contributorId: true } } },
    });

    if (!currentBook) throw new NotFoundException('book not found');

    let typeConnect: Prisma.BookUpdateInput = {};
    if (typeId !== undefined) typeConnect = { type: { connect: { id: typeId } } };

    const updateData: Prisma.BookUpdateInput = {
      ...rest,
      ...(coverImage !== undefined
          ? {
            coverMedia: coverImage
                ? { connect: { code: coverImage } }
                : { disconnect: true },
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

        return tx.book.update({
          where: { id },
          data: updateData,
          include: {
            coverMedia: { select: { code: true, filename: true } },
            genres: {
              select: { genre: { select: { id: true, name: true, slug: true } } },
            },
            type: { select: { id: true, name: true, slug: true } },
            contributors: { select: { role: true, contributor: { select: { id: true, name: true } } } },
          },
        });
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

      await this.recommendationService.recalculatePopularity(tx, bookId);

      return {
        rating,
        ratingAvg,
        ratingCount,
      };
    });

    await this.publicService.clearHomeCache();

    await this.cacheManager.bumpVersion(
        this.CACHE_KEY_RECOMMENDATION_VERSION,
    );

    return result;
  }

  async deleteById(id: number) {
    const record = await this.prisma.book.findUnique({
      where: { id },
      select: { contributors: { select: { contributorId: true } } },
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

      await tx.book.delete({ where: { id } });
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

    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.favoriteBook.findUnique({
        where: {
          userId_bookId: {
            userId,
            bookId,
          },
        },
      });

      if (existing) {
        await tx.favoriteBook.delete({
          where: {
            userId_bookId: {
              userId,
              bookId,
            },
          },
        });

        await tx.book.update({
          where: { id: bookId },
          data: {
            favoriteCount: {
              decrement: 1,
            },
          },
        });

        await this.recommendationService.recalculatePopularity(tx, bookId);

        return {
          favorited: false,
        };
      }

      await tx.favoriteBook.create({
        data: {
          userId,
          bookId,
        },
      });

      await tx.book.update({
        where: { id: bookId },
        data: {
          favoriteCount: {
            increment: 1,
          },
        },
      });

      await this.recommendationService.recalculatePopularity(tx, bookId);

      return {
        favorited: true,
      };
    });

    await this.publicService.clearHomeCache();

    await this.cacheManager.bumpVersion(
        this.CACHE_KEY_RECOMMENDATION_VERSION,
    );

    return result;
  }

  async getFavorites(userId: number, args: { page: number; limit: number }) {
    const page = clamp(args.page, 1, 10_000);
    const limit = clamp(args.limit, 1, 50);
    const skip = (page - 1) * limit;

    const [total, favorites] = await Promise.all([
      this.prisma.favoriteBook.count({
        where: { userId },
      }),
      this.prisma.favoriteBook.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
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
            },
          },
        },
      }),
    ]);

    const data = favorites.map(({ book }) => {
      const mainContributor = book.contributors.find((a) => a.role === 'AUTHOR') || book.contributors[0];
      return {
        id: book.id,
        title: book.title,
        contributors: mainContributor ? mainContributor.contributor.name : null,
        coverImage: book.coverImage,
        ratingAvg: Number(toNumber(book.ratingAvg).toFixed(2)),
        ratingCount: book.ratingCount,
        updatedAt: book.updatedAt.toISOString(),
        type: book.type,
      };
    });

    return {
      data,
      total,
      page,
      lastPage: Math.max(1, Math.ceil(total / limit)),
    };
  }

  private buildRelatedBooksCacheKey(
      version: string,
      bookId: number,
      limit: number,
  ) {
    return this.cacheManager.buildKey(
        'books:related',
        version,
        bookId,
        limit,
    );
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
