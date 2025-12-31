import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BooksService {
    constructor(private prisma: PrismaService) {}

    // List published books
    async findPublished() {
        return this.prisma.book.findMany({
            where: { isPublished: true },
        });
    }

    // Get book with chapters
    async findById(id: number) {
        return this.prisma.book.findUnique({
            where: { id },
            include: {
                chapters: {
                    orderBy: { index: 'asc' },
                    select: {
                        id: true,
                        title: true,
                        index: true,
                        price: true,
                        isFree: true,
                    },
                },
            },
        });
    }

    // Admin: create a new book
    async create(data: {
        title: string;
        author?: string;
        description?: string;
        coverImage?: string;
        isPublished?: boolean;
    }) {
        return this.prisma.book.create({ data });
    }

    // Admin: update a book
    async update(id: number, data: Partial<{
        title: string;
        author?: string;
        description?: string;
        coverImage?: string;
        isPublished?: boolean;
    }>) {
        return this.prisma.book.update({
            where: { id },
            data,
        });
    }
}
