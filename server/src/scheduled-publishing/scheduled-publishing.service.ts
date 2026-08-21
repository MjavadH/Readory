import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheManager } from '../cache/cache.manager';
import { PublicService } from '../public/public.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import {
  Prisma,
  ScheduledPublication,
  ScheduledPublicationStatus,
  ScheduledTargetType,
} from '@prisma/client';
import { DomainEventType, PublicationStatus } from '@readory/shared';
import { OutboxService } from '../outbox/outbox.service';
import { ChapterCache } from '../cache/chapter-cache.service';

const QUEUE_NAME = 'scheduled-publications';
const ACTIVE_STATUSES = [ScheduledPublicationStatus.Pending, ScheduledPublicationStatus.Processing];

type BullQueue = {
  add: (name: string, data: any, options?: any) => Promise<any>;
  close: () => Promise<void>;
};
type BullWorker = { close: () => Promise<void> };

@Injectable()
export class ScheduledPublishingService implements OnModuleInit, OnModuleDestroy {
  private queue?: BullQueue;
  private worker?: BullWorker;

  constructor(
    private prisma: PrismaService,
    private cache: CacheManager,
    private publicService: PublicService,
    private auditLog: AuditLogService,
    private outbox: OutboxService,
    private chapterCache: ChapterCache,
  ) {}

  async onModuleInit() {
    const bullmq = await import('bullmq');
    const connection = {
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      maxRetriesPerRequest: null,
    };
    this.queue = new bullmq.Queue(QUEUE_NAME, { connection });
    this.worker = new bullmq.Worker(
      QUEUE_NAME,
      async (job: { data: { scheduleId: number } }) => this.publishSchedule(job.data.scheduleId),
      { connection, concurrency: Number(process.env.SCHEDULED_PUBLICATION_CONCURRENCY || 5) },
    );
    await this.enqueueDueAndPendingSchedules();
  }

  async onModuleDestroy() {
    await Promise.all([this.worker?.close(), this.queue?.close()]);
  }

  async list(query: { page?: number; limit?: number; status?: string }) {
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
    const where =
      query.status && query.status !== 'ALL'
        ? { status: query.status as ScheduledPublicationStatus }
        : {};
    const [data, total] = await Promise.all([
      this.prisma.scheduledPublication.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.scheduledPublication.count({ where }),
    ]);
    return {
      data: await Promise.all(data.map((i) => this.withTargetName(i))),
      total,
      page,
      limit,
      lastPage: Math.ceil(total / limit),
    };
  }

  async create(dto: CreateScheduleDto, actorId?: number) {
    const publishAt = this.parsePublishAt(dto.publishAt);
    await this.assertTargetExists(dto.targetType, dto.targetId);
    const existing = await this.prisma.scheduledPublication.findFirst({
      where: {
        targetType: dto.targetType,
        targetId: dto.targetId,
        status: { in: ACTIVE_STATUSES },
      },
    });
    if (existing)
      throw new BadRequestException('An active schedule already exists for this content');
    const schedule = await this.prisma.$transaction(async (tx) => {
      const created = await tx.scheduledPublication.create({
        data: {
          targetType: dto.targetType,
          targetId: dto.targetId,
          publishAt,
          maxRetries: dto.maxRetries ?? 3,
          createdById: actorId,
          statusChangedAt: new Date(),
        },
      });
      await this.markContentStatus(tx, dto.targetType, dto.targetId, PublicationStatus.SCHEDULED);
      return created;
    });
    await this.enqueueSchedule(schedule);
    this.audit('SCHEDULE_CREATED', schedule, actorId, undefined, schedule);
    await this.invalidate(schedule);
    return this.withTargetName(schedule);
  }

  async update(id: number, dto: UpdateScheduleDto, actorId?: number) {
    const before = await this.prisma.scheduledPublication.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Schedule not found');
    if (before.status !== ScheduledPublicationStatus.Pending)
      throw new BadRequestException('Only pending schedules can be edited');
    const schedule = await this.prisma.scheduledPublication.update({
      where: { id },
      data: {
        publishAt: this.parsePublishAt(dto.publishAt),
        maxRetries: dto.maxRetries ?? before.maxRetries,
        error: null,
      },
    });
    await this.enqueueSchedule(schedule);
    this.audit('SCHEDULE_UPDATED', schedule, actorId, before, schedule);
    return this.withTargetName(schedule);
  }

  async cancel(id: number, actorId?: number) {
    const before = await this.prisma.scheduledPublication.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Schedule not found');
    if (
      !(
        [
          ScheduledPublicationStatus.Pending,
          ScheduledPublicationStatus.FAILED,
        ] as ScheduledPublicationStatus[]
      ).includes(before.status)
    )
      throw new BadRequestException('Schedule cannot be cancelled');
    const schedule = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.scheduledPublication.update({
        where: { id },
        data: { status: ScheduledPublicationStatus.Canceled, statusChangedAt: new Date() },
      });
      await this.markContentStatus(tx, before.targetType, before.targetId, PublicationStatus.DRAFT);
      return updated;
    });
    this.audit('SCHEDULE_CANCELLED', schedule, actorId, before, schedule);
    await this.invalidate(schedule);
    return this.withTargetName(schedule);
  }

  async publishNow(id: number, actorId?: number) {
    await this.publishSchedule(id, true, actorId);
    return this.withTargetName(
      await this.prisma.scheduledPublication.findUniqueOrThrow({ where: { id } }),
    );
  }

  private async enqueueDueAndPendingSchedules() {
    const schedules = await this.prisma.scheduledPublication.findMany({
      where: { status: ScheduledPublicationStatus.Pending },
    });
    await Promise.all(schedules.map((schedule) => this.enqueueSchedule(schedule)));
  }

  private async enqueueSchedule(schedule: ScheduledPublication) {
    if (!this.queue || schedule.status !== ScheduledPublicationStatus.Pending) return;
    await this.queue.add(
      'publish',
      { scheduleId: schedule.id },
      {
        jobId: `scheduled-publication-${schedule.id}`,
        delay: Math.max(schedule.publishAt.getTime() - Date.now(), 0),
        attempts: 1,
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  }

  private async publishSchedule(id: number, immediate = false, actorId?: number) {
    const claimed = await this.prisma.scheduledPublication.updateMany({
      where: {
        id,
        status: ScheduledPublicationStatus.Pending,
      },
      data: {
        status: ScheduledPublicationStatus.Processing,
        statusChangedAt: new Date(),
        lastAttemptAt: new Date(),
        error: null,
      },
    });
    if (claimed.count !== 1) return;
    const schedule = await this.prisma.scheduledPublication.findUniqueOrThrow({ where: { id } });
    try {
      const now = new Date();
      await this.prisma.$transaction(async (tx) => {
        await this.publishTarget(tx, schedule.targetType, schedule.targetId, now);
        await tx.scheduledPublication.update({
          where: { id },
          data: { status: ScheduledPublicationStatus.Published, statusChangedAt: now },
        });
      });
      this.audit(
        immediate ? 'SCHEDULE_PUBLISHED_IMMEDIATELY' : 'SCHEDULE_PUBLISHED',
        schedule,
        actorId,
        schedule,
        {
          ...schedule,
          status: ScheduledPublicationStatus.Published,
        },
      );
      await this.invalidate(schedule);
    } catch (error: any) {
      const retryCount = schedule.retryCount + 1;
      const nextStatus =
        retryCount >= schedule.maxRetries
          ? ScheduledPublicationStatus.FAILED
          : ScheduledPublicationStatus.Pending;
      const failed = await this.prisma.scheduledPublication.update({
        where: { id },
        data: {
          status: nextStatus,
          statusChangedAt: new Date(),
          retryCount,
          lastAttemptAt: new Date(),
          error: error?.message || 'Unknown error',
        },
      });
      if (nextStatus === ScheduledPublicationStatus.Pending) await this.enqueueSchedule(failed);
      throw error;
    }
  }

  private parsePublishAt(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Invalid publishAt');
    return date;
  }

  private async assertTargetExists(type: ScheduledTargetType, id: number) {
    const found =
      type === ScheduledTargetType.BOOK
        ? await this.prisma.book.findUnique({ where: { id } })
        : type === ScheduledTargetType.Chapter
          ? await this.prisma.chapter.findUnique({ where: { id } })
          : null;
    if (!found) throw new NotFoundException('Scheduled content not found');
  }

  private async markContentStatus(
    tx: Prisma.TransactionClient,
    type: ScheduledTargetType,
    id: number,
    status: PublicationStatus,
  ) {
    if (type === ScheduledTargetType.BOOK)
      await tx.book.update({
        where: { id },
        data: { publishStatus: status },
      });
    else if (type === ScheduledTargetType.Chapter)
      await tx.chapter.update({
        where: { id },
        data: { publishStatus: status },
      });
  }

  private async publishTarget(
    tx: Prisma.TransactionClient,
    type: ScheduledTargetType,
    id: number,
    now: Date,
  ) {
    if (type === ScheduledTargetType.BOOK) {
      const before = await tx.book.findUnique({ where: { id }, select: { publishStatus: true } });
      const book = await tx.book.update({
        where: { id },
        data: { publishStatus: PublicationStatus.PUBLISHED, lastContentUpdate: now },
        select: {
          id: true,
          title: true,
          coverImage: true,
          publishStatus: true,
          type: { select: { slug: true } },
        },
      });
      if (before?.publishStatus !== PublicationStatus.PUBLISHED)
        await this.outbox.create(tx, {
          type: DomainEventType.BOOK_PUBLISHED,
          version: 1,
          aggregateType: 'Book',
          aggregateId: String(book.id),
          payload: {
            bookId: book.id,
            title: book.title,
            bookType: book.type.slug,
            coverImage: book.coverImage,
            publishedAt: now.toISOString(),
          },
        });
    } else if (type === ScheduledTargetType.Chapter) {
      const before = await tx.chapter.findUnique({
        where: { id },
        select: { publishStatus: true },
      });
      const chapter = await tx.chapter.update({
        where: { id },
        data: { publishStatus: PublicationStatus.PUBLISHED },
        select: { id: true, bookId: true, title: true, index: true },
      });
      const book = await tx.book.update({
        where: { id: chapter.bookId },
        data: {
          lastContentUpdate: now,
          chapterCount: { increment: 1 },
        },
        select: { title: true, coverImage: true, type: { select: { slug: true } } },
      });
      if (before?.publishStatus !== PublicationStatus.PUBLISHED)
        await this.outbox.create(tx, {
          type: DomainEventType.CHAPTER_PUBLISHED,
          version: 1,
          aggregateType: 'Chapter',
          aggregateId: String(chapter.id),
          payload: {
            bookId: chapter.bookId,
            bookTitle: book.title,
            bookType: book.type.slug,
            coverImage: book.coverImage,
            chapterId: chapter.id,
            chapterTitle: chapter.title,
            chapterIndex: chapter.index,
            publishedAt: now.toISOString(),
          },
        });
    } else throw new BadRequestException('Unsupported scheduled target type');
  }

  private async invalidate(schedule?: ScheduledPublication) {
    await Promise.all([
      this.publicService.clearHomeCache(),
      this.cache.del('books:browse:default'),
      this.cache.del('stats:books'),
      this.cache.del('stats:chapters:count'),
    ]);

    if (schedule?.targetType === ScheduledTargetType.Chapter) {
      const chapter = await this.prisma.chapter.findUnique({
        where: { id: schedule.targetId },
        select: { bookId: true },
      });

      if (chapter) {
        await this.chapterCache.bumpListVersion(chapter.bookId);
      }
    }
  }

  private audit(
    action: string,
    schedule: ScheduledPublication,
    actorId?: number,
    before?: any,
    after?: any,
  ) {
    this.auditLog.log({
      action: action as any,
      category: 'CONTENT' as any,
      targetType: 'ScheduledPublication',
      targetId: schedule.id,
      actorId,
      metadata: { scheduledTargetType: schedule.targetType, scheduledTargetId: schedule.targetId },
      before,
      after,
    });
  }

  private async withTargetName(item: ScheduledPublication) {
    const target =
      item.targetType === ScheduledTargetType.BOOK
        ? await this.prisma.book.findUnique({
            where: { id: item.targetId },
            select: { title: true },
          })
        : item.targetType === ScheduledTargetType.Chapter
          ? await this.prisma.chapter.findUnique({
              where: { id: item.targetId },
              select: { title: true },
            })
          : null;
    return { ...item, targetName: target?.title ?? `#${item.targetId}` };
  }
}
