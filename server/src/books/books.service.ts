import {Injectable, NotFoundException, BadRequestException, Inject} from '@nestjs/common';
import { Prisma, BookType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import Redis from 'ioredis';
import { WalletsService } from '../wallets/wallets.service';
import { PublicService } from '../public/public.service'

type StatusFilter = 'all' | 'published' | 'draft';

function clamp(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, n));
}

function normalizeQ(q?: string) {
    const s = (q ?? '').trim();
    return s.length ? s : undefined;
}

@Injectable()
export class BooksService {
    constructor(
        private prisma: PrismaService,
        private walletsService: WalletsService,
        private publicService: PublicService,
        @Inject('REDIS_CLIENT') private readonly redis: Redis,
    ) {}

    // List published books
    async listPublished(args: { page: number; limit: number; q?: string }) {
        const page = clamp(args.page, 1, 10_000);
        const limit = clamp(args.limit, 1, 50);
        const q = normalizeQ(args.q);

        const where: Prisma.BookWhereInput = { isPublished: true };
        if (q) where.title = { contains: q, mode: 'insensitive' };

        const skip = (page - 1) * limit;

        const [total, books] = await this.prisma.$transaction([
            this.prisma.book.count({ where }),
            this.prisma.book.findMany({
                where,
                orderBy: { updatedAt: 'desc' },
                skip,
                take: limit,
                include: {
                    genres: { include: { genre: { select: { id: true, name: true, slug: true } } } },
                },
            }),
        ]);

        return {
            books: books,
            hasMore: skip + books.length < total,
            page,
            limit,
            total,
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
        if (args.status === 'published') where.isPublished = true;
        if (args.status === 'draft') where.isPublished = false;

        const skip = (page - 1) * limit;

        const [total, published, drafts, books] = await this.prisma.$transaction([
            this.prisma.book.count({ where }),
            this.prisma.book.count({ where: { ...where, isPublished: true } }),
            this.prisma.book.count({ where: { ...where, isPublished: false } }),
            this.prisma.book.findMany({
                where,
                orderBy: { updatedAt: 'desc' },
                skip,
                take: limit,
                include: {
                    genres: { include: { genre: { select: { id: true, name: true, slug: true } } } },
                    _count: { select: { chapters: true } },
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

    // Get book with chapters
    async findById(id: number) {
        return this.prisma.book.findUnique({
            where: { id },
            include: {
                coverMedia: { select: { code: true, filename: true } },
                genres: { select: { genre: { select: { id: true, name: true, slug: true } } } },
                chapters: {
                    orderBy: { index: 'asc' },
                    select: { id: true, title: true, index: true, isFree: true },
                },
            },
        });
    }

    async findByType(type: string) {
        const upperType = type.toUpperCase();
        return this.prisma.book.findMany({
            where: {
                type: upperType as BookType,
                isPublished: true
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    // Admin: create a new book
    async create(data: {
        title: string;
        author?: string;
        description?: string;
        coverImage?: string;
        isPublished?: boolean;
        isFeatured?: boolean;
        type?: string;
        genreIds: number[];
    }) {
        const { genreIds, type, ...rest } = data;

        const created = await this.prisma.book.create({
            data: {
                ...rest,
                type: type as BookType,
                genres: {
                    create: genreIds.map((genreId) => ({
                        genre: { connect: { id: genreId } },
                    })),
                },
            },
            include: {
                coverMedia: { select: { code: true, filename: true } },
                genres: { select: { genre: { select: { id: true, name: true, slug: true } } } },
            },
        });

        await this.publicService.clearHomeCache();
        await this.redis.del('stats:books');
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
            type?: string;
            genreIds?: number[];
        }>,
    ) {
        const { genreIds, type, ...rest } = data;

        const updateData: Prisma.BookUpdateInput = {
            ...rest,
            ...(type ? { type: type as BookType } : {}),
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
                },
            });

            await this.publicService.clearHomeCache();
            await this.redis.del('stats:books');
            return updated;
        } catch (err: any) {
            if (err?.code === 'P2025') throw new NotFoundException('book not found');
            throw err;
        }
    }

    async rateBook(userId: number, bookId: number, rating: number) {
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
            throw new BadRequestException('rating must be between 1 and 5');
        }

        // ensure book exists + published (optional: allow rating unpublished? usually no)
        const book = await this.prisma.book.findUnique({ where: { id: bookId }, select: { id: true } });
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
                    ratingAvg: new Prisma.Decimal(avg.toFixed(2)),
                    ratingCount: count,
                },
                select: { id: true },
            });

            return { rating, ratingAvg: Number(avg.toFixed(2)), ratingCount: count };
        });

        await this.publicService.clearHomeCache();
        return result;
    }

    async deleteById(id: number) {
        const record = await this.prisma.book.findUnique({ where: { id } });
        if (!record) throw new NotFoundException('book not found');

        await this.prisma.book.delete({ where: { id } });

        await this.publicService.clearHomeCache();
        await this.redis.del('stats:books');
        await this.redis.del('stats:chapters:count');

        return { id, deleted: true };
    }
}
