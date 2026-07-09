import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheManager } from '../cache/cache.manager';
import {DashboardService} from "../dashboard/dashboard.service";
import {PublicationStatus} from "@readory/shared";

@Injectable()
export class PublicService {
    constructor(
        private prisma: PrismaService,
        private readonly cacheManager: CacheManager,
        private readonly dashboardService: DashboardService
    ) {}

    private readonly CACHE_KEY_HOME_PUBLIC_CONTENT = 'home_public_content_data';
    private readonly CACHE_KEY_HOME_PERSONALIZED_CONTENT = 'home_personalized_content';
    private readonly CACHE_KEY_GENRES_PAGE = 'genres_page_data';

    async getPublicHomeContent(){
        return this.cacheManager.getOrSet(
            this.CACHE_KEY_HOME_PUBLIC_CONTENT,
            { ttlSeconds: 900, jitterSeconds: 90, earlyRefreshWindowSeconds: 60 },
            async () => {
                const [
                    featuredBooks,
                    latestUpdates,
                    trendingBooks,
                    topGenres,
                    popularBooks
                ] = await Promise.all([
                    this.getFeaturedBooks(),
                    this.getLatestBooks(),
                    this.getTrendingBooks(),
                    this.getTopGenres(),
                    this.getPopularBooks()
                ]);

                return {
                    hero: featuredBooks.map((b) => {
                        const mainContributor = b.contributors.find((a) => a.role === 'AUTHOR') || b.contributors[0];
                        return {
                            id: b.id,
                            title: b.title,
                            description: b.description ? `${b.description.substring(0, 200)}...` : '',
                            coverImage: b.coverImage,
                            type: b.type,
                            genres: b.genres.map((g) => g.genre),
                            contributors: mainContributor ? mainContributor.contributor.name : null,
                            ratingAvg: b.ratingAvg,
                            ratingCount: b.ratingCount,
                        };
                    }),
                    latest: latestUpdates.map((b) => ({
                        id: b.id,
                        title: b.title,
                        cover: b.coverImage,
                        time: b.lastContentUpdate ?? b.updatedAt,
                        type: b.type,
                        chapters: b.chapters.map((c) => ({
                            id: c.id,
                            num: c.index,
                            free: c.isFree,
                        })),
                    })),
                    trending: trendingBooks.map((b) => {
                        const mainContributor = b.contributors.find((a) => a.role === 'AUTHOR') || b.contributors[0];
                        return {
                            id: b.id,
                            title: b.title,
                            contributors: mainContributor ? mainContributor.contributor.name : null,
                            coverImage: b.coverImage,
                            type: b.type,
                            genres: b.genres.map((g) => g.genre),
                            chapterCount: b.chapterCount,
                            ratingAvg: Number(b.ratingAvg),
                            ratingCount: b.ratingCount,
                        };
                    }),
                    popular: popularBooks.map((b) => {
                        const mainContributor = b.contributors.find((a) => a.role === 'AUTHOR') || b.contributors[0];
                        return {
                            id: b.id,
                            title: b.title,
                            contributors: mainContributor ? mainContributor.contributor.name : null,
                            coverImage: b.coverImage,
                            type: b.type,
                            genres: b.genres.map((g) => g.genre),
                            chapterCount: b.chapterCount,
                            ratingAvg: Number(b.ratingAvg),
                            ratingCount: b.ratingCount,
                        };
                    }),
                    genres: topGenres,
                };
            }
        );
    }

    async getUserPersonalizedContent(userId:number){
        const cacheKey =
            this.cacheManager.buildKey(
                this.CACHE_KEY_HOME_PERSONALIZED_CONTENT,
                userId
            );
        return this.cacheManager.getOrSet(
            cacheKey,
            { ttlSeconds: 300, jitterSeconds: 30, earlyRefreshWindowSeconds: 60},
            async()=>{
                const continueReading =
                    await this.dashboardService
                        .getContinueReading(userId);
                return {
                    continueReading,
                };
            }
        );
    }

    private async getFeaturedBooks() {
        return this.prisma.book.findMany({
            where: {
                publishStatus: PublicationStatus.PUBLISHED,
                isFeatured: true,
            },
            take: 5,
            orderBy: {
                updatedAt: 'desc',
            },
            select: {
                id: true,
                title: true,
                description: true,
                coverImage: true,

                contributors: {
                    select: {
                        role: true,
                        contributor: {
                            select: {
                                name: true,
                            },
                        },
                    },
                },

                type: {
                    select: {
                        name: true,
                        slug: true,
                        iconKey: true,
                    },
                },

                genres: {
                    take: 3,
                    select: {
                        genre: {
                            select: {
                                name: true,
                                slug: true,
                                iconKey: true,
                            },
                        },
                    },
                },

                ratingAvg: true,
                ratingCount: true,
            },
        });
    }

    private async getLatestBooks() {
        return this.prisma.book.findMany({
            where: {
                publishStatus: PublicationStatus.PUBLISHED,
            },

            take: 12,

            orderBy: {
                lastContentUpdate: 'desc',
            },

            select: {
                id: true,
                title: true,
                coverImage: true,

                updatedAt: true,
                lastContentUpdate: true,

                type: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                    },
                },

                chapters: {
                    where: { publishStatus: PublicationStatus.PUBLISHED },
                    take: 2,
                    orderBy: {
                        index: 'desc',
                    },
                    select: {
                        id: true,
                        index: true,
                        isFree: true,
                    },
                },
            },
        });
    }

    private async getTrendingBooks() {
        return this.prisma.book.findMany({
            where: {
                publishStatus: PublicationStatus.PUBLISHED,
            },

            take: 10,

            orderBy: {
                popularityScore: 'desc',
            },

            select: {
                id: true,
                title: true,
                coverImage: true,

                contributors: {
                    select: {
                        role: true,
                        contributor: {
                            select: {
                                name: true,
                            },
                        },
                    },
                },

                type: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                    },
                },

                chapterCount: true,

                genres: {
                    select: {
                        genre: {
                            select: {
                                id: true,
                                name: true,
                                slug: true,
                            },
                        },
                    },
                },

                ratingAvg: true,
                ratingCount: true,
            },
        });
    }

    private async getTopGenres() {
        return this.prisma.genre.findMany({
            take: 8,

            orderBy: {
                books: {
                    _count: 'desc',
                },
            },

            select: {
                id: true,
                name: true,
                slug: true,
                iconKey: true,
            },
        });
    }

    private async getPopularBooks() {
        return this.prisma.book.findMany({
            where: {
                publishStatus: PublicationStatus.PUBLISHED,
                ratingCount: {
                    gte: 5,
                },
            },

            take: 10,

            orderBy: [
                {
                    ratingAvg: 'desc',
                },
                {
                    ratingCount: 'desc',
                },
                {
                    updatedAt: 'desc',
                },
            ],

            select: {
                id: true,
                title: true,
                coverImage: true,

                contributors: {
                    select: {
                        role: true,
                        contributor: {
                            select: {
                                name: true,
                            },
                        },
                    },
                },

                type: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                    },
                },

                chapterCount: true,

                genres: {
                    select: {
                        genre: {
                            select: {
                                id: true,
                                name: true,
                                slug: true,
                            },
                        },
                    },
                },

                ratingAvg: true,
                ratingCount: true,
            },
        });
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
                                publishStatus: PublicationStatus.PUBLISHED,
                                genres: { some: { genreId: g.id } },
                                type: { isActive: true },
                            },
                            orderBy: [{ lastContentUpdate: 'desc' }],
                            take: 6,
                            select: {
                                id: true,
                                title: true,
                                type: { select: { id: true, name: true, slug: true } },
                                ratingAvg: true,
                                ratingCount: true,
                                coverImage: true,
                                contributors: {
                                    select: {
                                        role: true,
                                        contributor: { select: { name: true } },
                                    },
                                },
                            },
                        });

                        const formattedBooks = books.map((b) => {
                            const mainContributor = b.contributors.find((a) => a.role === 'AUTHOR') || b.contributors[0];
                            return {
                                id: b.id,
                                title: b.title,
                                type: b.type,
                                ratingAvg: b.ratingAvg,
                                ratingCount: b.ratingCount,
                                coverImage: b.coverImage,
                                contributors: mainContributor ? mainContributor.contributor.name : null,
                            };
                        });

                        return { ...g, books: formattedBooks };
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
        await this.cacheManager.del(this.CACHE_KEY_HOME_PUBLIC_CONTENT);
    }

    async clearGenresPageCache() {
        await this.cacheManager.del(this.CACHE_KEY_GENRES_PAGE);
    }
}
