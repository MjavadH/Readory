import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  Notification,
  NotificationAudienceType as PrismaNotificationAudienceType,
  NotificationCategory,
  Prisma,
} from '@prisma/client';
import {
  AuditAction,
  AuditCategory,
  DomainEventType,
  NotificationAudienceType,
} from '@readory/shared';
import { PrismaService } from '../prisma/prisma.service';
import { OutboxService } from '../outbox/outbox.service';
import { notificationConfig } from './notification.config';
import {
  compactMetadata,
  decodeCursor,
  dedupeKey,
  encodeCursor,
  MAX_BODY_LENGTH,
  MAX_TITLE_LENGTH,
  sanitizeText,
  validateActionUrl,
} from './notification.utils';
import { CreateBroadcastDto } from './dto/create-broadcast.dto';
import { AuditLogService } from '../audit-log/audit-log.service';

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private outbox: OutboxService,
    private audit: AuditLogService,
  ) {}

  async list(userId: number, limitInput = 20, cursor?: string) {
    const limit = Math.min(Math.max(Number(limitInput) || 20, 1), 50);
    const c = decodeCursor(cursor);
    const where: Prisma.NotificationWhereInput = {
      recipientUserId: userId,
      dismissedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    };
    const seek = c
      ? {
          OR: [
            { createdAt: { lt: new Date(c.createdAt) } },
            {
              AND: [{ createdAt: new Date(c.createdAt) }, { id: { lt: c.id } }],
            },
          ],
        }
      : null;
    const rows = await this.prisma.notification.findMany({
      where: seek ? { AND: [where, seek] } : where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const page = rows.slice(0, limit);
    return {
      items: page.map(this.toApi),
      nextCursor:
        rows.length > limit
          ? encodeCursor(page[page.length - 1].createdAt, page[page.length - 1].id)
          : null,
    };
  }

  async unreadCount(userId: number) {
    const unreadCount = await this.prisma.notification.count({
      where: {
        recipientUserId: userId,
        readAt: null,
        dismissedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });
    return { unreadCount };
  }

  async markRead(userId: number, id: string) {
    await this.prisma.notification.updateMany({
      where: { id, recipientUserId: userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { id, read: true };
  }

  async markAllRead(userId: number, ids?: string[]) {
    const where: Prisma.NotificationWhereInput = {
      recipientUserId: userId,
      readAt: null,
      ...(ids?.length ? { id: { in: ids.slice(0, 1000) } } : {}),
    };
    const result = await this.prisma.notification.updateMany({
      where,
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }

  async dismiss(userId: number, id: string) {
    const result = await this.prisma.notification.updateMany({
      where: { id, recipientUserId: userId, dismissedAt: null },
      data: { dismissedAt: new Date(), readAt: new Date() },
    });
    if (!result.count) throw new NotFoundException('notification not found');
    return { id, dismissed: true };
  }

  async getSubscription(userId: number, bookId: number) {
    const sub = await this.prisma.bookNotificationSubscription.findUnique({
      where: { userId_bookId: { userId, bookId } },
    });
    return { subscribed: Boolean(sub) };
  }

  async subscribe(userId: number, bookId: number) {
    const book = await this.prisma.book.findUnique({
      where: { id: bookId },
      select: { id: true },
    });
    if (!book) throw new NotFoundException('book not found');
    await this.prisma.bookNotificationSubscription.upsert({
      where: { userId_bookId: { userId, bookId } },
      create: { userId, bookId },
      update: {},
    });
    return { subscribed: true };
  }

  async unsubscribe(userId: number, bookId: number) {
    await this.prisma.bookNotificationSubscription.deleteMany({
      where: { userId, bookId },
    });
    return { subscribed: false };
  }

  async createBroadcast(dto: CreateBroadcastDto, actorId?: number) {
    const title = sanitizeText(dto.title, 'title', MAX_TITLE_LENGTH);
    const body = sanitizeText(dto.body, 'body', MAX_BODY_LENGTH);
    const actionUrl = validateActionUrl(dto.actionUrl);
    const targetUserIds = [...new Set(dto.targetUserIds ?? [])];
    if (dto.audienceType !== NotificationAudienceType.ALL_USERS && targetUserIds.length === 0)
      throw new BadRequestException('targetUserIds required');
    if (targetUserIds.length > notificationConfig.broadcastMaxSelectedUsers)
      throw new BadRequestException('too many target users');
    const created = await this.prisma.$transaction(async (tx) => {
      const broadcast = await tx.notificationBroadcast.create({
        data: {
          title,
          body,
          actionUrl,
          metadata: compactMetadata(dto.metadata) as Prisma.InputJsonValue,
          audienceType: dto.audienceType as PrismaNotificationAudienceType,
          targetUserIds,
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
          createdById: actorId,
          idempotencyKey: dto.idempotencyKey,
        },
      });
      await this.outbox.create(tx, {
        type: DomainEventType.ADMIN_BROADCAST_REQUESTED,
        version: 1,
        aggregateType: 'NotificationBroadcast',
        aggregateId: broadcast.id,
        payload: { broadcastId: broadcast.id },
      });
      return broadcast;
    });
    this.audit.log({
      action: AuditAction.BROADCAST_SENT,
      category: AuditCategory.SYSTEM,
      targetType: 'NotificationBroadcast',
      targetId: created.id,
      actorId,
      metadata: { audienceType: created.audienceType },
    });
    return created;
  }

  async listBroadcasts(page = 1, limit = 20) {
    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const safePage = Math.max(Number(page) || 1, 1);
    const [data, total] = await Promise.all([
      this.prisma.notificationBroadcast.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
      }),
      this.prisma.notificationBroadcast.count(),
    ]);
    return {
      data,
      total,
      page: safePage,
      lastPage: Math.ceil(total / safeLimit),
    };
  }

  async createMany(
    recipients: number[],
    input: {
      type: string;
      category: NotificationCategory;
      title: string;
      body: string;
      actionUrl?: string | null;
      metadata?: Prisma.InputJsonValue | Prisma.JsonValue | null;
      sourceType?: string;
      sourceId?: string;
      dedupeParts: Array<string | number>;
      expiresAt?: Date | null;
    },
  ) {
    if (!recipients.length) return 0;
    const data = recipients.map((recipientUserId) => ({
      recipientUserId,
      type: input.type,
      category: input.category,
      title: input.title,
      body: input.body,
      actionUrl: input.actionUrl,
      metadata:
        input.metadata === null
          ? Prisma.JsonNull
          : (input.metadata as Prisma.InputJsonValue | undefined),
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      expiresAt: input.expiresAt,
      deduplicationKey: dedupeKey([recipientUserId, ...input.dedupeParts]),
    }));
    const result = await this.prisma.notification.createMany({
      data,
      skipDuplicates: true,
    });
    return result.count;
  }

  private toApi(row: Notification) {
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      metadata: row.metadata ?? undefined,
      actionUrl: row.actionUrl,
      readAt: row.readAt?.toISOString?.() ?? null,
      createdAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt?.toISOString?.() ?? null,
    };
  }
}
