import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CacheManager } from '../cache/cache.manager';
import { PublicService } from '../public/public.service'
import { createHash } from 'crypto';

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
        if (!obj ||
            typeof obj !== 'object' ||
            typeof obj.id !== 'number' ||
            typeof obj.sort !== 'string'
        ) return null;
        return obj as CursorPayload;
    } catch {
        return null;
    }
}

function toNumber(v: unknown): number {
    if (v == null) return 0;
    if (typeof v === 'number') return v;
    if (typeof v === 'string') return Number(v);
    if (typeof v === 'object' && 'toNumber' in v && typeof (v as any).toNumber === 'function') {
        return (v as any).toNumber();
    }
    return Number(v);
}

function clamp(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, n));
}

function normalizeSlug(input: string): string {
    return input.trim().toLowerCase();
}

function normalizeQ(q?: string) {
    const s = (q ?? '').trim();
    if (!s) return undefined;
    return s.length > 80 ? s.slice(0, 80) : s;
}

function slugifyType(value: string) {
    return value
        .trim()
        .toLowerCase()
        .replace(/[_\s]+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-{2,}/g, '-')
        .replace(/^-|-$/g, '');
}

@Injectable()
export class BooksService {
    constructor(
        private prisma: PrismaService,
        private publicService: PublicService,
        private readonly cacheManager: CacheManager,
    ) {}


    private readonly CACHE_KEY_BROWSE_DEFAULT = 'books:browse:default';
    private readonly CACHE_KEY_STATE_BOOK = 'stats:books';
    private readonly CACHE_KEY_STATE_CHAPTERS_COUNT = 'stats:chapters:count';
    private readonly CACHE_KEY_GENRES_ALL = 'genres:all';

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
            (!args.cursor) &&
            (args.sort === 'recently_updated' || !args.sort);

        if (isDefaultView) {
            const cached = await this.cacheManager.getString(this.CACHE_KEY_BROWSE_DEFAULT);
            if (cached) {
                return JSON.parse(cached);
            }
        }

        const limitRaw = Number(args.limit) || 24;
        const limit = clamp(limitRaw, 1, 50);
        const sort: BrowseSort = args.sort ?? 'recently_updated';
        const q = normalizeQ(args.q);

        const where: Prisma.BookWhereInput = {
            isPublished: true,
            type: { isActive: true },
        };

        // Category/type filter
        if (args.types?.length) {
            where.type = { is: { slug: { in: args.types } } };
        }

        // Search in title OR author
        if (q) {
            where.OR = [
                { title: { contains: q, mode: 'insensitive' } },
                { author: { contains: q, mode: 'insensitive' } },
            ];
        }

        // Genre filter (AND semantics: must include ALL slugs)
        if (args.genres?.length) {
            const existingAnd = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : [];

            where.AND = [
                ...existingAnd,
                ...args.genres.map((slug) => ({
                    genres: { some: { genre: { slug } } },
                })),
            ];
        }


        const cursor = decodeCursor(args.cursor);
        const take = limit + 1;

        const { orderBy, seekWhere, cursorValue } = this.buildBrowseSort(sort, cursor);

        const rows = await this.prisma.book.findMany({
            where: seekWhere ? { AND: [where, seekWhere] } : where,
            orderBy,
            take,
            select: {
                id: true,
                title: true,
                coverImage: true,
                type: { select: { name: true, slug: true } },
                author: true,
                ratingAvg: true,
                ratingCount: true,
                isFeatured: true,
                updatedAt: true,
                _count: { select: { chapters: true } },
                genres: { select: { genre: { select: { name: true, slug: true } } } },
            },
        });

        const hasMore = rows.length > limit;
        const pageRows = hasMore ? rows.slice(0, limit) : rows;

        const items = pageRows.map((b) => ({
            id: b.id,
            title: b.title,
            coverImage: b.coverImage,
            type: b.type,
            author: b.author,
            ratingAvg: Number(toNumber(b.ratingAvg).toFixed(2)),
            ratingCount: b.ratingCount,
            genres: b.genres.map((g) => g.genre),
            isFeatured: b.isFeatured,
            chapterCount: b._count.chapters,
            updatedAt: b.updatedAt.toISOString(),
        }));

        let nextCursor: string | null = null;
        if (hasMore) {
            const last = pageRows[pageRows.length - 1];
            nextCursor = encodeCursor({ sort, id: last.id, v: cursorValue(last) });
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
        const typeSlug = slugifyType(typeParam);
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
                    return JSON.parse(cached) as { items: unknown[]; nextCursor: string | null };
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
        query: { types?: string[]; q?: string; sort?: any; limit?: number; cursor?: string },
    ) {
        const slug = normalizeSlug(slugParam);
        if (!SAFE_SLUG.test(slug)) throw new NotFoundException('genre not found');

        // Validate type filters (slugs) defensively (prevents abuse)
        const types = (query.types ?? [])
            .map((t) => normalizeSlug(t))
            .filter(Boolean);

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
            const cacheKey = this.buildGenreBrowseCacheKey(slug, { types, q, sort, limit });

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

    private buildBrowseSort(sort: BrowseSort, cursor: CursorPayload | null): {
        orderBy: Prisma.BookOrderByWithRelationInput[];
        seekWhere: Prisma.BookWhereInput | null;
        cursorValue: (row: any) => string;
    } {
        // Stable seek pagination using (sortField, id) tie-breaker.
        if (sort === 'newest') {
            const orderBy: Prisma.BookOrderByWithRelationInput[] = [{ createdAt: 'desc' }, { id: 'desc' }];
            const seekWhere = cursor
                ? {
                    OR: [
                        { createdAt: { lt: new Date(cursor.v) } },
                        { AND: [{ createdAt: { equals: new Date(cursor.v) } }, { id: { lt: cursor.id } }] },
                    ],
                }
                : null;

            return { orderBy, seekWhere, cursorValue: (r) => r.createdAt.toISOString() };
        }

        if (sort === 'oldest') {
            const orderBy: Prisma.BookOrderByWithRelationInput[] = [{ createdAt: 'asc' }, { id: 'asc' }];
            const seekWhere = cursor
                ? {
                    OR: [
                        { createdAt: { gt: new Date(cursor.v) } },
                        { AND: [{ createdAt: { equals: new Date(cursor.v) } }, { id: { gt: cursor.id } }] },
                    ],
                }
                : null;

            return { orderBy, seekWhere, cursorValue: (r) => r.createdAt.toISOString() };
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
        const orderBy: Prisma.BookOrderByWithRelationInput[] = [{ updatedAt: 'desc' }, { id: 'desc' }];
        const seekWhere = cursor
            ? {
                OR: [
                    { updatedAt: { lt: new Date(cursor.v) } },
                    { AND: [{ updatedAt: { equals: new Date(cursor.v) } }, { id: { lt: cursor.id } }] },
                ],
            }
            : null;

        return { orderBy, seekWhere, cursorValue: (r) => r.updatedAt.toISOString() };
    }

    private async getAllGenresCached() {
        const cached = await this.cacheManager.getString(this.CACHE_KEY_GENRES_ALL);
        if (cached) {
            try {
                return JSON.parse(cached) as Array<{ id: number; name: string; slug: string; iconKey: string | null }>;
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
                return JSON.parse(cached) as { id: number; name: string; slug: string; iconKey: string | null };
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
                { AND: [{ ratingAvg: { equals: avg } }, { ratingCount: { lt: count } }] },
                { AND: [{ ratingAvg: { equals: avg } }, { ratingCount: { equals: count } }, { updatedAt: { lt: updatedAt } }] },
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
    async listAll(args: { page: number; limit: number; q?: string; status: StatusFilter }) {
        const page = clamp(args.page, 1, 10_000);
        const limit = clamp(args.limit, 1, 50);
        const q = normalizeQ(args.q);

        const where: Prisma.BookWhereInput = {};
        if (q) {
            where.title = { contains: q, mode: 'insensitive' };
        }
        switch (args.status) {
            case 'all':
                break;
            case 'published':
                where.isPublished = true;
                break;
            case 'draft':
                where.isPublished = false;
                break;
            case 'featured':
                where.isFeatured = true;
                break;
        }

        const skip = (page - 1) * limit;

        const [total, published, drafts, books] = await this.prisma.$transaction([
            this.prisma.book.count(),
            this.prisma.book.count({ where: { isPublished: true } }),
            this.prisma.book.count({ where: { isPublished: false } }),
            this.prisma.book.findMany({
                where,
                orderBy: { updatedAt: 'desc' },
                skip,
                take: limit,
                select: {
                    id: true,
                    title: true,
                    author: true,
                    coverImage: true,
                    isPublished: true,
                    isFeatured: true,
                    ratingAvg: true,
                    ratingCount: true,
                    updatedAt: true,
                    genres: { include: { genre: { select: { id: true, name: true, slug: true } } }, take: 3 },
                    _count: { select: { chapters: true } },
                    type: { select: { name: true, } },
                },
            }),
        ]);

        return {
            books: books,
            hasMore: skip + books.length < total,
            stats: { total, Published: published, Drafts: drafts },
            page,
            limit,
        };
    }

    async getRelatedBooks(bookId: number, limitInput: number) {
        const limit = clamp(limitInput || 12, 1, 24);
        const book = await this.prisma.book.findUnique({
            where: { id: bookId },
            select: {
                id: true,
                typeId: true,
                genres: { select: { genreId: true } },
            },
        });

        if (!book) throw new NotFoundException('book not found');

        const genreIds = book.genres.map((item) => item.genreId);

        const rows = await this.prisma.book.findMany({
            where: {
                isPublished: true,
                id: { not: bookId },
            },
            include: {
                type: { select: { name: true, slug: true } },
                _count: { select: { chapters: true } },
                genres: { select: { genre: { select: { id: true, name: true, slug: true } } }, take: 3 },
            },
            take: 120,
        });

        const scored = rows
            .map((row) => {
                const genreMatchCount = row.genres.filter((g) => genreIds.includes(g.genre.id)).length;
                const score = [
                    genreMatchCount > 0 ? 1 : 0,
                    row.typeId === book.typeId ? 1 : 0,
                    Number(row.ratingAvg),
                    row.updatedAt.getTime(),
                ] as const;

                return {
                    id: row.id,
                    title: row.title,
                    coverImage: row.coverImage,
                    type: row.type,
                    author: row.author,
                    ratingAvg: Number(toNumber(row.ratingAvg).toFixed(2)),
                    ratingCount: row.ratingCount,
                    genres: row.genres.map((g) => g.genre),
                    isFeatured: row.isFeatured,
                    chapterCount: row._count.chapters,
                    updatedAt: row.updatedAt.toISOString(),
                    _score: score,
                };
            })
            .sort((a, b) => {
                if (b._score[0] !== a._score[0]) return b._score[0] - a._score[0];
                if (b._score[1] !== a._score[1]) return b._score[1] - a._score[1];
                if (b._score[2] !== a._score[2]) return b._score[2] - a._score[2];
                if (b._score[3] !== a._score[3]) return b._score[3] - a._score[3];
                return b.id - a.id;
            })
            .slice(0, limit)
            .map(({ _score, ...item }) => item);

        return { items: scored };
    }

    // Get book
    async findById(id: number) {
        return this.prisma.book.findUnique({
            where: { id },
            select: {
                id: true,
                title: true,
                author: true,
                description: true,
                coverImage: true,
                isFeatured: true,
                ratingAvg: true,
                ratingCount: true,
                updatedAt: true,
                genres: { include: { genre: { select: { id: true, name: true, slug: true, iconKey: true } } } },
                type: { select: { name: true, slug: true, iconKey: true } },
            }
        });
    }

    // Get full book details
    async fullBookDetails(id: number) {
        return this.prisma.book.findUnique({
            where: { id },
            select: {
                id: true,
                title: true,
                author: true,
                description: true,
                coverImage: true,
                isFeatured: true,
                isPublished: true,
                ratingAvg: true,
                ratingCount: true,
                updatedAt: true,
                createdAt: true,
                genres: { include: { genre: { select: { id: true, name: true, slug: true, iconKey: true } } } },
                type: { select: { id: true, name: true, slug: true, iconKey: true } },
            }
        });
    }

    async getViewerState(bookId: number, userId: number) {
        const bookExists = await this.prisma.book.findUnique({ where: { id: bookId }, select: { id: true } });
        if (!bookExists) throw new NotFoundException('Book not found');

        const [myRating, purchased] = await Promise.all([
            this.prisma.bookRating.findUnique({ where: { userId_bookId: { userId, bookId } }, select: { rating: true } }),
            this.prisma.accessRecord.findMany({
                where: { userId, chapter: { bookId } },
                select: { chapterId: true },
            }),
        ]);

        return {
            myRating: myRating?.rating ?? null,
            purchasedChapterIds: purchased.map((row) => row.chapterId).filter((chapterId): chapterId is number => typeof chapterId === 'number'),
        };
    }

    // Admin: create a new book
    async create(data: {
        title: string;
        author?: string;
        description?: string;
        coverImage?: string;
        isPublished?: boolean;
        isFeatured?: boolean;
        typeId: number;
        genreIds: number[];
    }) {
        const { genreIds, typeId, ...rest } = data;
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

        if (rest.author !== undefined) payload.author = rest.author;
        if (rest.description !== undefined) payload.description = rest.description;
        if (rest.coverImage !== undefined) {payload.coverMedia = { connect: { code: rest.coverImage } };}
        if (rest.isPublished !== undefined) payload.isPublished = rest.isPublished;
        if (rest.isFeatured !== undefined) payload.isFeatured = rest.isFeatured;

        const created = await this.prisma.book.create({
            data: payload,
            include: {
                coverMedia: { select: { code: true, filename: true } },
                genres: { select: { genre: { select: { id: true, name: true, slug: true } } } },
                type: { select: { id: true, name: true, slug: true } },
            },
        });

        await this.publicService.clearGenresPageCache();
        await this.invalidateCache();
        return created;
    }

    // Admin: update a book
    async update(
        id: number,
        data: Partial<{
            title: string;
            author?: string;
            description?: string;
            coverImage?: string;
            isPublished?: boolean;
            isFeatured?: boolean;
            typeId?: number;
            genreIds?: number[];
        }>,
    ) {
        const { genreIds, typeId, coverImage, ...rest } = data;
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

        try {
            const updated = await this.prisma.book.update({
                where: { id },
                data: updateData,
                include: {
                    coverMedia: { select: { code: true, filename: true } },
                    genres: { select: { genre: { select: { id: true, name: true, slug: true } } } },
                    type: { select: { id: true, name: true, slug: true } },
                },
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
            throw new NotFoundException('invalid rating');
        }

        const book = await this.prisma.book.findUnique({ where: { id: bookId }, select: { id: true, updatedAt: true } });
        if (!book) throw new NotFoundException('book not found');

        const result = await this.prisma.$transaction(async (tx) => {
            await tx.bookRating.upsert({
                where: { userId_bookId: { userId, bookId } },
                create: { userId, bookId, rating },
                update: { rating },
            });

            const agg = await tx.bookRating.aggregate({
                where: { bookId },
                _avg: { rating: true },
                _count: { rating: true },
            });

            const avg = agg._avg.rating ?? 0;
            const count = agg._count.rating ?? 0;

            await tx.book.update({
                where: { id: bookId },
                data: {
                    ratingAvg: new Prisma.Decimal(Number(avg).toFixed(2)),
                    ratingCount: count,
                    updatedAt: book.updatedAt,
                },
                select: { id: true },
            });

            return {
                rating,
                ratingAvg: Number(Number(avg).toFixed(2)),
                ratingCount: count,
            };
        });

        await this.publicService.clearHomeCache();

        return result;
    }

    async deleteById(id: number) {
        const record = await this.prisma.book.findUnique({ where: { id } });
        if (!record) throw new NotFoundException('book not found');

        await this.prisma.book.delete({ where: { id } });

        await this.invalidateCache();

        return { id, deleted: true };
    }

    private async invalidateCache() {
        await this.cacheManager.del(this.CACHE_KEY_BROWSE_DEFAULT);
        await this.cacheManager.del(this.CACHE_KEY_STATE_BOOK);
        await this.cacheManager.del(this.CACHE_KEY_STATE_CHAPTERS_COUNT);
        await this.cacheManager.del(this.CACHE_KEY_GENRES_ALL);
        await this.publicService.clearHomeCache();
    }
}
