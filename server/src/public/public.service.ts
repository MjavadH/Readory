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
                where: { isPublished: true, ratingCount: { gte: 5 } },
                take: 10,
                orderBy: [
                    { ratingAvg: 'desc' },
                    { ratingCount: 'desc' },
                    { updatedAt: 'desc' },
                ],
                select: {
                    id: true,
                    title: true,
                    coverImage: true,
                    type: true,
                    ratingAvg: true,
                    ratingCount: true,
                },
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
                type: b.type,
                ratingAvg: Number(b.ratingAvg),
                ratingCount: b.ratingCount,
            })),
            genres: topGenres
        };

        await this.redis.set(CACHE_KEY, JSON.stringify(response), 'EX', 900);

        return response;
    }

    async getGenresPage() {
        const CACHE_KEY = 'genres_page_data';

        const cached = await this.redis.get(CACHE_KEY);
        if (cached) {
            try {
                return JSON.parse(cached);
            } catch {
                await this.redis.del(CACHE_KEY);
            }
        }

        const featuredGenres = await this.prisma.genre.findMany({
            where: { isFeatured: true },
            orderBy: [{ featuredOrder: 'asc' }, { name: 'asc' }],
            take: 5,
            select: { id: true, name: true, slug: true },
        });

        const featured = await Promise.all(
            featuredGenres.map(async (g) => {
                const books = await this.prisma.book.findMany({
                    where: {
                        isPublished: true,
                        genres: { some: { genreId: g.id } },
                    },
                    orderBy: [{ updatedAt: 'desc' }],
                    take: 6,
                    select: { id: true, title: true, author: true, type: true, ratingAvg: true, ratingCount: true, coverImage: true },
                });

                return { ...g, books };
            }),
        );

        const allGenres = await this.prisma.genre.findMany({
            orderBy: { name: 'asc' },
            select: { id: true, name: true, slug: true },
        });

        const response = { featured, allGenres };

        await this.redis.set(CACHE_KEY, JSON.stringify(response), 'EX', 900);
        return response;
    }

    async clearHomeCache() {
        await this.redis.del('home_content_data');
    }

    async clearGenresPageCache() {
        await this.redis.del('genres_page_data');
    }
}