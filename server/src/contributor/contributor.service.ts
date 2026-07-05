import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateContributorDto } from './dto/create-contributor.dto';
import { UpdateContributorDto } from './dto/update-contributor.dto';
import { CacheManager } from '../cache/cache.manager';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeQ, normalizePagination, paginationMeta, normalizeSlug } from '../common';

@Injectable()
export class ContributorService {
  private readonly CACHE_NAMESPACE = 'contributor';
  private readonly LIST_VERSION_KEY = 'contributor:list:version';

  constructor(
      private readonly prisma: PrismaService,
      private readonly cacheManager: CacheManager,
  ) {}

  async create(createContributorDto: CreateContributorDto) {
    const slug = createContributorDto.slug;

    const existingContributor = await this.prisma.contributor.findUnique({
      where: { slug },
    });
    if (existingContributor) {
      throw new ConflictException('An contributor with this slug already exists.');
    }

    const contributor = await this.prisma.contributor.create({
      data: {
        name: createContributorDto.name,
        originalName: createContributorDto.originalName,
        slug,
        biography: createContributorDto.biography,
        gender: createContributorDto.gender || 'UNKNOWN',
      },
    });

    await this.cacheManager.bumpVersion(this.LIST_VERSION_KEY);
    return contributor;
  }

  async findAll(args: { page: number; limit: number; q?: string }) {
    const { page, limit, q } = args;

    const pagination = normalizePagination(page, limit, 100, 30);
    const normalizedQ = normalizeQ(q);

    const listVersion = await this.cacheManager.getVersion(this.LIST_VERSION_KEY);

    const cacheKey = this.cacheManager.buildKey(
        this.CACHE_NAMESPACE,
        'list',
        listVersion,
        pagination.page,
        pagination.limit,
        normalizedQ || 'all',
    );

    return this.cacheManager.getOrSet(
        cacheKey,
        { ttlSeconds: 1800, earlyRefreshWindowSeconds: 300 },
        async () => {
          const whereCond = normalizedQ
              ? {
                OR: [
                  { name: { contains: normalizedQ, mode: 'insensitive' as const } },
                  { originalName: { contains: normalizedQ, mode: 'insensitive' as const } },
                ],
              }
              : {};

          const [data, total] = await Promise.all([
            this.prisma.contributor.findMany({
              where: whereCond,
              skip: pagination.skip,
              take: pagination.limit,
              orderBy: { createdAt: 'desc' },
            }),
            this.prisma.contributor.count({ where: whereCond }),
          ]);

          return {
            data,
            meta: paginationMeta(total, pagination.page, pagination.limit),
          };
        },
    );
  }

  async findOne(id: number) {
    const cacheKey = this.cacheManager.buildKey(this.CACHE_NAMESPACE, 'detail', id);

    return this.cacheManager.getOrSet(
        cacheKey,
        { ttlSeconds: 86400, earlyRefreshWindowSeconds: 3600 },
        async () => {
          const contributor = await this.prisma.contributor.findUnique({
            where: { id },
          });

          if (!contributor) {
            throw new NotFoundException(`No contributor with ID ${id} was found.`);
          }

          return contributor;
        },
    );
  }

  async getPublicProfile(slug: string, page: number, limit: number) {
    const skip = (page - 1) * limit;

    const version = await this.cacheManager.getVersion(this.LIST_VERSION_KEY);
    const cacheKey = `contributor:public_profile:${version}:${slug}:p${page}:l${limit}`;

    return this.cacheManager.getOrSet(
        cacheKey,
        { ttlSeconds: 900, jitterSeconds: 90, earlyRefreshWindowSeconds: 60 },
        async () => {
          const contributors = await this.prisma.contributor.findUnique({
            where: { slug },
            select: {
              id: true,
              name: true,
              originalName: true,
              slug: true,
              biography: true,
              gender: true,
              bookCount: true,
              updatedAt: true,
            },
          });

          if (!contributors) {
            throw new NotFoundException('The specified contributor was not found.');
          }

          const [totalBooks, books] = await this.prisma.$transaction([
            this.prisma.book.count({
              where: {
                isPublished: true,
                contributors: { some: { contributorId: contributors.id } },
              },
            }),
            this.prisma.book.findMany({
              where: {
                isPublished: true,
                contributors: { some: { contributorId: contributors.id } },
              },
              orderBy: { updatedAt: 'desc' },
              skip,
              take: limit,
              select: {
                id: true,
                title: true,
                coverImage: true,
                ratingAvg: true,
                ratingCount: true,
                type: {select: {name: true, slug: true,},},
                genres: {
                  include: {
                    genre: { select: { id: true, name: true, slug: true } },
                  },
                  take: 2,
                },
                chapterCount: true,
                updatedAt: true,
              },
            }),
          ]);

          return {
            contributors,
            books: books.map((book) => ({
              ...book,
              genres: book.genres.map((g) => g.genre),
            })),
            pagination: {
              total: totalBooks,
              page,
              limit,
              totalPages: Math.max(1, Math.ceil(totalBooks / limit)),
            },
          };
        },
    );
  }

  async update(id: number, updateContributorDto: UpdateContributorDto) {
    await this.findOne(id);

    let newSlug = updateContributorDto.slug;

    if (newSlug) {
      newSlug = normalizeSlug(newSlug);
      const existing = await this.prisma.contributor.findUnique({
        where: { slug: newSlug },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException('An contributor with this slug already exists.');
      }
    }

    const updatedContributor = await this.prisma.contributor.update({
      where: { id },
      data: {
        name: updateContributorDto.name,
        originalName: updateContributorDto.originalName,
        ...(newSlug && { slug: newSlug }),
        biography: updateContributorDto.biography,
        gender: updateContributorDto.gender,
      },
    });

    await Promise.all([
      this.cacheManager.bumpVersion(this.LIST_VERSION_KEY),
      this.cacheManager.del(this.cacheManager.buildKey(this.CACHE_NAMESPACE, 'detail', id)),
    ]);

    return updatedContributor;
  }

  async remove(id: number) {
    await this.findOne(id);

    await this.prisma.contributor.delete({
      where: { id },
    });

    await Promise.all([
      this.cacheManager.bumpVersion(this.LIST_VERSION_KEY),
      this.cacheManager.del(this.cacheManager.buildKey(this.CACHE_NAMESPACE, 'detail', id)),
    ]);

    return { message: 'The contributor was successfully removed.' };
  }
}