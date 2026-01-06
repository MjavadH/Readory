import {Injectable, NotFoundException, Inject} from '@nestjs/common';
import { Prisma, BookType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import Redis from 'ioredis';
import { WalletsService } from '../wallets/wallets.service';

@Injectable()
export class BooksService {
    constructor(
        private prisma: PrismaService,
        private walletsService: WalletsService,
        @Inject('REDIS_CLIENT') private readonly redis: Redis,
    ) {}

    async countAll() {
        const CACHE_KEY = 'stats:books:count';
        const cached = await this.redis.get(CACHE_KEY);
        if (cached) return Number.parseInt(cached,10);

        const count = await this.prisma.book.count();
        await this.redis.set(CACHE_KEY, String(count), 'EX', 3600);
        return count;
    }

    // List published books
    async findPublished() {
        return this.prisma.book.findMany({
            where: { isPublished: true },
            orderBy: { createdAt: 'desc' },
            include: {
                coverMedia: { select: { code: true, filename: true } },
                genres: { select: { genre: { select: { id: true, name: true, slug: true } } } },
            },
        });
    }

    // List all books
    async listAll() {
        return this.prisma.book.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                _count: { select: { chapters: true } },
                coverMedia: { select: { code: true, filename: true } },
                genres: { select: { genre: { select: { id: true, name: true, slug: true } } } },
            },
        });
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
                    select: { id: true, title: true, index: true, price: true, isFree: true },
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

    async purchaseBook(userId: number, bookId: number) {
        const book = await this.prisma.book.findUnique({
            where: { id: bookId },
            select: { id: true, title: true, price: true, isPublished: true }
        });

        if (!book || !book.isPublished) {
            throw new NotFoundException('Book not found or not available');
        }

        const existingAccess = await this.prisma.bookAccess.findUnique({
            where: {
                userId_bookId: { userId, bookId }
            }
        });

        if (existingAccess) {
            return { message: 'You already own this book', access: existingAccess };
        }

        if (book.price.toNumber() <= 0) {
            return this.prisma.bookAccess.create({
                data: { userId, bookId }
            });
        }

        return this.prisma.$transaction(async (tx) => {
            await this.walletsService.debit(
                userId,
                book.price.toNumber(),
                `Purchase Book: ${book.title}`
            );

            const bookAccess = await tx.bookAccess.create({
                data: { userId, bookId }
            });

            await tx.accessRecord.create({
                data: {
                    userId,
                    bookId,
                    kind: 'BOOK',
                }
            });

            return bookAccess;
        });
    }

    // Admin: create a new book
    async create(data: {
        title: string;
        author?: string;
        description?: string;
        coverImage?: string;
        price?: string;
        isPublished?: boolean;
        type?: string;
        genreIds: number[];
    }) {
        const { genreIds, price, type, ...rest } = data;

        const created = await this.prisma.book.create({
            data: {
                ...rest,
                type: type as BookType,
                price: price ? new Prisma.Decimal(price) : undefined,
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

        await this.redis.del('stats:books:count');
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
            price?: string;
            isPublished?: boolean;
            type?: string;
            genreIds?: number[];
        }>,
    ) {
        const { genreIds, price, type, ...rest } = data;

        const updateData: Prisma.BookUpdateInput = {
            ...rest,
            ...(type ? { type: type as BookType } : {}),
            ...(price !== undefined ? { price: new Prisma.Decimal(price) } : {}),
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

            await this.redis.del('stats:books:count');
            return updated;
        } catch (err: any) {
            if (err?.code === 'P2025') throw new NotFoundException('book not found');
            throw err;
        }
    }

    async deleteById(id: number) {
        const record = await this.prisma.book.findUnique({ where: { id } });
        if (!record) throw new NotFoundException('book not found');

        await this.prisma.book.delete({ where: { id } });

        await this.redis.del('stats:books:count');
        await this.redis.del('stats:chapters:count');

        return { id, deleted: true };
    }
}
