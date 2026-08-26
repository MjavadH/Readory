import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DomainEventType } from '@readory/shared';
import { CacheManager } from '../cache/cache.manager';
import { ChapterCache } from '../cache/chapter-cache.service';
import { normalizeQ } from '../common';
import { OutboxService } from '../outbox/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import { PublicService } from '../public/public.service';
import { WalletsService } from '../wallets/wallets.service';
import { CreateChapterDto } from './dto/create-chapter.dto';
import { ListChaptersDto } from './dto/list-chapters.dto';
import { UpdateChapterDto } from './dto/update-chapter.dto';

@Injectable()
export class ChaptersService {
  constructor(
    private prisma: PrismaService,
    private walletsService: WalletsService,
    private publicService: PublicService,
    private readonly cacheManager: CacheManager,
    private readonly chapterCache: ChapterCache,
    private readonly outbox: OutboxService,
  ) {}

  private readonly CHAPTERS_LIST_CACHE_TTL_SECONDS = 90;

  // List chapters for a book (public)
  async listChapters(
    bookId: number,
    query: ListChaptersDto,
    path: boolean = false,
    Status: boolean = false,
  ) {
    const q = normalizeQ(query.q);
    const page = Number.isInteger(query.page) ? Number(query.page) : 1;
    const limit = Number.isInteger(query.limit) ? Math.min(Number(query.limit), 100) : 50;
    const safePage = Math.max(page, 1);
    const safeLimit = Math.max(limit, 1);
    const skip = (safePage - 1) * safeLimit;
    const order = query.order === 'desc' ? 'desc' : 'asc';
    const status = query.publishStatus;

    const shouldCache = safePage <= 20;

    const where: Prisma.ChapterWhereInput = {
      bookId,
      publishStatus: status,
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: 'insensitive' } },
              ...(Number.isInteger(Number(q)) ? [{ index: Number(q) }] : []),
            ],
          }
        : {}),
    };

    const loadFromDatabase = async () => {
      const [items, total] = await this.prisma.$transaction([
        this.prisma.chapter.findMany({
          where,
          orderBy: { index: order },
          skip,
          take: safeLimit,
          select: {
            id: true,
            title: true,
            index: true,
            price: true,
            isFree: true,
            updatedAt: true,
            contentPath: path,
            publishStatus: Status,
          },
        }),
        this.prisma.chapter.count({ where }),
      ]);

      return {
        items: items.map((item) => ({
          ...item,
          price: item.price ? item.price.toNumber() : null,
        })),
        pagination: {
          page: safePage,
          limit: safeLimit,
          total,
          totalPages: Math.max(1, Math.ceil(total / safeLimit)),
        },
      };
    };

    if (!shouldCache) {
      return loadFromDatabase();
    }

    const version = await this.chapterCache.getListVersion(bookId);
    const cacheKey = this.chapterCache.buildListKey({
      bookId,
      q,
      status,
      page: safePage,
      limit: safeLimit,
      path,
      order,
      version,
    });

    return this.cacheManager.getOrSet(
      cacheKey,
      {
        ttlSeconds: this.CHAPTERS_LIST_CACHE_TTL_SECONDS,
        jitterSeconds: Math.ceil(this.CHAPTERS_LIST_CACHE_TTL_SECONDS * 0.1),
        earlyRefreshWindowSeconds: 12,
      },
      loadFromDatabase,
    );
  }

  // Admin: create a new chapter
  async createChapter(bookId: number, dto: CreateChapterDto) {
    const isFree = dto.isFree ?? false;
    const price = isFree ? null : dto.price ? new Prisma.Decimal(dto.price) : null;

    try {
      const now = new Date();
      const isPublished = dto.publishStatus === 'PUBLISHED';
      const chapter = await this.prisma.$transaction(async (tx) => {
        const chapter = await tx.chapter.create({
          data: {
            book: { connect: { id: bookId } },
            title: dto.title,
            index: dto.index,
            publishStatus: dto.publishStatus,
            isFree,
            price,
            contentPath: dto.contentPath,
          },
        });
        const book = await tx.book.update({
          where: { id: bookId },
          data: {
            ...(isPublished && { chapterCount: { increment: 1 } }),
            lastContentUpdate: now,
          },
          select: { id: true, title: true, coverImage: true, type: { select: { slug: true } } },
        });
        if (isPublished) {
          await this.outbox.create(tx, {
            type: DomainEventType.CHAPTER_PUBLISHED,
            version: 1,
            aggregateType: 'Chapter',
            aggregateId: String(chapter.id),
            payload: {
              bookId,
              bookTitle: book.title,
              bookType: book.type.slug,
              coverImage: book.coverImage,
              chapterId: chapter.id,
              chapterTitle: chapter.title,
              chapterIndex: chapter.index,
              publishedAt: now.toISOString(),
            },
          });
        }
        return chapter;
      });

      await this.cacheManager.del('stats:chapters:count');
      await this.publicService.clearHomeCache();
      await this.chapterCache.bumpListVersion(bookId);
      return chapter;
    } catch (err: any) {
      if (err?.code === 'P2002')
        throw new ConflictException('Chapter index already exists for this book');
      throw err;
    }
  }

  async updateChapter(bookId: number, chapterId: number, dto: UpdateChapterDto) {
    const existing = await this.prisma.chapter.findFirst({
      where: { id: chapterId, bookId },
    });
    if (!existing) throw new NotFoundException('Chapter not found');

    let chapterCountChange = 0;
    if (dto.publishStatus && existing.publishStatus !== dto.publishStatus) {
      if (dto.publishStatus === 'PUBLISHED') {
        chapterCountChange = 1;
      } else if (existing.publishStatus === 'PUBLISHED') {
        chapterCountChange = -1;
      }
    }

    const nextIsFree = dto.isFree ?? existing.isFree;

    const nextPrice = nextIsFree
      ? null
      : dto.price !== undefined
        ? new Prisma.Decimal(dto.price)
        : existing.price;

    try {
      const now = new Date();
      const chapter = await this.prisma.$transaction(async (tx) => {
        const updatedChapter = await tx.chapter.update({
          where: { id: chapterId },
          data: {
            title: dto.title,
            index: dto.index,
            isFree: dto.isFree,
            price: nextPrice,
            contentPath: dto.contentPath,
            publishStatus: dto.publishStatus,
          },
          select: {
            id: true,
            title: true,
            index: true,
            price: true,
            isFree: true,
            publishStatus: true,
          },
        });

        if (dto.contentPath !== undefined || chapterCountChange !== 0) {
          const book = await tx.book.update({
            where: { id: bookId },
            data: {
              ...(chapterCountChange > 0 && { chapterCount: { increment: 1 } }),
              ...(chapterCountChange < 0 && { chapterCount: { decrement: 1 } }),
              ...(dto.contentPath !== undefined && { lastContentUpdate: now }),
            },
            select: { title: true, coverImage: true, type: { select: { slug: true } } },
          });
          if (chapterCountChange > 0) {
            await this.outbox.create(tx, {
              type: DomainEventType.CHAPTER_PUBLISHED,
              version: 1,
              aggregateType: 'Chapter',
              aggregateId: String(updatedChapter.id),
              payload: {
                bookId,
                bookTitle: book.title,
                bookType: book.type.slug,
                coverImage: book.coverImage,
                chapterId: updatedChapter.id,
                chapterTitle: updatedChapter.title,
                chapterIndex: updatedChapter.index,
                publishedAt: now.toISOString(),
              },
            });
          }
        }

        return updatedChapter;
      });

      await this.publicService.clearHomeCache();
      await this.chapterCache.bumpListVersion(bookId);
      return chapter;
    } catch (err: any) {
      if (err?.code === 'P2002')
        throw new ConflictException('Chapter index already exists for this book');
      throw err;
    }
  }

  async deleteChapter(bookId: number, chapterId: number) {
    const existing = await this.prisma.chapter.findFirst({
      where: { id: chapterId, bookId },
    });
    if (!existing) throw new NotFoundException('Chapter not found');

    const isPublished = existing.publishStatus === 'PUBLISHED';
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.chapter.delete({ where: { id: chapterId } }),
      this.prisma.book.update({
        where: { id: bookId },
        data: {
          ...(isPublished && { chapterCount: { decrement: 1 } }),
          lastContentUpdate: now,
        },
      }),
    ]);

    await this.publicService.clearHomeCache();
    await this.cacheManager.del('stats:chapters:count');
    await this.chapterCache.bumpListVersion(bookId);
    return { id: chapterId, deleted: true };
  }

  async getAccessibleChapterByIndex(bookId: number, index: number, userId: number) {
    const chapter = await this.prisma.chapter.findFirst({
      where: { bookId, index },
      select: {
        id: true,
        bookId: true,
        title: true,
        index: true,
        contentPath: true,
        isFree: true,
        price: true,
        updatedAt: true,
      },
    });

    if (!chapter) throw new NotFoundException('Chapter not found');

    const hasAccess =
      chapter.isFree ||
      Boolean(
        await this.prisma.accessRecord.findFirst({
          where: { userId, chapterId: chapter.id },
          select: { id: true },
        }),
      );

    if (!hasAccess) throw new NotFoundException('Chapter access not found');

    return {
      ...chapter,
      price: chapter.price ? chapter.price.toNumber() : null,
    };
  }

  // User: purchase a chapter
  async purchaseChapter(userId: number, chapterId: number) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId, publishStatus: 'PUBLISHED' },
      select: {
        id: true,
        index: true,
        isFree: true,
        price: true,
        book: { select: { id: true, title: true } },
      },
    });

    if (!chapter) throw new NotFoundException('Chapter not found');

    // Free chapters: just grant chapter access
    if (chapter.isFree || chapter.price == null) {
      const existing = await this.prisma.accessRecord.findFirst({
        where: { userId, chapterId },
      });
      if (existing) return existing;

      // Recalculate inside a transaction for consistency
      return this.prisma.$transaction(async (tx) => {
        const record = await tx.accessRecord.create({
          data: { userId, chapterId, bookId: chapter.book.id },
        });
        return record;
      });
    }

    const existing = await this.prisma.accessRecord.findFirst({
      where: { userId, chapterId },
    });
    if (existing) return existing;

    // Debit + access record in tx
    return this.prisma.$transaction(async (tx) => {
      await this.walletsService.debit(
        userId,
        chapter.price!.toNumber(),
        `Purchase chapter ${chapter.index} | ${chapter.book.title}`,
        tx,
      );

      const record = await tx.accessRecord.create({
        data: { userId, chapterId, bookId: chapter.book.id },
      });

      return record;
    });
  }
}
