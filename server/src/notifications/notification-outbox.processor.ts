import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { DomainEventType, NotificationType } from '@readory/shared';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';
import { notificationConfig } from './notification.config';

@Injectable()
export class NotificationOutboxProcessor
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(NotificationOutboxProcessor.name);
  private timer?: NodeJS.Timeout;
  private workerId = `${process.pid}-${Math.random().toString(36).slice(2)}`;
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
    const event = await this.claimOne();
    if (!event) return;
    try {
      if (event.eventType === DomainEventType.CHAPTER_PUBLISHED)
        await this.handleChapter(event);
      else if (event.eventType === DomainEventType.BOOK_PUBLISHED)
        await this.handleBook(event);
      else if (event.eventType === DomainEventType.ADMIN_BROADCAST_REQUESTED)
        await this.handleBroadcast(event);
      await this.prisma.domainOutboxEvent.update({
        where: { id: event.id },
        data: {
          status: 'PROCESSED' as any,
          processedAt: new Date(),
          lockedAt: null,
          lockedBy: null,
        },
      });
    } catch (error: any) {
      await this.fail(event, error);
    }
  }

  private async claimOne() {
    const stale = new Date(Date.now() - notificationConfig.leaseMs);
    const rows = await this.prisma.$queryRaw<any[]>`
      UPDATE "DomainOutboxEvent" SET "status"='PROCESSING'::"OutboxEventStatus", "lockedAt"=now(), "lockedBy"=${this.workerId}, "updatedAt"=now()
      WHERE "id" = (SELECT "id" FROM "DomainOutboxEvent" WHERE ("status"='PENDING'::"OutboxEventStatus" AND "availableAt" <= now()) OR ("status"='PROCESSING'::"OutboxEventStatus" AND "lockedAt" < ${stale}) ORDER BY "availableAt" ASC, "id" ASC FOR UPDATE SKIP LOCKED LIMIT 1)
      RETURNING *`;
    return rows[0] ?? null;
  }

  private async fail(event: any, error: any) {
    const attempts = event.attempts + 1;
    const dead = attempts >= event.maxAttempts;
    const delay = Math.min(
      notificationConfig.retryBaseMs * 2 ** Math.max(attempts - 1, 0),
      3600_000,
    );
    this.logger.error(
      `Notification outbox ${event.id} failed attempt ${attempts}: ${error?.message ?? error}`,
    );
    await this.prisma.domainOutboxEvent.update({
      where: { id: event.id },
      data: {
        attempts,
        status: (dead ? 'DEAD_LETTER' : 'PENDING') as any,
        availableAt: new Date(Date.now() + delay),
        failedAt: dead ? new Date() : null,
        lockedAt: null,
        lockedBy: null,
        lastError: String(error?.message ?? error).slice(0, 1000),
      },
    });
  }

  private async handleChapter(event: any) {
    const p = event.payload;
    let cursor = 0;
    let made = 0;
    for (;;) {
      const subs = await this.prisma.bookNotificationSubscription.findMany({
        where: {
          bookId: p.bookId,
          userId: { gt: cursor },
          user: {
            isBanned: false,
            OR: [
              { notificationPreference: null },
              { notificationPreference: { contentEnabled: true } },
            ],
          },
        },
        orderBy: { userId: 'asc' },
        take: notificationConfig.batchSize,
        select: { userId: true },
      });
      if (!subs.length) break;
      cursor = subs[subs.length - 1].userId;
      made += await this.notifications.createMany(
        subs.map((s) => s.userId),
        {
          type: NotificationType.NEW_CHAPTER_PUBLISHED,
          category: 'CONTENT' as any,
          title: `New chapter: ${p.bookTitle}`,
          body: `${p.chapterTitle} is now available.`,
          actionUrl: `/books/${p.bookId}`,
          metadata: {
            bookId: p.bookId,
            chapterId: p.chapterId,
            chapterIndex: p.chapterIndex,
          },
          sourceType: 'Chapter',
          sourceId: String(p.chapterId),
          dedupeParts: [event.id, NotificationType.NEW_CHAPTER_PUBLISHED],
        },
      );
    }
    this.logger.log(
      `Processed chapter notification event ${event.id}; created ${made}`,
    );
  }

  private async handleBook(event: any) {
    const p = event.payload;
    let cursor = 0;
    let made = 0;
    for (;;) {
      const users = await this.prisma.user.findMany({
        where: {
          id: { gt: cursor },
          isBanned: false,
          OR: [
            { notificationPreference: null },
            { notificationPreference: { contentEnabled: true } },
          ],
        },
        orderBy: { id: 'asc' },
        take: notificationConfig.batchSize,
        select: { id: true },
      });
      if (!users.length) break;
      cursor = users[users.length - 1].id;
      made += await this.notifications.createMany(
        users.map((u) => u.id),
        {
          type: NotificationType.NEW_BOOK_PUBLISHED,
          category: 'CONTENT' as any,
          title: 'New book published',
          body: `${p.title} is now available.`,
          actionUrl: `/books/${p.bookId}`,
          metadata: { bookId: p.bookId },
          sourceType: 'Book',
          sourceId: String(p.bookId),
          dedupeParts: [event.id, NotificationType.NEW_BOOK_PUBLISHED],
        },
      );
    }
    this.logger.log(
      `Processed book notification event ${event.id}; created ${made}`,
    );
  }

  private async handleBroadcast(event: any) {
    const { broadcastId } = event.payload;
    const b = await this.prisma.notificationBroadcast.findUnique({
      where: { id: broadcastId },
    });
    if (!b) return;
    await this.prisma.notificationBroadcast.update({
      where: { id: b.id },
      data: { status: 'PROCESSING' as any },
    });
    let cursor = b.cursorUserId ?? 0;
    let processed = 0;
    let created = 0;
    for (;;) {
      const where: any =
        b.audienceType === 'ALL_USERS'
          ? { id: { gt: cursor }, isBanned: false }
          : { id: { gt: cursor, in: b.targetUserIds }, isBanned: false };
      const users = await this.prisma.user.findMany({
        where,
        orderBy: { id: 'asc' },
        take: notificationConfig.batchSize,
        select: { id: true },
      });
      if (!users.length) break;
      cursor = users[users.length - 1].id;
      processed += users.length;
      created += await this.notifications.createMany(
        users.map((u) => u.id),
        {
          type: NotificationType.ADMIN_BROADCAST,
          category: 'ADMIN' as any,
          title: b.title,
          body: b.body,
          actionUrl: b.actionUrl,
          metadata: b.metadata,
          expiresAt: b.expiresAt,
          sourceType: 'NotificationBroadcast',
          sourceId: b.id,
          dedupeParts: [b.id, NotificationType.ADMIN_BROADCAST],
        },
      );
      await this.prisma.notificationBroadcast.update({
        where: { id: b.id },
        data: {
          cursorUserId: cursor,
          processedRecipients: { increment: users.length },
          totalRecipients: { increment: users.length },
        },
      });
    }
    await this.prisma.notificationBroadcast.update({
      where: { id: b.id },
      data: {
        status: 'COMPLETED' as any,
        completedAt: new Date(),
        processedRecipients: processed,
        totalRecipients: processed,
      },
    });
    this.logger.log(`Broadcast ${b.id} completed; created ${created}`);
  }
}
