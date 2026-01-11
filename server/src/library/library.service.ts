import {Inject, Injectable} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import Redis from 'ioredis';

@Injectable()
export class LibraryService {
    constructor(
        private readonly prisma: PrismaService,
        @Inject('REDIS_CLIENT') private readonly redis: Redis
    ) {}

    async getLibrary(userId: number) {
        const chapterAccess = this.prisma.accessRecord.findMany({
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
            })

        return chapterAccess;
    }
}
