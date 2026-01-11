import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import Redis from 'ioredis';

@Injectable()
export class PublicService {
    private readonly logger = new Logger(PublicService.name);

    constructor(
        private prisma: PrismaService,
        @Inject('REDIS_CLIENT') private readonly redis: Redis,
    ) {}

    async getHomeContent() {
        const CACHE_KEY = 'home_content_data';

        const cachedData = await this.redis.get(CACHE_KEY);
        if (cachedData) {
            try {
                return JSON.parse(cachedData);
            } catch {
                await this.redis.del(CACHE_KEY);
            }
        }

        const [featuredBooks, latestUpdates, trendingBooks, topGenres] = await Promise.all([

            // Featured Books (Hero Slider)
            this.prisma.book.findMany({
                where: { isPublished: true, isFeatured: true },
                take: 5,
                orderBy: { updatedAt: 'desc' },
                select: {
                    id: true,
                    title: true,
                    description: true,
                    coverImage: true,
                    type: true,
                    genres: {
                        select: { genre: { select: { name: true } } },
                        take: 3
                    }
                },
            }),

            // Latest Updates (Grid)
            this.prisma.book.findMany({
                where: { isPublished: true },
                take: 12,
                orderBy: { updatedAt: 'desc' },
                select: {
                    id: true,
                    title: true,
                    coverImage: true,
                    updatedAt: true,
                    type: true,
                    chapters: {
                        take: 2,
                        orderBy: { index: 'desc' },
                        select: {
                            id: true,
                            index: true,
                            isFree: true
                        }
                    }
                }
            }),

            // Trending
            this.prisma.book.findMany({
                where: { isPublished: true },
                take: 10,
                select: {
                    id: true,
                    title: true,
                    coverImage: true,
                    type: true,
                }
            }),

            // Top Genres
            this.prisma.genre.findMany({
                take: 8,
                orderBy: { books: { _count: 'desc' } },
                select: {
                    id: true,
                    name: true,
                    slug: true
                }
            })
        ]);

        // (Flat & Clean)
        const response = {
            hero: featuredBooks.map(b => ({
                id: b.id,
                title: b.title,
                desc: b.description ? b.description.substring(0, 100) + '...' : '',
                cover: b.coverImage,
                type: b.type,
                genres: b.genres.map(g => g.genre.name)
            })),
            latest: latestUpdates.map(b => ({
                id: b.id,
                title: b.title,
                cover: b.coverImage,
                time: b.updatedAt,
                type: b.type,
                chapters: b.chapters.map(c => ({
                    id: c.id,
                    num: c.index,
                    free: c.isFree
                }))
            })),
            trending: trendingBooks.map(b => ({
                id: b.id,
                title: b.title,
                cover: b.coverImage,
                type: b.type
            })),
            genres: topGenres
        };

        await this.redis.set(CACHE_KEY, JSON.stringify(response), 'EX', 900);

        return response;
    }

    async clearHomeCache() {
        await this.redis.del('home_content_data');
    }
}