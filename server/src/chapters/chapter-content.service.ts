import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ChapterContentType } from '@prisma/client';
import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';
import { CacheManager } from '../cache/cache.manager';
import { PrismaService } from '../prisma/prisma.service';
import { ReaderService } from '../reader/reader.service';
import { StorageService } from '../storage/storage.service';


export const IMAGE_UPLOAD_MAX_FILES = 120;
export const IMAGE_UPLOAD_MAX_FILE_BYTES = 12 * 1024 * 1024;
export const TEXT_UPLOAD_MAX_FILE_BYTES = 2 * 1024 * 1024;

const MAX_CHAPTER_PAGES = 300;
const MAX_IMAGE_DIM = 8000;
const MAX_PIXELS = 40_000_000;
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const MAX_WIDTH = 1800;

type ImagePage = { key: string; w: number; h: number };
type ChapterManifest = { format?: string; pages?: ImagePage[] };

@Injectable()
export class ChapterContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly readerService: ReaderService,
    private readonly cacheManager: CacheManager,
  ) {}
  private readonly logger = new Logger(ChapterContentService.name);

  private chapterBasePrefix(bookId: number, chapterIndex: number): string {
    return `b${bookId}/c${chapterIndex}`;
  }

  private chapterVersionPrefix(bookId: number, chapterIndex: number): string {
    return `${this.chapterBasePrefix(bookId, chapterIndex)}/v${Date.now()}-${randomUUID()}`;
  }

  private resolveActivePrefix(
      chapter: { contentPath: string | null },
      bookId: number,
      index: number,
  ): string {
    return chapter.contentPath ?? this.chapterBasePrefix(bookId, index);
  }

  private validateImageUploadBatch(files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }

    if (files.length > IMAGE_UPLOAD_MAX_FILES) {
      throw new BadRequestException(`Too many files; max ${IMAGE_UPLOAD_MAX_FILES}`);
    }

    let total = 0;
    for (const f of files) {
      if (!f?.buffer || !Buffer.isBuffer(f.buffer)) {
        throw new BadRequestException('Invalid upload buffer');
      }
      if (typeof f.size === 'number' && f.size > IMAGE_UPLOAD_MAX_FILE_BYTES) {
        throw new BadRequestException(`File too large: ${f.originalname}`);
      }
      total += f.size ?? f.buffer.length;
    }

    if (total > MAX_UPLOAD_BYTES) {
      throw new BadRequestException('Upload too large');
    }
  }

  private assertChapterPageLimit(existingCount: number, incomingCount: number) {
    if (existingCount + incomingCount > MAX_CHAPTER_PAGES) {
      throw new BadRequestException(`Chapter page limit exceeded; max ${MAX_CHAPTER_PAGES}`);
    }
  }

  private buildImagePageKey(prefix: string): string {
    return `${prefix}/pages/${Date.now()}-${randomUUID()}.webp`;
  }

  private async readManifest(prefix: string): Promise<ChapterManifest | null> {
    try {
      const buf = await this.storage.getObjectBuffer(`${prefix}/manifest.json`);
      return JSON.parse(buf.toString('utf8')) as ChapterManifest;
    } catch {
      return null;
    }
  }

  private async updateChapterAfterContentChange(
      chapterId: number,
      data: {
        contentPath?: string | null;
        contentType?: ChapterContentType | null;
        pageCount: number;
      },
  ) {
    await this.prisma.chapter.update({
      where: { id: chapterId },
      data: {
        contentPath: data.contentPath ?? null,
        contentType: data.contentType ?? null,
        pageCount: data.pageCount,
        contentVersion: { increment: 1 },
      },
    });

    await this.readerService.clearChapterManifestCache(chapterId);
    await this.cacheManager.del(this.cacheManager.buildKey('chapter-meta', chapterId));
  }

  private async getChapter(bookId: number, index: number) {
    const chapter = await this.prisma.chapter.findFirst({
      where: { bookId, index },
    });
    if (!chapter) throw new NotFoundException('Chapter not found');
    return chapter;
  }

  async getChapterContent(bookId: number, index: number) {
    const chapter = await this.getChapter(bookId, index);
    const manifest = chapter.contentPath
      ? await this.readManifest(chapter.contentPath)
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
    this.validateImageUploadBatch(files);
    this.assertChapterPageLimit(0, files.length);

    const chapter = await this.getChapter(bookId, index);
    const oldPrefix = chapter.contentPath;
    const prefix = this.chapterVersionPrefix(bookId, index);

    const pages: Array<{ key: string; w: number; h: number }> = [];
    const sorted = [...files].sort((a, b) =>
        a.originalname.localeCompare(b.originalname, undefined, { numeric: true }),
    );

    for (const file of sorted) {
      const page = await this.processAndUploadSingleImage(prefix, file);
      pages.push(page);
    }

    const manifest = this.readerService.buildManifest('images', pages);
    await this.storage.putJson(`${prefix}/manifest.json`, manifest);

    await this.updateChapterAfterContentChange(chapter.id, {
      contentPath: prefix,
      contentType: ChapterContentType.images,
      pageCount: pages.length,
    });

    if (oldPrefix && oldPrefix !== prefix) {
      await this.storage.deletePrefix(oldPrefix).catch((e) => {
        this.logger.warn(`Failed to cleanup old prefix ${oldPrefix}: ${String(e)}`);
        return 0;
      });
    }

    return { ok: true, pageCount: pages.length };
  }

  async appendImages(bookId: number, index: number, files: Express.Multer.File[]) {
    this.validateImageUploadBatch(files);

    const chapter = await this.getChapter(bookId, index);
    const prefix = chapter.contentPath ?? this.chapterVersionPrefix(bookId, index);

    const manifest =
        (await this.readManifest(prefix)) ??
        ({ format: 'images', pages: [] as ImagePage[] });

    if (manifest.format && manifest.format !== 'images') {
      throw new BadRequestException('Chapter content is not image-based');
    }

    const existingPages = Array.isArray(manifest.pages) ? manifest.pages : [];
    this.assertChapterPageLimit(existingPages.length, files.length);

    const sorted = [...files].sort((a, b) =>
        a.originalname.localeCompare(b.originalname, undefined, { numeric: true }),
    );

    const newPages: ImagePage[] = [];
    for (const file of sorted) {
      const page = await this.processAndUploadSingleImage(prefix, file);
      newPages.push(page);
    }

    const mergedPages = [...existingPages, ...newPages];
    const nextManifest = this.readerService.buildManifest('images', mergedPages);
    await this.storage.putJson(`${prefix}/manifest.json`, nextManifest);

    await this.updateChapterAfterContentChange(chapter.id, {
      contentPath: prefix,
      contentType: ChapterContentType.images,
      pageCount: mergedPages.length,
    });

    return { ok: true, appended: newPages.length, pageCount: mergedPages.length };
  }

  private async processAndUploadSingleImage(
      prefix: string,
      file: Express.Multer.File,
  ): Promise<{ key: string; w: number; h: number }> {
    const sig = await fileTypeFromBuffer(file.buffer);
    if (!sig || !['image/jpeg', 'image/png', 'image/webp'].includes(sig.mime)) {
      throw new BadRequestException(`Invalid image type: ${file.originalname}`);
    }

    const meta = await sharp(file.buffer, { limitInputPixels: MAX_PIXELS }).metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;

    if (
        width <= 0 ||
        height <= 0 ||
        width > MAX_IMAGE_DIM ||
        height > MAX_IMAGE_DIM ||
        width * height > MAX_PIXELS
    ) {
      throw new BadRequestException(`Image dimensions invalid: ${file.originalname}`);
    }

    const { data, info } = await sharp(file.buffer, { limitInputPixels: MAX_PIXELS })
        .rotate()
        .resize({ width: MAX_WIDTH, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer({ resolveWithObject: true });

    const key = this.buildImagePageKey(prefix);
    await this.storage.putBuffer(key, data, 'image/webp');

    return {
      key,
      w: info.width ?? width,
      h: info.height ?? height,
    };
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
    if (!file.buffer || !Buffer.isBuffer(file.buffer)) {
      throw new BadRequestException('Invalid text upload buffer');
    }
    if ((file.size ?? file.buffer.length) > TEXT_UPLOAD_MAX_FILE_BYTES) {
      throw new BadRequestException('Text file too large');
    }

    const ext = file.originalname.toLowerCase();
    if (!ext.endsWith('.md') && !ext.endsWith('.txt')) {
      throw new BadRequestException('Only .md and .txt supported in MVP');
    }

    const chapter = await this.getChapter(bookId, index);
    const oldPrefix = chapter.contentPath;
    const prefix = this.chapterVersionPrefix(bookId, index);

    const html = `<article><p>${this.toSafeHtml(file.buffer.toString('utf8'))}</p></article>`;
    const key = `${prefix}/text/content.html`;

    await this.storage.putBuffer(
        key,
        Buffer.from(html, 'utf8'),
        'text/html; charset=utf-8',
    );

    const manifest = this.readerService.buildManifest('text', [{ key }]);
    await this.storage.putJson(`${prefix}/manifest.json`, manifest);

    await this.updateChapterAfterContentChange(chapter.id, {
      contentPath: prefix,
      contentType: ChapterContentType.text,
      pageCount: 1,
    });

    if (oldPrefix && oldPrefix !== prefix) {
      await this.storage.deletePrefix(oldPrefix).catch((e) => {
        this.logger.warn(`Failed to cleanup old prefix ${oldPrefix}: ${String(e)}`);
        return 0;
      });
    }

    return { ok: true };
  }

  async deleteContent(bookId: number, index: number) {
    const chapter = await this.getChapter(bookId, index);
    const basePrefix = this.chapterBasePrefix(bookId, index);

    await this.storage.deletePrefix(basePrefix);

    await this.updateChapterAfterContentChange(chapter.id, {
      contentPath: null,
      contentType: null,
      pageCount: 0,
    });

    return { deleted: true };
  }

  async deleteImage(bookId: number, index: number, pageNumber: number) {
    return this.deleteImages(bookId, index, [pageNumber]);
  }

  async deleteImages(bookId: number, index: number, pageNumbers: number[]) {
    if (!Array.isArray(pageNumbers) || pageNumbers.length === 0) {
      throw new BadRequestException('pageNumbers is required');
    }

    const chapter = await this.getChapter(bookId, index);
    const prefix = this.resolveActivePrefix(chapter, bookId, index);
    const manifest = await this.readManifest(prefix);

    if (!manifest || manifest.format !== 'images' || !Array.isArray(manifest.pages)) {
      throw new BadRequestException('No image manifest found');
    }

    const unique = [...new Set(pageNumbers)]
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= manifest.pages!.length)
        .sort((a, b) => a - b);

    if (unique.length === 0) {
      throw new BadRequestException('No valid page numbers');
    }

    const removeSet = new Set(unique.map((n) => n - 1)); // 0-based index
    const removedKeys = manifest.pages
        .map((p, idx) => ({ p, idx }))
        .filter(({ idx }) => removeSet.has(idx))
        .map(({ p }) => p.key)
        .filter(Boolean);

    const keptPages = manifest.pages.filter((_, idx) => !removeSet.has(idx));

    await this.storage.deleteKeys(removedKeys);

    if (keptPages.length === 0) {
      await this.storage.deletePrefix(prefix);

      await this.updateChapterAfterContentChange(chapter.id, {
        contentPath: null,
        contentType: null,
        pageCount: 0,
      });
    } else {
      const nextManifest = this.readerService.buildManifest('images', keptPages);
      await this.storage.putJson(`${prefix}/manifest.json`, nextManifest);

      await this.storage.deleteKeys(removedKeys);

      await this.updateChapterAfterContentChange(chapter.id, {
        contentPath: prefix,
        contentType: ChapterContentType.images,
        pageCount: keptPages.length,
      });
    }

    return { ok: true, removed: unique.length, pageCount: keptPages.length };
  }

}
