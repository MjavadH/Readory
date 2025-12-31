import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WalletsService } from '../wallets/wallets.service';
import { TransactionType } from '@prisma/client';

@Injectable()
export class ChaptersService {
    constructor(
        private prisma: PrismaService,
        private walletsService: WalletsService,
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
    async createChapter(bookId: number, data: {
        title: string;
        index: number;
        price?: number;
        isFree?: boolean;
        contentPath?: string;
    }) {
        return this.prisma.chapter.create({
            data: {
                ...data,
                book: { connect: { id: bookId } },
            },
        });
    }

    // User: purchase a chapter
    async purchaseChapter(userId: number, chapterId: number) {
        const chapter = await this.prisma.chapter.findUnique({
            where: { id: chapterId },
            include: { book: true },
        });
        if (!chapter) {
            throw new NotFoundException('Chapter not found');
        }
        // Check if free
        if (chapter.isFree || chapter.price == null) {
            const existing = await this.prisma.accessRecord.findFirst({
                where: { userId, chapterId },
            });
            if (existing) {
                return existing;
            }
            return this.prisma.accessRecord.create({
                data: { userId, chapterId },
            });
        }
        // Check if user already purchased
        const existing = await this.prisma.accessRecord.findFirst({
            where: { userId, chapterId },
        });
        if (existing) {
            return existing;
        }
        // Perform the debit and create access record in a transaction
        return this.prisma.$transaction(async (tx) => {
            // Debit the user’s wallet using WalletsService
            await this.walletsService.debit(userId, chapter.price!.toNumber(), `Purchase chapter ${chapter.id}`);
            // Create access record
            return tx.accessRecord.create({
                data: { userId, chapterId },
            });
        });
    }
}
