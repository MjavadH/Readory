import { forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CollectionType, CollectionVisibility } from '@prisma/client';
import { PublicationStatus } from '@readory/shared';
import { BooksService } from '../books/books.service';
import type { CacheManager } from '../cache/cache.manager';
import type { DashboardService } from '../dashboard/dashboard.service';
import type { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PublicService {
  constructor(
    private prisma: PrismaService,
    private readonly cacheManager: CacheManager,
    private readonly dashboardService: DashboardService,
    @Inject(forwardRef(() => BooksService))
    private readonly bookService: BooksService,
  ) {}

  private readonly CACHE_KEY_HOME_PUBLIC_CONTENT = 'home_public_content_data';
  private readonly CACHE_KEY_HOME_PERSONALIZED_CONTENT = 'home_personalized_content';
  private readonly CACHE_KEY_GENRES_PAGE = 'genres_page_data';
  private readonly CACHE_KEY_PUBLIC_PROFILE_VERSION = 'public_profile:version';

  async getPublicUserProfile(username: string, viewerId?: number) {
    const normalizedUsername = username.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { username: normalizedUsername, isBanned: false },
      select: {
        id: true,
        username: true,
        showMemberSince: true,
        showFavorites: true,
        showRecentRatings: true,
        showRecentlyReading: true,
      },
    });
    if (!user) throw new NotFoundException('profile not found');

    const isOwner = Boolean(viewerId && viewerId === user.id);
    const version = await this.cacheManager.getVersion(
      this.cacheManager.buildKey(this.CACHE_KEY_PUBLIC_PROFILE_VERSION, user.id),
    );
    const cacheKey = this.cacheManager.buildKey('public_profile', user.id, version);

    const publicProfile = await this.cacheManager.getOrSet(
      cacheKey,
      { ttlSeconds: 300, jitterSeconds: 30, earlyRefreshWindowSeconds: 60 },
      async () => {
        const profile = await this.prisma.user.findUnique({
          where: { id: user.id },
          select: {
            id: true,
            username: true,
            createdAt: true,
            avatarKey: true,
            showMemberSince: true,
            showFavorites: true,
            showRecentRatings: true,
            showRecentlyReading: true,
          },
        });
        if (!profile) throw new NotFoundException('profile not found');

        const shouldLoadFavorites = profile.showFavorites;
        const shouldLoadRatings = profile.showRecentRatings;
        const shouldLoadReading = profile.showRecentlyReading;

        const [collections, favoriteBooks, recentRatings, recentlyReading] = await Promise.all([
          this.prisma.collection.findMany({
            where: {
              ownerId: profile.id,
              type: CollectionType.USER,
              visibility: CollectionVisibility.PUBLIC,
            },
            orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
            take: 8,
            select: {
              id: true,
              title: true,
              slug: true,
              description: true,
              bookCount: true,
              updatedAt: true,
              items: {
                where: { book: { publishStatus: PublicationStatus.PUBLISHED } },
                orderBy: { position: 'asc' },
                take: 4,
                select: { book: { select: this.publicBookSelect() } },
              },
            },
          }),
          shouldLoadFavorites ? this.getFavoriteBooks(profile.id) : Promise.resolve([]),
          shouldLoadRatings ? this.getRecentRatings(profile.id) : Promise.resolve([]),
          shouldLoadReading ? this.getRecentlyReading(profile.id) : Promise.resolve([]),
        ]);

        return {
          user: {
            id: profile.id,
            username: profile.username,
            avatarKey: profile.avatarKey,
            memberSince: profile.showMemberSince ? profile.createdAt.toISOString() : null,
          },
          sections: {
            collections: collections.map((collection) => ({
              ...collection,
              updatedAt: collection.updatedAt.toISOString(),
              previewBooks: collection.items.map((item) => this.serializePublicBook(item.book)),
              items: undefined,
            })),
            favoriteBooks: shouldLoadFavorites ? favoriteBooks : undefined,
            recentRatings: shouldLoadRatings ? recentRatings : undefined,
            recentlyReading: shouldLoadReading ? recentlyReading : undefined,
          },
        };
      },
    );

    return {
      ...publicProfile,
      viewer: {
        isOwner,
        settings: isOwner
          ? {
              showMemberSince: user.showMemberSince,
              showFavorites: user.showFavorites,
              showRecentRatings: user.showRecentRatings,
              showRecentlyReading: user.showRecentlyReading,
            }
          : undefined,
      },
    };
  }

  private publicBookSelect() {
    return {
      id: true,
      title: true,
      coverImage: true,
      ratingAvg: true,
      ratingCount: true,
      updatedAt: true,
      chapterCount: true,
      type: {
        select: {
          id: true,
          name: true,
          slug: true,
          iconKey: true,
          isActive: true,
          sortOrder: true,
        },
      },
      genres: { take: 3, select: { genre: { select: { name: true, slug: true, iconKey: true } } } },
      contributors: { select: { role: true, contributor: { select: { name: true } } } },
    } as const;
  }

  private async getFavoriteBooks(userId: number) {
    const favorite = await this.prisma.collection.findFirst({
      where: { ownerId: userId, type: CollectionType.FAVORITES },
      select: {
        items: {
          where: { book: { publishStatus: PublicationStatus.PUBLISHED } },
          orderBy: { addedAt: 'desc' },
          take: 6,
          select: { book: { select: this.publicBookSelect() } },
        },
      },
    });
    return favorite?.items.map((item) => this.serializePublicBook(item.book)) ?? [];
  }

  private async getRecentRatings(userId: number) {
    const ratings = await this.prisma.bookRating.findMany({
      where: { userId, book: { publishStatus: PublicationStatus.PUBLISHED } },
      orderBy: { updatedAt: 'desc' },
      take: 6,
      select: { rating: true, updatedAt: true, book: { select: this.publicBookSelect() } },
    });
    return ratings.map((rating) => ({
      rating: rating.rating,
      ratedAt: rating.updatedAt.toISOString(),
      book: this.serializePublicBook(rating.book),
    }));
  }

  private async getRecentlyReading(userId: number) {
    const rows = await this.prisma.readingProgress.findMany({
      where: { userId, book: { publishStatus: PublicationStatus.PUBLISHED } },
      orderBy: { updatedAt: 'desc' },
      take: 6,
      distinct: ['bookId'],
      select: { percent: true, updatedAt: true, book: { select: this.publicBookSelect() } },
    });

    return rows.map((row) => ({
      percent: row.percent,
      lastReadAt: row.updatedAt.toISOString(),
      book: this.serializePublicBook(row.book),
    }));
  }

  private serializePublicBook(book: any) {
    const mainContributor =
      book.contributors.find((a: any) => a.role === 'AUTHOR') ?? book.contributors[0];
    return {
      id: book.id,
      title: book.title,
      contributors: mainContributor ? mainContributor.contributor.name : null,
      genres: book.genres.map((g: any) => g.genre),
      coverImage: book.coverImage,
      ratingAvg: Number(book.ratingAvg),
      ratingCount: book.ratingCount,
      updatedAt: book.updatedAt.toISOString(),
      type: book.type,
    };
  }

  async getPublicHomeContent() {
    return this.cacheManager.getOrSet(
      this.CACHE_KEY_HOME_PUBLIC_CONTENT,
      { ttlSeconds: 900, jitterSeconds: 90, earlyRefreshWindowSeconds: 60 },
      async () => {
        const [featuredBooks, latestUpdates, trendingBooks, topGenres, popularBooks] =
          await Promise.all([
            this.getFeaturedBooks(),
            this.getLatestBooks(),
            this.getTrendingBooks(),
            this.getTopGenres(),
            this.bookService.getPopularBooks(10),
          ]);

        return {
          hero: featuredBooks.map((b) => {
            const mainContributor =
              b.contributors.find((a) => a.role === 'AUTHOR') || b.contributors[0];
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
              title: c.title,
              free: c.isFree,
            })),
          })),
          trending: trendingBooks.map((b) => {
            const mainContributor =
              b.contributors.find((a) => a.role === 'AUTHOR') || b.contributors[0];
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
          popular: popularBooks,
          genres: topGenres,
        };
      },
    );
  }

  async getUserPersonalizedContent(userId: number) {
    const cacheKey = this.cacheManager.buildKey(this.CACHE_KEY_HOME_PERSONALIZED_CONTENT, userId);
    return this.cacheManager.getOrSet(
      cacheKey,
      { ttlSeconds: 300, jitterSeconds: 30, earlyRefreshWindowSeconds: 60 },
      async () => {
        const continueReading = await this.dashboardService.getContinueReading(userId);
        return {
          continueReading,
        };
      },
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
            title: true,
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
        trendScore: 'desc',
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
              const mainContributor =
                b.contributors.find((a) => a.role === 'AUTHOR') || b.contributors[0];
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
