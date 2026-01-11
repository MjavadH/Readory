import { Injectable, NotFoundException, ConflictException, ForbiddenException, Inject } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WalletsService } from '../wallets/wallets.service';
import { PublicService } from '../public/public.service'
import Redis from 'ioredis';
import { CreateChapterDto } from './dto/create-chapter.dto';
import { UpdateChapterDto } from './dto/update-chapter.dto';

@Injectable()
export class ChaptersService {
    constructor(
        private prisma: PrismaService,
        private walletsService: WalletsService,
        private publicService: PublicService,
        @Inject('REDIS_CLIENT') private readonly redis: Redis
    ) {}

    // List chapters for a book (public)
    async listChapters(bookId: number) {
        return this.prisma.chapter.findMany({
            where: { bookId },
            orderBy: { index: 'asc' },
            select: {
                id: true,
                title: true,
                index: true,
                price: true,
                isFree: true,
            },
        });
    }

    // Admin: create a new chapter
    async createChapter(bookId: number, dto: CreateChapterDto) {
        const isFree = dto.isFree ?? false;
        const price = isFree ? null : dto.price ? new Prisma.Decimal(dto.price) : null;

        try {
            const chapter = await this.prisma.chapter.create({
                data: {
                    book: { connect: { id: bookId } },
                    title: dto.title,
                    index: dto.index,
                    isFree,
                    price,
                    contentPath: dto.contentPath,
                },
            });

            await this.prisma.book.update({
                where: { id: bookId },
                data: { updatedAt: new Date() },
            });

            await this.redis.del('stats:chapters:count');
            await this.publicService.clearHomeCache();
            return chapter;
        } catch (err: any) {
            if (err?.code === 'P2002') throw new ConflictException('Chapter index already exists for this book');
            throw err;
        }
    }

    async updateChapter(bookId: number, chapterId: number, dto: UpdateChapterDto) {
        const existing = await this.prisma.chapter.findFirst({ where: { id: chapterId, bookId } });
        if (!existing) throw new NotFoundException('Chapter not found');

        const nextIsFree = dto.isFree ?? existing.isFree;

        const nextPrice =
            nextIsFree ? null : dto.price !== undefined ? new Prisma.Decimal(dto.price) : existing.price;

        try {
            const chapter = await this.prisma.chapter.update({
                where: { id: chapterId },
                data: {
                    title: dto.title,
                    index: dto.index,
                    isFree: dto.isFree,
                    price: nextPrice,
                    contentPath: dto.contentPath,
                },
                select: {
                    id: true,
                    title: true,
                    index: true,
                    price: true,
                    isFree: true,
                },
            });

            await this.prisma.book.update({
                where: { id: bookId },
                data: { updatedAt: new Date() },
            });

            await this.publicService.clearHomeCache();
            return chapter

        } catch (err: any) {
            if (err?.code === 'P2002') throw new ConflictException('Chapter index already exists for this book');
            throw err;
        }
    }

    async deleteChapter(bookId: number, chapterId: number) {
        const existing = await this.prisma.chapter.findFirst({ where: { id: chapterId, bookId } });
        if (!existing) throw new NotFoundException('Chapter not found');

        await this.prisma.chapter.delete({ where: { id: chapterId } });

        await this.prisma.book.update({
            where: { id: bookId },
            data: { updatedAt: new Date() },
        });

        await this.publicService.clearHomeCache();
        await this.redis.del('stats:chapters:count');
        return { id: chapterId, deleted: true };
    }

    // User: purchase a chapter
    async purchaseChapter(userId: number, chapterId: number) {
        const chapter = await this.prisma.chapter.findUnique({
            where: { id: chapterId },
            select: {
                id: true,
                index: true,
                isFree: true,
                price: true,
                bookId: true,
            },
        });

        if (!chapter) throw new NotFoundException('Chapter not found');

        // Free chapters: just grant chapter access
        if (chapter.isFree || chapter.price == null) {
            const existing = await this.prisma.accessRecord.findFirst({ where: { userId, chapterId } });
            if (existing) return existing;
            return this.prisma.accessRecord.create({ data: { userId, chapterId } });
        }

        const existing = await this.prisma.accessRecord.findFirst({ where: { userId, chapterId } });
        if (existing) return existing;

        // Debit + access record in tx
        return this.prisma.$transaction(async (tx) => {
            await this.walletsService.debit(userId, chapter.price!.toNumber(), `Purchase chapter ${chapter.index}`);
            return tx.accessRecord.create({ data: { userId, chapterId, bookId: chapter.bookId } });
        });
    }
}
