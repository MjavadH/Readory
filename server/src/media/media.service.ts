import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import sharp from 'sharp';
import { StorageService } from '../storage/storage.service';

const COVER_THUMBNAIL_CACHE_CONTROL = 'public, max-age=31536000, immutable';
const COVER_THUMBNAIL_WIDTH = 480;
const COVER_THUMBNAIL_QUALITY = 82;

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    private prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  private coverThumbnailKey(code: string) {
    return `media/book-covers/${code}/thumbnail.webp`;
  }

  private toPublicMediaItem<T extends { storageKey?: string | null }>(item: T) {
    return {
      ...item,
      url: item.storageKey ? this.storage.getPublicUrl(item.storageKey) : null,
    };
  }

  async createRecord(params: {
    code: string;
    filename: string;
    storageKey: string;
    mimeType: string;
    size: number;
  }) {
    try {
      const record = await this.prisma.media.create({ data: params });
      return this.toPublicMediaItem(record);
    } catch (e) {
      this.logger.error(
        `Failed to create media record: ${(e as Error).message}`,
        (e as Error).stack,
      );
      await this.storage.deleteKeys([params.storageKey]).catch((err) => {
        this.logger.error(
          `Failed to clean up uploaded media object ${params.storageKey}: ${(err as Error).message}`,
        );
      });
      throw new InternalServerErrorException('Failed to create media record');
    }
  }

  async listPaged(params: { q?: string; page: number; limit: number }) {
    const q = params.q?.trim();
    const page = Number.isFinite(params.page) ? Math.max(1, params.page) : 1;
    const limitRaw = Number.isFinite(params.limit) ? params.limit : 50;
    const limit = Math.min(Math.max(1, limitRaw), 100);

    const where = q
      ? {
          filename: { contains: q.slice(0, 80), mode: 'insensitive' as const },
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
          storageKey: true,
          size: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      items: items.map((item: { storageKey: string | null }) => this.toPublicMediaItem(item)),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async storeBookCoverThumbnail(code: string, buffer: Buffer) {
    const thumbnail = await sharp(buffer, { failOn: 'warning' })
      .rotate()
      .resize({ width: COVER_THUMBNAIL_WIDTH, withoutEnlargement: true })
      .webp({ quality: COVER_THUMBNAIL_QUALITY, effort: 5 })
      .toBuffer();

    const storageKey = this.coverThumbnailKey(code);

    await this.storage.putObject({
      key: storageKey,
      body: thumbnail,
      contentType: 'image/webp',
      cacheControl: COVER_THUMBNAIL_CACHE_CONTROL,
    });

    return { storageKey, size: thumbnail.length, url: this.storage.getPublicUrl(storageKey) };
  }

  async renameByCode(code: string, filename: string) {
    const record = await this.prisma.media.findUnique({ where: { code } });
    if (!record) throw new NotFoundException('Media not found');

    try {
      const updated = await this.prisma.media.update({
        where: { code },
        data: { filename },
        select: { code: true, filename: true, storageKey: true },
      });
      return this.toPublicMediaItem(updated);
    } catch (err: any) {
      if (err?.code === 'P2002') throw new ConflictException('Filename already exists');
      throw new InternalServerErrorException('Failed to rename media');
    }
  }

  async deleteByCode(code: string) {
    const record = await this.prisma.media.findUnique({ where: { code } });
    if (!record) throw new NotFoundException('Media not found');

    await this.prisma.media.delete({ where: { code } });

    try {
      await this.storage.deleteKeys([record.storageKey]);
    } catch (err: any) {
      this.logger.error(`Failed to delete media object ${record.storageKey}: ${err.message}`);
      throw new InternalServerErrorException('Failed to delete media object');
    }

    return { code, deleted: true };
  }
}
