import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { CacheManager } from '../cache/cache.manager';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const MAX_AVATAR_DIMENSION = 1024;
const AVATAR_SIZE = 512;
const AVATAR_CACHE_CONTROL = 'public, max-age=31536000, immutable';
const SUPPORTED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

@Injectable()
export class AvatarService {
  private readonly logger = new Logger(AvatarService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly cacheManager: CacheManager,
  ) {}

  private avatarKey(userId: number) {
    return `media/avatar/${userId}/${uuidv4()}.webp`;
  }

  private assertTrustedAvatarKey(key?: string | null) {
    if (key && !/^media\/avatar\/[1-9]\d*\/[0-9a-f-]{36}\.webp$/i.test(key)) {
      throw new InternalServerErrorException('Invalid stored avatar key');
    }
  }

  async processAvatar(file?: Express.Multer.File) {
    if (!file?.buffer) throw new BadRequestException('Exactly one avatar image is required');
    if (file.size >= MAX_AVATAR_BYTES || file.buffer.length >= MAX_AVATAR_BYTES) {
      throw new BadRequestException('Avatar must be smaller than 5 MB');
    }

    const type = await fileTypeFromBuffer(file.buffer);
    if (!type || !SUPPORTED_MIME.has(type.mime)) {
      throw new BadRequestException('Only actual JPG/JPEG, PNG, or WebP images are allowed');
    }

    let image = sharp(file.buffer, {
      failOn: 'warning',
      limitInputPixels: MAX_AVATAR_DIMENSION * MAX_AVATAR_DIMENSION * 4,
    });

    let metadata: sharp.Metadata;
    try {
      metadata = await image.metadata();
    } catch {
      throw new BadRequestException('Invalid or corrupted image');
    }

    if (!metadata.width || !metadata.height) {
      throw new BadRequestException('Invalid image dimensions');
    }
    try {
      image = sharp(file.buffer, {
        failOn: 'warning',
        limitInputPixels: MAX_AVATAR_DIMENSION * MAX_AVATAR_DIMENSION * 4,
      });
      const buffer = await image
        .rotate()
        .resize(AVATAR_SIZE, AVATAR_SIZE, {
          fit: 'cover',
          position: 'center',
          withoutEnlargement: true,
        })
        .webp({ quality: 82, effort: 4 })
        .toBuffer();
      return { buffer, contentType: 'image/webp' };
    } catch {
      throw new BadRequestException('Failed to process avatar image');
    }
  }

  async storeProcessedAvatar(userId: number, input: Buffer) {
    const processed = await this.processAvatar({
      buffer: input,
      size: input.length,
    } as Express.Multer.File);
    const key = this.avatarKey(userId);
    await this.storage.putObject({
      key,
      body: processed.buffer,
      contentType: processed.contentType,
      cacheControl: AVATAR_CACHE_CONTROL,
    });
    return key;
  }

  async replaceAvatar(userId: number, file: Express.Multer.File) {
    const processed = await this.processAvatar(file);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, username: true, avatarKey: true, updatedAt: true },
    });
    if (!user) throw new NotFoundException('User not found');
    this.assertTrustedAvatarKey(user.avatarKey);

    const newKey = this.avatarKey(userId);
    let uploaded = false;
    try {
      await this.storage.putObject({
        key: newKey,
        body: processed.buffer,
        contentType: processed.contentType,
        cacheControl: AVATAR_CACHE_CONTROL,
      });
      uploaded = true;

      const updated = await this.prisma.user.updateMany({
        where: { id: userId, avatarKey: user.avatarKey },
        data: { avatarKey: newKey },
      });
      if (updated.count !== 1) {
        throw new ConflictException('Avatar changed concurrently. Please retry.');
      }

      await Promise.all([
        this.cacheManager.del(`session:user:${userId}`),
        this.cacheManager.bumpVersion(`public_profile:version:${userId}`),
      ]);
      if (user.avatarKey) {
        await this.storage.deleteKeys([user.avatarKey]).catch((err) => {
          this.logger.error(
            `Failed to delete previous avatar ${user.avatarKey}: ${(err as Error).message}`,
          );
        });
      }

      return {
        success: true,
        user: { ...user, avatarKey: newKey },
      };
    } catch (error) {
      if (uploaded) {
        await this.storage.deleteKeys([newKey]).catch((err) => {
          this.logger.error(
            `Failed to clean up orphan avatar ${newKey}: ${(err as Error).message}`,
          );
        });
      }
      if (error instanceof BadRequestException || error instanceof ConflictException) throw error;
      this.logger.error(
        `Avatar replacement failed for user ${userId}: ${(error as Error).message}`,
      );
      throw new InternalServerErrorException('Failed to update avatar');
    }
  }
}
