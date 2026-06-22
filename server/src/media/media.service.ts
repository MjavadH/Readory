import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { Readable } from 'stream';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(private prisma: PrismaService) {}

  private uploadsDir() {
    return path.join(process.cwd(), 'uploads');
  }

  private thumbsDir() {
    return path.join(this.uploadsDir(), 'thumbnails');
  }

  private async ensureDirs() {
    await fs.promises.mkdir(this.uploadsDir(), { recursive: true });
    await fs.promises.mkdir(this.thumbsDir(), { recursive: true });
  }

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
      this.logger.error(
        `Failed to create media record: ${(e as Error).message}`,
        (e as Error).stack,
      );
      throw new InternalServerErrorException('Failed to create media record');
    }
  }

  async listPaged(params: { q?: string; page: number; limit: number }) {
    const q = params.q?.trim();
    const page = Number.isFinite(params.page) ? Math.max(1, params.page) : 1;
    const limitRaw = Number.isFinite(params.limit) ? params.limit : 50;
    const limit = Math.min(Math.max(1, limitRaw), 100); // hard cap for safety

    const where = q
      ? {
          filename: { contains: q.slice(0, 80), mode: 'insensitive' as const }, // avoid abusive long queries
        }
      : undefined;

    const skip = (page - 1) * limit;

    const [total, items] = await this.prisma.$transaction([
      this.prisma.media.count({ where }),
      this.prisma.media.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          code: true,
          filename: true,
          size: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      items,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async storeImagePair(code: string, buffer: Buffer) {
    await this.ensureDirs();

    // Convert + strip metadata
    const sanitized = await sharp(buffer).webp({ quality: 90 }).toBuffer();

    // Create thumbnail once (huge server-load reduction)
    const thumb = await sharp(sanitized)
      .resize({ width: 300, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    const storageKey = `${code}.webp`;
    const filePath = path.join(this.uploadsDir(), storageKey);
    const thumbPath = path.join(this.thumbsDir(), `${code}.webp`);

    await fs.promises.writeFile(filePath, sanitized);
    await fs.promises.writeFile(thumbPath, thumb);

    return { storageKey, size: sanitized.length };
  }

  async getFileStream(code: string) {
    const record = await this.prisma.media.findUnique({ where: { code } });
    if (!record) throw new NotFoundException('File not found');

    const filePath = path.join(this.uploadsDir(), record.storageKey);
    if (!fs.existsSync(filePath)) throw new NotFoundException('File not found');

    return { record, stream: fs.createReadStream(filePath) };
  }

  async getThumbnailStream(code: string) {
    const record = await this.prisma.media.findUnique({ where: { code } });
    if (!record) throw new NotFoundException('File not found');

    const thumbPath = path.join(this.thumbsDir(), `${code}.webp`);
    if (fs.existsSync(thumbPath)) {
      return { record, stream: fs.createReadStream(thumbPath) };
    }

    // Fallback (if old media has no cached thumbnail yet)
    const filePath = path.join(this.uploadsDir(), record.storageKey);
    if (!fs.existsSync(filePath)) throw new NotFoundException('File not found');

    const buf = await sharp(filePath)
      .resize({ width: 300, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    await this.ensureDirs();
    await fs.promises.writeFile(thumbPath, buf);

    return { record, stream: Readable.from(buf) };
  }

  async renameByCode(code: string, filename: string) {
    const record = await this.prisma.media.findUnique({ where: { code } });
    if (!record) throw new NotFoundException('Media not found');

    try {
      return await this.prisma.media.update({
        where: { code },
        data: { filename },
        select: { code: true, filename: true },
      });
    } catch (err: any) {
      if (err?.code === 'P2002')
        throw new ConflictException('Filename already exists');
      throw new InternalServerErrorException('Failed to rename media');
    }
  }

  async deleteByCode(code: string) {
    const record = await this.prisma.media.findUnique({ where: { code } });
    if (!record) throw new NotFoundException('Media not found');

    await this.prisma.media.delete({ where: { code } });

    const filePath = path.join(this.uploadsDir(), record.storageKey);
    const thumbPath = path.join(this.thumbsDir(), `${code}.webp`);

    try {
      await fs.promises.unlink(filePath);
    } catch (err: any) {
      if (err?.code !== 'ENOENT') {
        this.logger.error(
          `Failed to delete media file ${filePath}: ${err.message}`,
        );
      }
    }
    try {
      await fs.promises.unlink(thumbPath);
    } catch (err: any) {
      if (err?.code !== 'ENOENT') {
        this.logger.error(
          `Failed to delete thumbnail ${thumbPath}: ${err.message}`,
        );
      }
    }

    return { code, deleted: true };
  }
}
