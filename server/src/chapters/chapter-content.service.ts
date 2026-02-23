import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ChapterContentType } from '@prisma/client';
import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';
import { CacheManager } from '../cache/cache.manager';
import { PrismaService } from '../prisma/prisma.service';
import { ReaderService } from '../reader/reader.service';
import { StorageService } from '../storage/storage.service';

const MAX_FILES = 300;
const MAX_IMAGE_DIM = 8000;
const MAX_PIXELS = 40_000_000;
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const MAX_WIDTH = 1800;

@Injectable()
export class ChapterContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly readerService: ReaderService,
    private readonly cacheManager: CacheManager,
  ) {}

  private async getChapter(bookId: number, index: number) {
    const chapter = await this.prisma.chapter.findFirst({
      where: { bookId, index },
    });
    if (!chapter) throw new NotFoundException('Chapter not found');
    return chapter;
  }

  private chapterPrefix(bookId: number, chapterIndex: number): string {
    return `b${bookId}/c${chapterIndex}`;
  }

  async getChapterContent(bookId: number, index: number) {
    const chapter = await this.getChapter(bookId, index);
    const manifest = chapter.contentPath
      ? await this.storage
          .getObjectBuffer(`${chapter.contentPath}/manifest.json`)
          .then((b) => JSON.parse(b.toString('utf8')) as { format?: string; pages?: Array<{ key?: string }> })
          .catch(() => null)
      : null;

    let textPreviewHtml: string | null = null;
    if (manifest?.format === 'text') {
      const textKey = manifest.pages?.[0]?.key;
      if (textKey) {
        textPreviewHtml = await this.storage
          .getObjectBuffer(textKey)
          .then((b) => b.toString('utf8'))
          .catch(() => null);
      }
    }

    return { chapter, manifest, textPreviewHtml };
  }

  async uploadImages(
    bookId: number,
    index: number,
    files: Express.Multer.File[],
  ) {
    if (!files || files.length === 0)
      throw new BadRequestException('No files uploaded');
    if (files.length > MAX_FILES)
      throw new BadRequestException(`Too many files; max ${MAX_FILES}`);
    const total = files.reduce((a, f) => a + f.size, 0);
    if (total > MAX_UPLOAD_BYTES)
      throw new BadRequestException('Upload too large');

    const chapter = await this.getChapter(bookId, index);
    const prefix = this.chapterPrefix(bookId, index);
    await this.storage.deletePrefix(prefix);

    const pages: Array<{ key: string; w: number; h: number }> = [];
    const sorted = [...files].sort((a, b) =>
      a.originalname.localeCompare(b.originalname, undefined, {
        numeric: true,
      }),
    );

    for (let i = 0; i < sorted.length; i++) {
      const file = sorted[i];
      const sig = await fileTypeFromBuffer(file.buffer);
      if (
        !sig ||
        !['image/jpeg', 'image/png', 'image/webp'].includes(sig.mime)
      ) {
        throw new BadRequestException(
          `Invalid image type: ${file.originalname}`,
        );
      }

      const meta = await sharp(file.buffer).metadata();
      const width = meta.width ?? 0;
      const height = meta.height ?? 0;
      if (
        width <= 0 ||
        height <= 0 ||
        width > MAX_IMAGE_DIM ||
        height > MAX_IMAGE_DIM ||
        width * height > MAX_PIXELS
      ) {
        throw new BadRequestException(
          `Image dimensions invalid: ${file.originalname}`,
        );
      }

      const webp = await sharp(file.buffer)
        .rotate()
        .resize({ width: MAX_WIDTH, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();
      const outMeta = await sharp(webp).metadata();

      const pageName = `${String(i + 1).padStart(3, '0')}.webp`;
      const key = `${prefix}/pages/${pageName}`;
      await this.storage.putBuffer(key, webp, 'image/webp');

      pages.push({
        key,
        w: outMeta.width ?? width,
        h: outMeta.height ?? height,
      });
    }

    const manifest = this.readerService.buildManifest('images', pages);
    await this.storage.putJson(`${prefix}/manifest.json`, manifest);

    await this.prisma.chapter.update({
      where: { id: chapter.id },
      data: {
        contentPath: prefix,
        contentType: ChapterContentType.images,
        pageCount: pages.length,
        contentVersion: { increment: 1 },
      },
    });
    await this.readerService.clearChapterManifestCache(chapter.id);
    await this.cacheManager.del(
      this.cacheManager.buildKey('chapter-meta', chapter.id),
    );

    return { ok: true, pageCount: pages.length };
  }

  private toSafeHtml(raw: string): string {
    const escaped = raw
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

    return escaped
      .replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
      .replace(/^##\s+(.+)$/gm, '<h2>$1</h2>')
      .replace(/^#\s+(.+)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n\n+/g, '</p><p>')
      .replace(/\n/g, '<br/>');
  }

  async uploadText(bookId: number, index: number, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Text file is required');
    const ext = file.originalname.toLowerCase();
    if (!ext.endsWith('.md') && !ext.endsWith('.txt')) {
      throw new BadRequestException('Only .md and .txt supported in MVP');
    }

    const chapter = await this.getChapter(bookId, index);
    const prefix = this.chapterPrefix(bookId, index);
    await this.storage.deletePrefix(prefix);
    const html = `<article><p>${this.toSafeHtml(file.buffer.toString('utf8'))}</p></article>`;
    const key = `${prefix}/text/content.html`;
    await this.storage.putBuffer(
      key,
      Buffer.from(html, 'utf8'),
      'text/html; charset=utf-8',
    );

    const manifest = this.readerService.buildManifest('text', [{ key }]);
    await this.storage.putJson(`${prefix}/manifest.json`, manifest);

    await this.prisma.chapter.update({
      where: { id: chapter.id },
      data: {
        contentPath: prefix,
        contentType: ChapterContentType.text,
        pageCount: 1,
        contentVersion: { increment: 1 },
      },
    });
    await this.readerService.clearChapterManifestCache(chapter.id);
    return { ok: true };
  }

  async deleteContent(bookId: number, index: number) {
    const chapter = await this.getChapter(bookId, index);
    const prefix = this.chapterPrefix(bookId, index);
    await this.storage.deletePrefix(prefix);

    await this.prisma.chapter.update({
      where: { id: chapter.id },
      data: {
        pageCount: 0,
        contentPath: prefix,
        contentVersion: { increment: 1 },
      },
    });
    await this.readerService.clearChapterManifestCache(chapter.id);
    return { deleted: true };
  }
}
