import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LibraryService {
    constructor(private readonly prisma: PrismaService) {}

    async getLibrary(userId: number) {
        const [bookAccess, chapterAccess] = await Promise.all([
            this.prisma.bookAccess?.findMany?.({
                where: { userId },
                orderBy: { purchasedAt: 'desc' },
                include: {
                    book: {
                        select: {
                            id: true,
                            title: true,
                            author: true,
                            description: true,
                            coverImage: true,
                            price: true,
                            isPublished: true,
                            updatedAt: true,
                        },
                    },
                },
            }) ?? Promise.resolve([]),

            this.prisma.accessRecord.findMany({
                where: { userId },
                orderBy: { purchasedAt: 'desc' },
                include: {
                    chapter: {
                        select: {
                            id: true,
                            title: true,
                            index: true,
                            isFree: true,
                            price: true,
                            requiresSeparatePurchase: true,
                            book: {
                                select: {
                                    id: true,
                                    title: true,
                                    coverImage: true,
                                },
                            },
                        },
                    },
                },
            }),
        ]);

        const books = bookAccess
            .map((x: any) => x.book)
            .filter(Boolean);

        const chapters = chapterAccess.map((x) => x.chapter);

        return { books, chapters };
    }
}
