import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  DomainOutboxEvent,
  NotificationAudienceType,
  NotificationBroadcastStatus,
  NotificationCategory,
  OutboxEventStatus,
  Prisma,
} from '@prisma/client';
import { DomainEventType, NotificationType } from '@readory/shared';
import {
  AdminBroadcastRequestedEvent,
  BookPublishedEvent,
  ChapterPublishedEvent,
} from '../outbox/domain-events';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';
import { notificationConfig } from './notification.config';

type ClaimedOutboxEvent = DomainOutboxEvent;
type EventHandler<TPayload> = (event: ClaimedOutboxEvent, payload: TPayload) => Promise<void>;
type OutboxHandler = (event: ClaimedOutboxEvent) => Promise<void>;

@Injectable()
export class NotificationOutboxProcessor
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(NotificationOutboxProcessor.name);
  private readonly handlers: Record<string, OutboxHandler> = {
    [DomainEventType.CHAPTER_PUBLISHED]: this.withPayload(
        1,
        (payload): payload is ChapterPublishedEvent =>
            this.isChapterPublishedPayload(payload),
        this.handleChapter.bind(this),
    ),

    [DomainEventType.BOOK_PUBLISHED]: this.withPayload(
        1,
        (payload): payload is BookPublishedEvent =>
            this.isBookPublishedPayload(payload),
        this.handleBook.bind(this),
    ),

    [DomainEventType.ADMIN_BROADCAST_REQUESTED]: this.withPayload(
        1,
        (payload): payload is AdminBroadcastRequestedEvent =>
            this.isAdminBroadcastPayload(payload),
        this.handleBroadcast.bind(this),
    ),
  };
  private timer?: NodeJS.Timeout;
  private running = false;
  private readonly workerId = `${process.pid}-${Math.random().toString(36).slice(2)}`;

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(
      () => void this.tick(),
      notificationConfig.workerIntervalMs,
    );
    void this.tick();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const events = await this.claimBatch();
      await this.processWithConcurrency(events, notificationConfig.workerConcurrency);
    } finally {
      this.running = false;
    }
  }

  private async claimBatch(): Promise<ClaimedOutboxEvent[]> {
    const stale = new Date(Date.now() - notificationConfig.leaseMs);
    return this.prisma.$queryRaw<ClaimedOutboxEvent[]>`
      UPDATE "DomainOutboxEvent"
      SET "status"='PROCESSING'::"OutboxEventStatus", "lockedAt"=now(), "lockedBy"=${this.workerId}, "updatedAt"=now()
      WHERE "id" IN (
        SELECT "id" FROM "DomainOutboxEvent"
        WHERE (("status"='PENDING'::"OutboxEventStatus" AND "availableAt" <= now()) OR ("status"='PROCESSING'::"OutboxEventStatus" AND "lockedAt" < ${stale}))
        ORDER BY "availableAt" ASC, "id" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${notificationConfig.workerBatchSize}
      )
      RETURNING *`;
  }

  private async processWithConcurrency(events: ClaimedOutboxEvent[], concurrency: number) {
    let index = 0;
    const workers = Array.from({ length: Math.min(concurrency, events.length) }, async () => {
      for (;;) {
        const event = events[index++];
        if (!event) return;
        await this.processEvent(event);
      }
    });
    await Promise.all(workers);
  }

  private async processEvent(event: ClaimedOutboxEvent) {
    const heartbeat = this.startHeartbeat(event.id);
    try {
      const handler = this.handlers[event.eventType];
      if (!handler) throw new PermanentOutboxError(`Unsupported event type: ${event.eventType}`);
      await handler(event);
      await this.prisma.domainOutboxEvent.update({
        where: { id: event.id },
        data: {
          status: OutboxEventStatus.PROCESSED,
          processedAt: new Date(),
          lockedAt: null,
          lockedBy: null,
        },
      });
    } catch (error: unknown) {
      await this.fail(event, error);
    } finally {
      clearInterval(heartbeat);
    }
  }

  private startHeartbeat(eventId: string) {
    return setInterval(() => {
      void this.prisma.domainOutboxEvent.updateMany({
        where: { id: eventId, status: OutboxEventStatus.PROCESSING, lockedBy: this.workerId },
        data: { lockedAt: new Date() },
      });
    }, notificationConfig.leaseHeartbeatMs);
  }

  private withPayload<TPayload extends Prisma.JsonValue>(version: number, guard: (payload: Prisma.JsonValue) => payload is TPayload, handler: EventHandler<TPayload>): OutboxHandler {
    return async (event) => {
      if (event.eventVersion !== version || !guard(event.payload)) {
        throw new PermanentOutboxError(`Invalid payload for ${event.eventType} v${event.eventVersion}`);
      }
      await handler(event, event.payload);
    };
  }

  private async fail(event: ClaimedOutboxEvent, error: unknown) {
    const permanent = error instanceof PermanentOutboxError;
    const attempts = event.attempts + 1;
    const dead = permanent || attempts >= event.maxAttempts;
    const delay = Math.min(
      notificationConfig.retryBaseMs * 2 ** Math.max(attempts - 1, 0),
      3600_000,
    );
    const message = error instanceof Error ? error.message : String(error);
    this.logger.error(`Notification outbox ${event.id} failed attempt ${attempts}: ${message}`);
    await this.prisma.domainOutboxEvent.update({
      where: { id: event.id },
      data: {
        attempts,
        status: dead ? OutboxEventStatus.DEAD_LETTER : OutboxEventStatus.PENDING,
        availableAt: dead ? event.availableAt : new Date(Date.now() + delay),
        failedAt: dead ? new Date() : null,
        lockedAt: null,
        lockedBy: null,
        lastError: message.slice(0, 1000),
      },
    });
  }

  private async handleChapter(event: ClaimedOutboxEvent, payload: ChapterPublishedEvent) {
    const bookType = payload.bookType ?? (await this.resolveBookType(payload.bookId));
    let cursor = 0;
    let made = 0;
    for (;;) {
      const subs = await this.prisma.bookNotificationSubscription.findMany({
        where: { bookId: payload.bookId, userId: { gt: cursor }, user: { isBanned: false, OR: [{ notificationPreference: null }, { notificationPreference: { contentEnabled: true } }] } },
        orderBy: { userId: 'asc' },
        take: notificationConfig.batchSize,
        select: { userId: true },
      });
      if (!subs.length) break;
      cursor = subs[subs.length - 1].userId;
      made += await this.notifications.createMany(subs.map((s) => s.userId), {
        type: NotificationType.NEW_CHAPTER_PUBLISHED,
        category: NotificationCategory.CONTENT,
        title: `New chapter: ${payload.bookTitle}`,
        body: `${payload.chapterTitle} is now available.`,
        actionUrl: `/${bookType}/${payload.bookId}`,
        metadata: { bookId: payload.bookId, chapterId: payload.chapterId, chapterIndex: payload.chapterIndex },
        sourceType: 'Chapter',
        sourceId: String(payload.chapterId),
        dedupeParts: [event.id, NotificationType.NEW_CHAPTER_PUBLISHED],
      });
    }
    this.logger.log(`Processed chapter notification event ${event.id}; created ${made}`);
  }

  private async handleBook(event: ClaimedOutboxEvent, payload: BookPublishedEvent) {
    const bookType = payload.bookType ?? (await this.resolveBookType(payload.bookId));
    let cursor = 0;
    let made = 0;
    for (;;) {
      const users = await this.prisma.user.findMany({
        where: { id: { gt: cursor }, isBanned: false, OR: [{ notificationPreference: null }, { notificationPreference: { contentEnabled: true } }] },
        orderBy: { id: 'asc' },
        take: notificationConfig.batchSize,
        select: { id: true },
      });
      if (!users.length) break;
      cursor = users[users.length - 1].id;
      made += await this.notifications.createMany(users.map((u) => u.id), {
        type: NotificationType.NEW_BOOK_PUBLISHED,
        category: NotificationCategory.CONTENT,
        title: 'New book published',
        body: `${payload.title} is now available.`,
        actionUrl: `/${bookType}/${payload.bookId}`,
        metadata: { bookId: payload.bookId },
        sourceType: 'Book',
        sourceId: String(payload.bookId),
        dedupeParts: [event.id, NotificationType.NEW_BOOK_PUBLISHED],
      });
    }
    this.logger.log(`Processed book notification event ${event.id}; created ${made}`);
  }

  private async handleBroadcast(_event: ClaimedOutboxEvent, payload: AdminBroadcastRequestedEvent) {
    const broadcast = await this.prisma.notificationBroadcast.findUnique({ where: { id: payload.broadcastId } });
    if (!broadcast) throw new PermanentOutboxError(`Broadcast not found: ${payload.broadcastId}`);
    await this.prisma.notificationBroadcast.update({ where: { id: broadcast.id }, data: { status: NotificationBroadcastStatus.PROCESSING } });

    const totalRecipients = await this.countBroadcastRecipients(broadcast.audienceType, broadcast.targetUserIds);
    let cursor = broadcast.cursorUserId ?? 0;
    let processed = await this.countProcessedBroadcastRecipients(broadcast.id);
    let failed = false;

    for (;;) {
      const users = await this.findBroadcastRecipients(broadcast.audienceType, broadcast.targetUserIds, cursor);
      if (!users.length) break;
      const nextCursor = users[users.length - 1].id;
      try {
        await this.notifications.createMany(users.map((u) => u.id), {
          type: NotificationType.ADMIN_BROADCAST,
          category: NotificationCategory.ADMIN,
          title: broadcast.title,
          body: broadcast.body,
          actionUrl: broadcast.actionUrl,
          metadata: broadcast.metadata,
          expiresAt: broadcast.expiresAt,
          sourceType: 'NotificationBroadcast',
          sourceId: broadcast.id,
          dedupeParts: [broadcast.id, NotificationType.ADMIN_BROADCAST],
        });
        cursor = nextCursor;
      } catch (error) {
        failed = true;
        this.logger.error(`Broadcast ${broadcast.id} batch failed: ${error instanceof Error ? error.message : String(error)}`);
      }
      processed = await this.countProcessedBroadcastRecipients(broadcast.id);
      await this.prisma.notificationBroadcast.update({ where: { id: broadcast.id }, data: { cursorUserId: cursor, processedRecipients: processed, totalRecipients } });
      if (failed) break;
    }

    const status = processed >= totalRecipients ? NotificationBroadcastStatus.COMPLETED : failed ? (processed > 0 ? NotificationBroadcastStatus.PARTIALLY_FAILED : NotificationBroadcastStatus.FAILED) : NotificationBroadcastStatus.COMPLETED;
    await this.prisma.notificationBroadcast.update({ where: { id: broadcast.id }, data: { status, completedAt: status === NotificationBroadcastStatus.COMPLETED ? new Date() : null, processedRecipients: processed, totalRecipients } });
    if (failed) throw new Error(`Broadcast ${broadcast.id} failed after ${processed}/${totalRecipients} recipients`);
    this.logger.log(`Broadcast ${broadcast.id} completed; processed ${processed}/${totalRecipients}`);
  }

  private async resolveBookType(bookId: number) {
    const book = await this.prisma.book.findUnique({ where: { id: bookId }, select: { type: { select: { slug: true } } } });
    if (!book) throw new PermanentOutboxError(`Book not found: ${bookId}`);
    return book.type.slug;
  }

  private countBroadcastRecipients(audienceType: NotificationAudienceType, targetUserIds: number[]) {
    return this.prisma.user.count({ where: this.broadcastRecipientWhere(audienceType, targetUserIds, 0) });
  }

  private countProcessedBroadcastRecipients(broadcastId: string) {
    return this.prisma.notification.count({ where: { sourceType: 'NotificationBroadcast', sourceId: broadcastId } });
  }

  private findBroadcastRecipients(audienceType: NotificationAudienceType, targetUserIds: number[], cursor: number) {
    return this.prisma.user.findMany({
      where: this.broadcastRecipientWhere(audienceType, targetUserIds, cursor),
      orderBy: { id: 'asc' },
      take: notificationConfig.batchSize,
      select: { id: true },
    });
  }

  private broadcastRecipientWhere(audienceType: NotificationAudienceType, targetUserIds: number[], cursor: number): Prisma.UserWhereInput {
    return audienceType === NotificationAudienceType.ALL_USERS
      ? { id: { gt: cursor }, isBanned: false }
      : { id: { gt: cursor, in: targetUserIds }, isBanned: false };
  }

  private isBookPublishedPayload(payload: Prisma.JsonValue): payload is BookPublishedEvent {
    return this.isObject(payload) && this.isPositiveInt(payload.bookId) && typeof payload.title === 'string' && typeof payload.publishedAt === 'string' && (payload.bookType === undefined || typeof payload.bookType === 'string');
  }

  private isChapterPublishedPayload(payload: Prisma.JsonValue): payload is ChapterPublishedEvent {
    return this.isObject(payload) && this.isPositiveInt(payload.bookId) && typeof payload.bookTitle === 'string' && this.isPositiveInt(payload.chapterId) && typeof payload.chapterTitle === 'string' && this.isPositiveInt(payload.chapterIndex) && typeof payload.publishedAt === 'string' && (payload.bookType === undefined || typeof payload.bookType === 'string');
  }

  private isAdminBroadcastPayload(payload: Prisma.JsonValue): payload is AdminBroadcastRequestedEvent {
    return this.isObject(payload) && typeof payload.broadcastId === 'string';
  }

  private isObject(payload: Prisma.JsonValue): payload is Prisma.JsonObject {
    return typeof payload === 'object' && payload !== null && !Array.isArray(payload);
  }

  private isPositiveInt(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value > 0;
  }
}

class PermanentOutboxError extends Error {}
