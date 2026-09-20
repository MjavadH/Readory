import { randomUUID } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';
import { StorageService } from '../../storage/storage.service';

const MAX_IMAGE_DIM = 9000;
const MAX_PIXELS = 40_000_000;
const MAX_WIDTH = 1800;
const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export type UploadedEpubImage = { key: string; w: number; h: number };

/**
 * Validates and re-encodes a single image extracted from an EPUB archive,
 * then uploads it to S3 under `${assetsPrefix}/img-<id>.webp`.
 *
 * Applies the same dimension/pixel-count safety limits used for direct
 * image chapter uploads, and unconditionally re-encodes to webp — this is
 * both a security measure (no arbitrary source bytes reach storage/reader)
 * and a size-normalization measure.
 */
export async function processAndUploadEpubImage(
  storage: StorageService,
  assetsPrefix: string,
  buffer: Buffer,
): Promise<UploadedEpubImage> {
  const sig = await fileTypeFromBuffer(buffer);
  if (!sig || !ALLOWED_IMAGE_MIME.has(sig.mime)) {
    throw new BadRequestException('Invalid or unsupported image type inside EPUB');
  }

  const meta = await sharp(buffer, { limitInputPixels: MAX_PIXELS }).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;

  if (
    width <= 0 ||
    height <= 0 ||
    width > MAX_IMAGE_DIM ||
    height > MAX_IMAGE_DIM ||
    width * height > MAX_PIXELS
  ) {
    throw new BadRequestException('EPUB image dimensions invalid or too large');
  }

  const { data, info } = await sharp(buffer, { limitInputPixels: MAX_PIXELS })
    .rotate()
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });

  const key = `${assetsPrefix}/img-${randomUUID()}.webp`;
  await storage.putBuffer(key, data, 'image/webp');

  return { key, w: info.width ?? width, h: info.height ?? height };
}
