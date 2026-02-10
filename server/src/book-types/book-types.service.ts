import type { IconKey } from '../../../shared/icon-keys';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

function slugify(input: string): string {
    return input
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

@Injectable()
export class BookTypesService {
    constructor(private readonly prisma: PrismaService) {}

    async listAdmin() {
        return this.prisma.bookType.findMany({
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
            select: {
                id: true,
                name: true,
                slug: true,
                iconKey: true,
                isActive: true,
                sortOrder: true,
            },
        });
    }

    async listPublic() {
        return this.prisma.bookType.findMany({
            where: { isActive: true },
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
            select: {
                name: true,
                slug: true,
                iconKey: true,
            },
        });
    }

    async findByType(type: string) {
        const slug = slugify(type);
        if (!slug) {
            throw new NotFoundException('book type not found');
        }
        const bookType = await this.prisma.bookType.findUnique({
            where: { slug },
        });
        if (!bookType) {
            throw new NotFoundException('book type not found');
        }
        return this.prisma.book.findMany({
            where: {
                typeId: bookType.id,
                isPublished: true
            },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                title: true,
                coverImage: true,
                author: true,
                type: { select: { id: true, name: true, slug: true } },
            },
        });
    }

    async create(dto: { name: string; slug?: string; iconKey?: IconKey | null; isActive?: boolean; sortOrder?: number }) {
        const slug = dto.slug?.trim() || slugify(dto.name);
        if (!slug) throw new BadRequestException('slug is invalid');

        try {
            return await this.prisma.bookType.create({
                data: {
                    name: dto.name.trim(),
                    slug,
                    iconKey: dto.iconKey ?? null,
                    isActive: dto.isActive ?? true,
                    sortOrder: dto.sortOrder ?? 0,
                },
                select: { id: true, name: true, slug: true, iconKey: true, isActive: true, sortOrder: true },
            });
        } catch (e: any) {
            if (e?.code === 'P2002') throw new BadRequestException('slug already exists');
            throw e;
        }
    }

    async update(id: number, dto: { name?: string; slug?: string; iconKey?: IconKey | null; isActive?: boolean; sortOrder?: number }) {
        const exists = await this.prisma.bookType.findUnique({ where: { id }, select: { id: true } });
        if (!exists) throw new NotFoundException('book type not found');

        const data: any = {};
        if (dto.name !== undefined) data.name = dto.name.trim();
        if (dto.slug !== undefined) data.slug = dto.slug.trim();
        if (dto.iconKey !== undefined) data.iconKey = dto.iconKey;
        if (dto.isActive !== undefined) data.isActive = dto.isActive;
        if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;

        try {
            return await this.prisma.bookType.update({
                where: { id },
                data,
                select: { id: true, name: true, slug: true, iconKey: true, isActive: true, sortOrder: true },
            });
        } catch (e: any) {
            if (e?.code === 'P2002') throw new BadRequestException('slug already exists');
            throw e;
        }
    }

    async remove(id: number) {
        const type = await this.prisma.bookType.findUnique({
            where: { id },
            select: { id: true },
        });
        if (!type) throw new NotFoundException('book type not found');

        // Safe delete rule:
        // If any books exist -> deactivate instead of hard delete
        const booksCount = await this.prisma.book.count({ where: { typeId: id } });

        if (booksCount > 0) {
            await this.prisma.bookType.update({
                where: { id },
                data: { isActive: false },
                select: { id: true },
            });
            return { id, deleted: false, deactivated: true };
        }

        await this.prisma.bookType.delete({ where: { id } });
        return { id, deleted: true, deactivated: false };
    }
}
