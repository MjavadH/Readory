import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateAuthorDto } from './dto/create-author.dto';
import { UpdateAuthorDto } from './dto/update-author.dto';
import { CacheManager } from '../cache/cache.manager';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeQ, normalizePagination, paginationMeta, normalizeSlug } from '../common';

@Injectable()
export class AuthorService {
  private readonly CACHE_NAMESPACE = 'author';
  private readonly LIST_VERSION_KEY = 'author:list:version';

  constructor(
      private readonly prisma: PrismaService,
      private readonly cacheManager: CacheManager,
  ) {}

  async create(createAuthorDto: CreateAuthorDto) {
    const slug = createAuthorDto.slug;

    const existingAuthor = await this.prisma.author.findUnique({
      where: { slug },
    });
    if (existingAuthor) {
      throw new ConflictException('An author with this slug already exists.');
    }

    const author = await this.prisma.author.create({
      data: {
        name: createAuthorDto.name,
        originalName: createAuthorDto.originalName,
        slug,
        biography: createAuthorDto.biography,
        gender: createAuthorDto.gender || 'UNKNOWN',
      },
    });

    await this.cacheManager.bumpVersion(this.LIST_VERSION_KEY);
    return author;
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
            this.prisma.author.findMany({
              where: whereCond,
              skip: pagination.skip,
              take: pagination.limit,
              orderBy: { createdAt: 'desc' },
            }),
            this.prisma.author.count({ where: whereCond }),
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
          const author = await this.prisma.author.findUnique({
            where: { id },
          });

          if (!author) {
            throw new NotFoundException(`No author with ID ${id} was found.`);
          }

          return author;
        },
    );
  }

  async getPublicProfile(slug: string, page: number, limit: number) {
    const skip = (page - 1) * limit;

    const version = await this.cacheManager.getVersion(this.LIST_VERSION_KEY);
    const cacheKey = `author:public_profile:${version}:${slug}:p${page}:l${limit}`;

    return this.cacheManager.getOrSet(
        cacheKey,
        { ttlSeconds: 900, jitterSeconds: 90, earlyRefreshWindowSeconds: 60 },
        async () => {
          const author = await this.prisma.author.findUnique({
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

          if (!author) {
            throw new NotFoundException('The specified author was not found.');
          }

          const [totalBooks, books] = await this.prisma.$transaction([
            this.prisma.book.count({
              where: {
                isPublished: true,
                authors: { some: { authorId: author.id } },
              },
            }),
            this.prisma.book.findMany({
              where: {
                isPublished: true,
                authors: { some: { authorId: author.id } },
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
            author,
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

  async update(id: number, updateAuthorDto: UpdateAuthorDto) {
    await this.findOne(id);

    let newSlug = updateAuthorDto.slug;

    if (newSlug) {
      newSlug = normalizeSlug(newSlug);
      const existing = await this.prisma.author.findUnique({
        where: { slug: newSlug },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException('An author with this slug already exists.');
      }
    }

    const updatedAuthor = await this.prisma.author.update({
      where: { id },
      data: {
        name: updateAuthorDto.name,
        originalName: updateAuthorDto.originalName,
        ...(newSlug && { slug: newSlug }),
        biography: updateAuthorDto.biography,
        gender: updateAuthorDto.gender,
      },
    });

    await Promise.all([
      this.cacheManager.bumpVersion(this.LIST_VERSION_KEY),
      this.cacheManager.del(this.cacheManager.buildKey(this.CACHE_NAMESPACE, 'detail', id)),
    ]);

    return updatedAuthor;
  }

  async remove(id: number) {
    await this.findOne(id);

    await this.prisma.author.delete({
      where: { id },
    });

    await Promise.all([
      this.cacheManager.bumpVersion(this.LIST_VERSION_KEY),
      this.cacheManager.del(this.cacheManager.buildKey(this.CACHE_NAMESPACE, 'detail', id)),
    ]);

    return { message: 'The author was successfully removed.' };
  }
}