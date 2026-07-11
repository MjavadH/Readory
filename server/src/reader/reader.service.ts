import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  HttpException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ChapterContentType } from '@prisma/client';
import { Request } from 'express';
import Redis from 'ioredis';
import sharp from 'sharp';
import { CacheManager } from '../cache/cache.manager';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { createHash } from 'crypto';
import {PublicationStatus} from "@readory/shared";

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
type ChapterManifest = {
  version: 1;
  format: 'images' | 'text';
  pageCount: number;
  pages: ManifestPage[];
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

  private async getManifestByPayload(
    payload: ReaderTokenPayload,
  ): Promise<ChapterManifest> {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: payload.chapterId },
      select: { contentPath: true, contentType: true, pageCount: true },
    });

    if (!chapter?.contentPath || !chapter.contentType) {
      throw new NotFoundException('Manifest unavailable');
    }

    const key = this.manifestKey(payload.chapterId, payload.contentVersion);

    return this.cacheManager.getOrSet(
      key,
      { ttlSeconds: 900, jitterSeconds: 30 },
      async () => {
        const buffer = await this.storageService.getObjectBuffer(
          `${chapter.contentPath}/manifest.json`,
        );
        return JSON.parse(buffer.toString('utf8')) as ChapterManifest;
      },
    );
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
      throw new HttpException(
        { message: 'Rate limit exceeded', retryAfter: windowSeconds },
        429,
      );
    }
  }

  async createSession(
    userId: number,
    bookId: number,
    chapterIndex: number,
    req: Request,
  ) {
    await this.enforceRateLimit('session', userId, 10, 60);

    const chapter = await this.prisma.chapter.findFirst({
      where: { bookId, index: chapterIndex, book: { publishStatus: PublicationStatus.PUBLISHED } },
      select: {
        id: true,
        bookId: true,
        index: true,
        isFree: true,
        contentType: true,
        pageCount: true,
        contentVersion: true,
      },
    });
    if (!chapter) throw new NotFoundException('Chapter not found');

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
      const decoded =
        await this.jwtService.verifyAsync<ReaderTokenPayload>(token);

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
    return this.cacheManager.buildKey(
      'reader:manifest',
      chapterId,
      contentVersion,
    );
  }

  async getManifest(token: string, req: Request): Promise<ChapterManifest> {
    const payload = await this.verifyToken(token, req);
    return this.getManifestByPayload(payload);
  }

  async getText(token: string, req: Request): Promise<string> {
    const payload = await this.verifyToken(token, req);
    const manifest = await this.getManifestByPayload(payload);

    if (manifest.format !== 'text') {
      throw new BadRequestException('Not text chapter');
    }

    const page = manifest.pages[0];
    if (!page?.key) throw new NotFoundException('Text content missing');

    const buffer = await this.storageService.getObjectBuffer(page.key);
    return buffer.toString('utf8');
  }

  async getPage(token: string, page: number, req: Request): Promise<Buffer> {
    const payload = await this.verifyToken(token, req);
    const isAdminPreview = payload.scope === 'admin-preview';

    if (!isAdminPreview) {
      await this.enforceRateLimit('page', payload.userId, 120, 60);

      const blockKey = `reader:block:${payload.userId}`;
      const blockedUntil = await this.redis.get(blockKey);
      if (blockedUntil) {
        throw new HttpException(
          'Temporarily blocked due to abnormal behavior',
          429,
        );
      }

      const nowSec = Math.floor(Date.now() / 1000);
      const speedKey = `reader:speed:${payload.userId}:${payload.chapterId}`;
      const pipeline = this.redis.pipeline();
      pipeline.zadd(speedKey, nowSec, `${page}:${Math.random()}`); // افزودن یک مقدار یونیک برای ثبت دقیق همه درخواست‌های همزمان
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
        throw new HttpException(
            'Temporarily blocked due to abnormal behavior',
            429,
        );
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

    const trace = createHash('sha256').update(token).digest('hex').slice(0, 8);
    const dynamicRotation = -25 + (parseInt(trace[0]!, 16) % 6) - 3;
    const dynamicOpacity = 0.3 + (parseInt(trace[1]!, 16) % 10) / 100;

    const watermarkText = `Readory #u${payload.userId}c${payload.chapterId}#${trace}`;
    const svg = `<svg width="500" height="260" xmlns="http://www.w3.org/2000/svg"><text x="10" y="130"
        fill="white" fill-opacity="${dynamicOpacity}"
        transform="rotate(${dynamicRotation} 180 120)"
        font-size="24"
        font-family="Arial, sans-serif"
        font-weight="800">
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

  async getReaderContext(userId: number, bookId: number) {
    const chapters = await this.prisma.chapter.findMany({
      where: {
        bookId,
        contentType: { not: null },
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
      accessRows
        .map((r) => r.chapterId)
        .filter((id): id is number => typeof id === 'number'),
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
    await this.cacheManager.del(
      this.manifestKey(chapterId, chapter.contentVersion),
    );
  }

  buildManifest(
    chapterType: ChapterContentType,
    keys: ManifestPage[],
  ): ChapterManifest {
    return {
      version: 1,
      format: chapterType,
      pageCount: keys.length,
      pages: keys,
    };
  }
}
