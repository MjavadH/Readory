import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheManager } from '../cache/cache.manager';

@Injectable()
export class PublicService {
    constructor(
        private prisma: PrismaService,
        private readonly cacheManager: CacheManager,
    ) {}

    private readonly CACHE_KEY_HOME_CONTENT = 'home_content_data';
    private readonly CACHE_KEY_GENRES_PAGE = 'genres_page_data';

    async getHomeContent() {
        return this.cacheManager.getOrSet(
            this.CACHE_KEY_HOME_CONTENT,
            { ttlSeconds: 900, jitterSeconds: 90, earlyRefreshWindowSeconds: 60 },
            async () => {
                const [featuredBooks, latestUpdates, trendingBooks, topGenres] = await Promise.all([
                    this.prisma.book.findMany({
                        where: { isPublished: true, isFeatured: true },
                        take: 5,
                        orderBy: { updatedAt: 'desc' },
                        select: {
                            id: true,
                            title: true,
                            description: true,
                            coverImage: true,
                            author: true,
                            type: { select: { name: true, slug: true, iconKey: true } },
                            genres: {
                                select: { genre: { select: { name: true, slug: true, iconKey: true } } },
                                take: 3,
                            },
                            ratingAvg: true,
                            ratingCount: true,
                        },
                    }),
                    this.prisma.book.findMany({
                        where: { isPublished: true },
                        take: 12,
                        orderBy: { updatedAt: 'desc' },
                        select: {
                            id: true,
                            title: true,
                            coverImage: true,
                            updatedAt: true,
                            type: { select: { id: true, name: true, slug: true } },
                            chapters: {
                                take: 2,
                                orderBy: { index: 'desc' },
                                select: {
                                    id: true,
                                    index: true,
                                    isFree: true,
                                },
                            },
                        },
                    }),
                    this.prisma.book.findMany({
                        where: { isPublished: true, ratingCount: { gte: 5 } },
                        take: 10,
                        orderBy: [{ ratingAvg: 'desc' }, { ratingCount: 'desc' }, { updatedAt: 'desc' }],
                        select: {
                            id: true,
                            title: true,
                            coverImage: true,
                            type: { select: { id: true, name: true, slug: true } },
                            ratingAvg: true,
                            ratingCount: true,
                        },
                    }),
                    this.prisma.genre.findMany({
                        take: 8,
                        orderBy: { books: { _count: 'desc' } },
                        select: {
                            id: true,
                            name: true,
                            slug: true,
                            iconKey: true,
                        },
                    }),
                ]);

                return {
                    hero: featuredBooks.map((b) => ({
                        id: b.id,
                        title: b.title,
                        description: b.description ? `${b.description.substring(0, 200)}...` : '',
                        coverImage: b.coverImage,
                        type: b.type,
                        genres: b.genres.map((g) => g.genre),
                        author: b.author,
                        ratingAvg: b.ratingAvg,
                        ratingCount: b.ratingCount,
                    })),
                    latest: latestUpdates.map((b) => ({
                        id: b.id,
                        title: b.title,
                        cover: b.coverImage,
                        time: b.updatedAt,
                        type: b.type,
                        chapters: b.chapters.map((c) => ({
                            id: c.id,
                            num: c.index,
                            free: c.isFree,
                        })),
                    })),
                    trending: trendingBooks.map((b) => ({
                        id: b.id,
                        title: b.title,
                        coverImage: b.coverImage,
                        type: b.type,
                        ratingAvg: Number(b.ratingAvg),
                        ratingCount: b.ratingCount,
                    })),
                    genres: topGenres,
                };
            },
        );
    }

    async getGenresPage() {
        return this.cacheManager.getOrSet(
            this.CACHE_KEY_GENRES_PAGE,
            { ttlSeconds: 900, jitterSeconds: 90, earlyRefreshWindowSeconds: 60 },
            async () => {
                const featuredGenres = await this.prisma.genre.findMany({
                    where: { isFeatured: true },
                    orderBy: [{ featuredOrder: 'asc' }, { name: 'asc' }],
                    take: 5,
                    select: { id: true, name: true, slug: true, iconKey: true },
                });

                const featured = await Promise.all(
                    featuredGenres.map(async (g) => {
                        const books = await this.prisma.book.findMany({
                            where: {
                                isPublished: true,
                                genres: { some: { genreId: g.id } },
                                type: { isActive: true },
                            },
                            orderBy: [{ updatedAt: 'desc' }],
                            take: 6,
                            select: {
                                id: true,
                                title: true,
                                author: true,
                                type: { select: { id: true, name: true, slug: true } },
                                ratingAvg: true,
                                ratingCount: true,
                                coverImage: true,
                            },
                        });

                        return { ...g, books };
                    }),
                );

                const allGenres = await this.prisma.genre.findMany({
                    orderBy: { name: 'asc' },
                    select: { id: true, name: true, slug: true, iconKey: true },
                });

                return { featured, allGenres };
            },
        );
    }

    async clearHomeCache() {
        await this.cacheManager.del(this.CACHE_KEY_HOME_CONTENT);
    }

    async clearGenresPageCache() {
        await this.cacheManager.del(this.CACHE_KEY_GENRES_PAGE);
    }
}
