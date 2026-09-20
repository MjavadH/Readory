import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ChapterContentType } from '@prisma/client';
import { PublicationStatus } from '@readory/shared';
import { Request } from 'express';
import Redis from 'ioredis';
import sharp from 'sharp';
import { CacheManager } from '../cache/cache.manager';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

type ReaderTokenPayload = {
  userId: number;
  chapterId: number;
  bookId: number;
  chapterIndex: number;
  contentVersion: number;
  uaHash: string;
  scope: 'reader' | 'admin-preview';
  exp: number;
};

type AuthenticatedRequest = Request & { user?: { userId?: number } };
type ManifestPage = { key: string; w?: number; h?: number; sha256?: string };
type EpubManifestPage = { key: string; sectionId: string; unitCount: number; hasImages: boolean };
type EpubManifestTocEntry = { title: string; pageIndex: number };

type ChapterManifest =
  | {
      version: 1;
      format: 'images' | 'text';
      pageCount: number;
      pages: ManifestPage[];
    }
  | {
      version: 2;
      format: 'epub';
      pageCount: number;
      pages: EpubManifestPage[];
      toc: EpubManifestTocEntry[];
    };

function escapeXml(s: string) {
  return s.replace(
    /[<>&'"]/g,
    (c) =>
      ({
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        "'": '&apos;',
        '"': '&quot;',
      })[c]!,
  );
}

@Injectable()
export class ReaderService {
  private readonly logger = new Logger(ReaderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly jwtService: JwtService,
    private readonly cacheManager: CacheManager,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  private getRequestUserId(req: Request): number {
    const userId = (req as AuthenticatedRequest).user?.userId;
    if (!userId) throw new UnauthorizedException();
    return userId;
  }

  private async getManifestByPayload(payload: ReaderTokenPayload): Promise<ChapterManifest> {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: payload.chapterId },
      select: { contentPath: true, contentType: true, pageCount: true },
    });

    if (!chapter?.contentPath || !chapter.contentType) {
      throw new NotFoundException('Manifest unavailable');
    }

    const key = this.manifestKey(payload.chapterId, payload.contentVersion);

    return this.cacheManager.getOrSet(key, { ttlSeconds: 900, jitterSeconds: 30 }, async () => {
      const buffer = await this.storageService.getObjectBuffer(
        `${chapter.contentPath}/manifest.json`,
      );
      return JSON.parse(buffer.toString('utf8')) as ChapterManifest;
    });
  }

  private uaHash(req: Request): string {
    const ua = req.headers['user-agent'] ?? 'unknown';
    return Buffer.from(String(ua)).toString('base64url').slice(0, 24);
  }

  private async enforceRateLimit(
    scope: string,
    userId: number,
    limit: number,
    windowSeconds: number,
  ): Promise<void> {
    const key = `rl:${scope}:u:${userId}:${Math.floor(Date.now() / (windowSeconds * 1000))}`;
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, windowSeconds);
    }
    if (count > limit) {
      throw new HttpException({ message: 'Rate limit exceeded', retryAfter: windowSeconds }, 429);
    }
  }

  async createSession(userId: number, bookId: number, chapterIndex: number, req: Request) {
    await this.enforceRateLimit('session', userId, 10, 60);

    const chapter = await this.prisma.chapter.findFirst({
      where: { bookId, index: chapterIndex, book: { publishStatus: PublicationStatus.PUBLISHED } },
      select: {
        id: true,
        bookId: true,
        index: true,
        isFree: true,
        contentType: true,
        contentPath: true,
        pageCount: true,
        contentVersion: true,
      },
    });
    if (!chapter) throw new NotFoundException('Chapter not found');
    if (chapter.contentType === null || !chapter.contentPath) {
      throw new HttpException({ message: 'Content is being prepared', code: 'PROCESSING' }, 503);
    }

    const hasAccess = Boolean(
      await this.prisma.accessRecord.findFirst({
        where: { userId, chapterId: chapter.id },
        select: { id: true },
      }),
    );
    if (!hasAccess) throw new ForbiddenException('Purchase or access required');

    const resume = await this.prisma.readingProgress.findUnique({
      where: { userId_chapterId: { userId, chapterId: chapter.id } },
      select: { lastPage: true, percent: true },
    });

    const token = await this.jwtService.signAsync(
      {
        userId,
        chapterId: chapter.id,
        bookId,
        chapterIndex,
        contentVersion: chapter.contentVersion,
        uaHash: this.uaHash(req),
        scope: 'reader',
      },
      { expiresIn: 120 },
    );

    return {
      chapterId: chapter.id,
      bookId,
      chapterIndex,
      contentType: chapter.contentType,
      pageCount: chapter.pageCount,
      contentVersion: chapter.contentVersion,
      resume: resume ?? null,
      sessionToken: token,
    };
  }

  async createAdminPreviewSession(
    userId: number,
    bookId: number,
    chapterIndex: number,
    req: Request,
  ) {
    const chapter = await this.prisma.chapter.findFirst({
      where: { bookId, index: chapterIndex },
      select: {
        id: true,
        bookId: true,
        index: true,
        contentType: true,
        pageCount: true,
        contentVersion: true,
      },
    });

    if (!chapter) throw new NotFoundException('Chapter not found');
    if (!chapter.contentType) {
      throw new NotFoundException('Chapter content not available');
    }

    const token = await this.jwtService.signAsync(
      {
        userId,
        chapterId: chapter.id,
        bookId,
        chapterIndex,
        contentVersion: chapter.contentVersion,
        uaHash: this.uaHash(req),
        scope: 'admin-preview',
      },
      { expiresIn: 600 },
    );

    return {
      chapterId: chapter.id,
      bookId,
      chapterIndex,
      contentType: chapter.contentType,
      pageCount: chapter.pageCount,
      contentVersion: chapter.contentVersion,
      resume: null,
      sessionToken: token,
      adminPreview: true,
    };
  }

  async verifyToken(token: string, req: Request): Promise<ReaderTokenPayload> {
    try {
      const decoded = await this.jwtService.verifyAsync<ReaderTokenPayload>(token);

      const requestUserId = this.getRequestUserId(req);
      if (decoded.userId !== requestUserId) {
        throw new UnauthorizedException('Reader token user mismatch');
      }

      if (decoded.uaHash !== this.uaHash(req)) {
        throw new UnauthorizedException('Invalid reader token context');
      }

      const chapter = await this.prisma.chapter.findUnique({
        where: { id: decoded.chapterId },
        select: { contentVersion: true, id: true },
      });

      if (!chapter || chapter.contentVersion !== decoded.contentVersion) {
        throw new UnauthorizedException('Reader token expired');
      }

      return decoded;
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      throw new UnauthorizedException('Invalid or expired reader token');
    }
  }

  private manifestKey(chapterId: number, contentVersion: number): string {
    return this.cacheManager.buildKey('reader:manifest', chapterId, contentVersion);
  }

  async getManifest(token: string, req: Request): Promise<ChapterManifest> {
    const payload = await this.verifyToken(token, req);
    return this.getManifestByPayload(payload);
  }

  private encodeZeroWidthUserId(userId: number): string {
    const bits = Buffer.from(String(userId), 'utf8')
      .toString('binary')
      .split('')
      .map((char) => char.charCodeAt(0).toString(2).padStart(8, '0'))
      .join('');

    return bits.replace(/0/g, '\u200b').replace(/1/g, '\u200c');
  }

  private injectZeroWidthWatermark(html: string, userId: number): string {
    const watermark = this.encodeZeroWidthUserId(userId);
    let injected = false;

    // Inject the encoded user id after an early inter-word space while leaving tags intact.
    const nextHtml = html.replace(
      /(<p[^>]*>[^<]{1,240}?\s)([^<]*<\/p>)/i,
      (match, prefix, suffix) => {
        injected = true;
        return `${prefix}${watermark}${suffix}`;
      },
    );

    return injected ? nextHtml : `${watermark}${html}`;
  }

  async getText(token: string, pageNumber: number, req: Request): Promise<string> {
    const payload = await this.verifyToken(token, req);
    const manifest = await this.getManifestByPayload(payload);

    if (manifest.format !== 'text') {
      throw new BadRequestException('Not text chapter');
    }

    if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > manifest.pageCount) {
      throw new BadRequestException('Invalid page');
    }

    const page = manifest.pages[pageNumber - 1];
    if (!page?.key) throw new NotFoundException('Text content missing');

    const buffer = await this.storageService.getObjectBuffer(page.key);
    return payload.scope === 'admin-preview'
      ? buffer.toString('utf8')
      : this.injectZeroWidthWatermark(buffer.toString('utf8'), payload.userId);
  }

  /**
   * Serves one EPUB chapter page's HTML, watermarking its text content the
   * same way plain-text chapters are watermarked, and rewriting every
   * embedded image's `src` (a raw storage key set by EpubProcessingService)
   * into a same-origin `/reader/epub-asset` URL carrying the reader token.
   * This keeps every asset request authenticated, per-user watermarked, and
   * scoped to this exact chapter version — the client never sees or needs
   * a direct storage URL.
   */
  async getEpubText(token: string, pageNumber: number, req: Request): Promise<string> {
    const payload = await this.verifyToken(token, req);
    const manifest = await this.getManifestByPayload(payload);

    if (manifest.format !== 'epub') {
      throw new BadRequestException('Not an EPUB chapter');
    }

    if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > manifest.pageCount) {
      throw new BadRequestException('Invalid page');
    }

    const page = manifest.pages[pageNumber - 1];
    if (!page?.key) throw new NotFoundException('Page content missing');

    const buffer = await this.storageService.getObjectBuffer(page.key);
    const rawHtml = buffer.toString('utf8');

    const htmlWithRewrittenAssets = this.rewriteEpubImageSources(rawHtml, token);

    return payload.scope === 'admin-preview'
      ? htmlWithRewrittenAssets
      : this.injectZeroWidthWatermark(htmlWithRewrittenAssets, payload.userId);
  }

  /**
   * Rewrites every `src="<storage-key>"` produced by EpubProcessingService
   * into `/reader/epub-asset?token=...&key=<storage-key>`. The storage key
   * itself is opaque to the client; access control happens per-request in
   * `getEpubAsset`, which re-derives the manifest from the token and only
   * serves keys that actually belong to this chapter's current manifest
   */
  private rewriteEpubImageSources(html: string, token: string): string {
    return html.replace(/(<img\b[^>]*\bsrc=")([^"]*)(")/gi, (match, prefix, srcValue, suffix) => {
      if (!srcValue) return match;
      const assetUrl = `/reader/epub-asset?token=${encodeURIComponent(token)}&key=${encodeURIComponent(
        srcValue,
      )}`;
      return `${prefix}${assetUrl}${suffix}`;
    });
  }

  async getPage(token: string, page: number, req: Request): Promise<Buffer> {
    const payload = await this.verifyToken(token, req);
    const isAdminPreview = payload.scope === 'admin-preview';

    if (!isAdminPreview) {
      await this.enforceRateLimit('page', payload.userId, 120, 60);

      const blockKey = `reader:block:${payload.userId}`;
      const blockedUntil = await this.redis.get(blockKey);
      if (blockedUntil) {
        throw new HttpException('Temporarily blocked due to abnormal behavior', 429);
      }

      const nowSec = Math.floor(Date.now() / 1000);
      const speedKey = `reader:speed:${payload.userId}:${payload.chapterId}`;
      const pipeline = this.redis.pipeline();
      pipeline.zadd(speedKey, nowSec, `${page}:${Math.random()}`);
      pipeline.expire(speedKey, 10);
      pipeline.zremrangebyscore(speedKey, 0, nowSec - 2);
      pipeline.zcard(speedKey);

      const results = await pipeline.exec();
      const recent = results ? (results[3][1] as number) : 0;

      if (recent >= 10) {
        await this.redis.set(blockKey, String(nowSec + 120), 'EX', 120);
        this.logger.warn(
          `Reader anomaly blocked user=${payload.userId} chapter=${payload.chapterId}`,
        );
        throw new HttpException('Temporarily blocked due to abnormal behavior', 429);
      }
    }

    const manifest = await this.getManifestByPayload(payload);

    if (manifest.format !== 'images') {
      throw new BadRequestException('Not image chapter');
    }

    if (!Number.isInteger(page) || page < 1 || page > manifest.pageCount) {
      throw new BadRequestException('Invalid page');
    }

    const item = manifest.pages[page - 1];
    if (!item?.key) throw new NotFoundException('Page not found');

    const source = await this.storageService.getObjectBuffer(item.key);

    if (isAdminPreview) return source;

    return this.applyImageWatermark(source, token, payload.userId, payload.chapterId);
  }

  /**
   * Composites a per-request, per-user SVG watermark onto an image buffer.
   * Shared by `getPage` (image-chapter pages) and `getEpubAsset` (EPUB
   * embedded images) so both formats get identical tamper-evidence:
   * a user+chapter-identifying, slightly randomized (per-token) overlay
   * blended into the pixel data itself, not just an attribute that could
   * be stripped client-side.
   */
  private async applyImageWatermark(
    source: Buffer,
    token: string,
    userId: number,
    chapterId: number,
  ): Promise<Buffer> {
    const trace = createHash('sha256').update(token).digest('hex').slice(0, 8);
    const dynamicRotation = -25 + (parseInt(trace[0], 16) % 6) - 3;
    const dynamicOpacity = 0.35 + (parseInt(trace[1], 16) % 15) / 100;

    const watermarkText = `Readory #u${userId}c${chapterId}#${trace}`;
    const svg = `<svg width="500" height="260" xmlns="http://www.w3.org/2000/svg">
<text 
    x="10"
    y="130"
    fill="white"
    fill-opacity="${dynamicOpacity}"
    stroke="white"
    stroke-opacity="0.3"
    stroke-width="1"
    transform="rotate(${dynamicRotation} 180 120)"
    font-size="24"
    font-family="Arial Black, Arial, sans-serif"
    font-weight="900">
    ${escapeXml(watermarkText)}
</text>
</svg>`;

    return sharp(source)
      .composite([
        {
          input: Buffer.from(svg),
          tile: true,
          gravity: 'center',
          blend: 'exclusion',
        },
      ])
      .webp({ quality: 82 })
      .toBuffer();
  }

  /**
   * Serves a single image embedded in an EPUB chapter page, watermarked
   * exactly like image-chapter pages.
   *
   * Security: `key` arrives from the client (it's the query param the page
   * HTML was rewritten to point at). It is NEVER trusted directly — it is
   * only ever used to read from storage after being checked against the
   * allow-list of keys that actually appear in this exact chapter's current
   * manifest (assembled from `pages[].key`'s directory plus each page's own
   * declared assets). This prevents a caller from swapping in an arbitrary
   * storage key to read unrelated objects out of the bucket.
   */
  async getEpubAsset(token: string, key: string, req: Request): Promise<Buffer> {
    const payload = await this.verifyToken(token, req);
    const isAdminPreview = payload.scope === 'admin-preview';

    if (!isAdminPreview) {
      await this.enforceRateLimit('epub-asset', payload.userId, 300, 60);
    }

    const manifest = await this.getManifestByPayload(payload);
    if (manifest.format !== 'epub') {
      throw new BadRequestException('Not an EPUB chapter');
    }

    this.assertKeyBelongsToChapterContent(key, manifest);

    const source = await this.storageService.getObjectBuffer(key);

    if (isAdminPreview) return source;

    return this.applyImageWatermark(source, token, payload.userId, payload.chapterId);
  }

  /**
   * Validates that a requested storage key is actually scoped under this
   * chapter's current content prefix (derived from any known page key in
   * the manifest) and points at the `assets/` subpath specifically — never
   * `content/` (page HTML) or `source.epub` (the raw upload). This is the
   * allow-list enforcement point referenced in `getEpubAsset`'s docstring.
   */
  private assertKeyBelongsToChapterContent(
    key: string,
    manifest: Extract<ChapterManifest, { format: 'epub' }>,
  ): void {
    if (!key || key.includes('..') || key.startsWith('/')) {
      throw new BadRequestException('Invalid asset key');
    }

    const samplePageKey = manifest.pages[0]?.key;
    if (!samplePageKey) {
      throw new NotFoundException('Chapter content unavailable');
    }

    const contentMarker = '/content/';
    const markerIndex = samplePageKey.indexOf(contentMarker);
    if (markerIndex === -1) {
      throw new NotFoundException('Chapter content unavailable');
    }

    const contentPrefix = samplePageKey.slice(0, markerIndex);
    const expectedAssetPrefix = `${contentPrefix}/assets/`;

    if (!key.startsWith(expectedAssetPrefix)) {
      throw new BadRequestException('Asset key does not belong to this chapter');
    }
  }

  async getReaderContext(userId: number, bookId: number) {
    const chapters = await this.prisma.chapter.findMany({
      where: {
        bookId,
        contentType: { not: null },
        publishStatus: PublicationStatus.PUBLISHED,
      },
      orderBy: {
        index: 'asc',
      },
      select: {
        id: true,
        index: true,
        title: true,
        isFree: true,
        price: true,
        pageCount: true,
      },
    });

    const accessRows = chapters.length
      ? await this.prisma.accessRecord.findMany({
          where: {
            userId,
            chapterId: {
              in: chapters.map((c) => c.id),
            },
          },
          select: {
            chapterId: true,
          },
        })
      : [];

    const accessibleChapterIds = new Set(
      accessRows.map((r) => r.chapterId).filter((id): id is number => typeof id === 'number'),
    );

    return {
      chapters: chapters.map((ch) => {
        const hasAccess = accessibleChapterIds.has(ch.id);

        return {
          id: ch.id,
          index: ch.index,
          title: ch.title,
          pageCount: ch.pageCount ?? 0,
          locked: !hasAccess,
          price: ch.price != null ? Number(ch.price) : null,
        };
      }),
    };
  }

  async saveProgress(userId: number, chapterId: number, lastPage: number) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      select: { id: true, bookId: true, isFree: true, pageCount: true },
    });
    if (!chapter) throw new NotFoundException('Chapter not found');
    const hasAccess = Boolean(
      await this.prisma.accessRecord.findFirst({
        where: { userId, chapterId },
        select: { id: true },
      }),
    );
    if (!hasAccess) throw new ForbiddenException('No access');

    const maxPage = Math.max(1, chapter.pageCount || 1);
    const clampedPage = Math.max(1, Math.min(lastPage, maxPage));
    const percent = Math.floor((clampedPage / maxPage) * 100);

    return this.prisma.readingProgress.upsert({
      where: { userId_chapterId: { userId, chapterId } },
      create: {
        userId,
        bookId: chapter.bookId,
        chapterId,
        lastPage: clampedPage,
        percent,
      },
      update: { lastPage: clampedPage, percent },
    });
  }

  async clearChapterManifestCache(chapterId: number): Promise<void> {
    // versioned key naturally invalidates; the best effort cleanup of current version key
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      select: { contentVersion: true },
    });
    if (!chapter) return;
    await this.cacheManager.del(this.manifestKey(chapterId, chapter.contentVersion));
  }

  buildManifest(
    chapterType: Extract<ChapterContentType, 'images' | 'text'>,
    keys: ManifestPage[],
  ): Extract<ChapterManifest, { version: 1 }> {
    return {
      version: 1,
      format: chapterType,
      pageCount: keys.length,
      pages: keys,
    };
  }
}
