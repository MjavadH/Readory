import {ConflictException, Inject, Injectable, NotFoundException} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import Redis from 'ioredis';

function slugify(input: string): string {
    return input
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

@Injectable()
export class GenresService {
    constructor(
        private readonly prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis
    ) {}

    private readonly CACHE_KEY_ALL = 'genres:all';
    private readonly CACHE_KEY_FEATURED = 'genres:featured';

    async listAll() {
        const cached = await this.redis.get(this.CACHE_KEY_ALL);
        if (cached) {
            return JSON.parse(cached);
        }
        const genres = await this.prisma.genre.findMany({
            orderBy: { name: 'asc' },
            include: {
                _count: {
                    select: { books: true }
                }
            }
        });
        await this.redis.set(this.CACHE_KEY_ALL, JSON.stringify(genres), 'EX', 7200);
        return genres;
    }

    private async ensureUniqueSlug(base: string, excludeId?: number) {
        let slug = base;
        let count = 1;
        while (true) {
            const existing = await this.prisma.genre.findUnique({
                where: { slug },
                select: { id: true }
            });
            if (!existing || (excludeId && existing.id === excludeId)) {
                return slug;
            }
            count++;
            slug = `${base}-${count}`;
            if (count > 100) throw new ConflictException('Unable to generate unique slug');
        }
    }

    async listFeatured() {
        const cached = await this.redis.get(this.CACHE_KEY_FEATURED);
        if (cached) {
            return JSON.parse(cached);
        }
        const genres = await this.prisma.genre.findMany({
            where: { isFeatured: true },
            orderBy: [{ featuredOrder: 'asc' }, { name: 'asc' }],
        });
        await this.redis.set(this.CACHE_KEY_FEATURED, JSON.stringify(genres), 'EX', 7200);

        return genres;
    }

    async findBySlug(slug: string) {
        const genre = await this.prisma.genre.findUnique({
            where: { slug },
            include: {
                books: {
                    include: {
                        book: true
                    }
                }
            }
        });
        if (!genre) throw new NotFoundException('Genre not found');

        return {
            id: genre.id,
            name: genre.name,
            slug: genre.slug,
            description: `Browse our collection of ${genre.name} books`,
            books: genre.books.map(bg => bg.book).filter(b => b.isPublished)
        };
    }

    async create(data: { name: string; slug?: string, isFeatured?: boolean, featuredOrder?: number }) {
        const base = data.slug ? data.slug : slugify(data.name);
        const slug = await this.ensureUniqueSlug(base);

        try {
            const genre = await this.prisma.genre.create({
                data: {
                    name: data.name,
                    slug,
                    isFeatured: data.isFeatured ?? false,
                    featuredOrder: data.featuredOrder ?? 0,
                },
            });
            await this.invalidateCache();
            return genre;
        } catch (err: any) {
            if (err?.code === 'P2002') throw new ConflictException('Genre already exists');
            throw err;
        }
    }

    async update(id: number, data: { name?: string; slug?: string, isFeatured?: boolean, featuredOrder?: number }) {
        const existing = await this.prisma.genre.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException('Genre not found');
        let slug = existing.slug;

        if (data.slug || (data.name && data.name !== existing.name)) {
            const nextName = data.name ?? existing.name;
            const base = data.slug ? data.slug : slugify(nextName);
            slug = await this.ensureUniqueSlug(base, id);
        }

        try {
            const updatedGenre = await this.prisma.genre.update({
                where: { id },
                data: {
                    name: data.name,
                    slug,
                    featuredOrder: data.featuredOrder,
                    isFeatured: data.isFeatured,
                }
            });

            await this.invalidateCache();
            return updatedGenre;
        } catch (err: any) {
            if (err?.code === 'P2002') throw new ConflictException('Genre name or slug already exists');
            throw err;
        }
    }

    async delete(id: number) {
        const existing = await this.prisma.genre.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException('Genre not found');

        await this.prisma.genre.delete({ where: { id } });
        await this.invalidateCache();
        return { id, deleted: true };
    }

    private async invalidateCache() {
        await this.redis.del(this.CACHE_KEY_ALL);
        await this.redis.del(this.CACHE_KEY_FEATURED);
    }
}
