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