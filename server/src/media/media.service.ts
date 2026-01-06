import { ConflictException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';

@Injectable()
export class MediaService {
    constructor(private prisma: PrismaService) {}

    async createRecord(params: {
        code: string;
        filename: string;
        storageKey: string;
        mimeType: string;
        size: number;
    }) {
        try {
            return await this.prisma.media.create({ data: params });
        } catch (e) {
            throw new InternalServerErrorException('Failed to create media record');
        }
    }

    async list(query?: string) {
        const q = query?.trim();
        return this.prisma.media.findMany({
            where: q
                ? {
                    filename: { contains: q, mode: 'insensitive' },
                }
                : undefined,
            orderBy: { createdAt: 'desc' },
        });
    }

    async getFileStream(code: string) {
        const record = await this.prisma.media.findUnique({ where: { code } });
        if (!record) throw new NotFoundException('File not found');
        const filePath = path.join(process.cwd(), 'uploads', record.storageKey);
        if (!fs.existsSync(filePath)) throw new NotFoundException('File not found');
        return { record, stream: fs.createReadStream(filePath) };
    }

    async getThumbnailStream(code: string) {
        const record = await this.prisma.media.findUnique({ where: { code } });
        if (!record) throw new NotFoundException('File not found');

        const filePath = path.join(process.cwd(), 'uploads', record.storageKey);
        if (!fs.existsSync(filePath)) throw new NotFoundException('File not found');

        const stream = fs.createReadStream(filePath).pipe(
            sharp()
                .resize({ width: 300, withoutEnlargement: true })
                .webp({ quality: 80 })
        );
        return { record, stream };
    }

    async renameByCode(code: string, filename: string) {
        const record = await this.prisma.media.findUnique({ where: { code } });
        if (!record) throw new NotFoundException('Media not found');

        try {
            return await this.prisma.media.update({
                where: { code },
                data: { filename },
            });
        } catch (err: any) {
            if (err?.code === 'P2002') {
                throw new ConflictException('Filename already exists');
            }
            throw new InternalServerErrorException('Failed to rename media');
        }
    }

    async deleteByCode(code: string) {
        const record = await this.prisma.media.findUnique({ where: { code } });
        if (!record) throw new NotFoundException('Media not found');

        await this.prisma.media.delete({ where: { code } });

        const filePath = path.join(process.cwd(), 'uploads', record.storageKey);
        try {
            await fs.promises.unlink(filePath);
        } catch (err: any) {
            if (err?.code !== 'ENOENT') {
                // If you want strict behavior, you can throw here.
            }
        }
        return { code, deleted: true };
    }
}
