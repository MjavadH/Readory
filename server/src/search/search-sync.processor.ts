import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { OutboxEventStatus, type SearchOutboxEvent } from '@prisma/client';
import { DomainEventType } from '@readory/shared';
import type { PrismaService } from '../prisma/prisma.service';
import { searchSyncConfig } from './config/search-sync.config';
import type { BookSearchDocument, SearchService } from './search.service';

type ClaimedOutboxEvent = SearchOutboxEvent;
type OutboxHandler = (event: ClaimedOutboxEvent) => Promise<void>;

interface SyncEventPayload {
  bookId: number;
}

@Injectable()
export class SearchSyncProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SearchSyncProcessor.name);

  // Mapping domain events to sync logic
  private readonly handlers: Record<string, OutboxHandler> = {
    [DomainEventType.BOOK_PUBLISHED]: this.handleBookSync.bind(this),
    [DomainEventType.BOOK_UPDATED]: this.handleBookSync.bind(this),
    [DomainEventType.BOOK_DELETED]: this.handleBookDelete.bind(this),
  };

  private timer?: NodeJS.Timeout;
  private running = false;
  private readonly workerId = `${process.pid}-${Math.random().toString(36).slice(2)}`;

  constructor(
    private prisma: PrismaService,
    private searchService: SearchService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.tick(), searchSyncConfig.workerIntervalMs);
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
      await this.processWithConcurrency(events, searchSyncConfig.workerConcurrency);
    } finally {
      this.running = false;
    }
  }

  private async claimBatch(): Promise<ClaimedOutboxEvent[]> {
    const stale = new Date(Date.now() - searchSyncConfig.leaseMs);
    return this.prisma.$queryRaw<ClaimedOutboxEvent[]>`
      UPDATE "SearchOutboxEvent"
      SET "status"='PROCESSING'::"OutboxEventStatus", "lockedAt"=now(), "lockedBy"=${this.workerId}, "updatedAt"=now()
      WHERE "id" IN (
        SELECT "id" FROM "SearchOutboxEvent"
        WHERE (("status"='PENDING'::"OutboxEventStatus" AND "availableAt" <= now()) OR ("status"='PROCESSING'::"OutboxEventStatus" AND "lockedAt" < ${stale}))
        ORDER BY "availableAt" ASC, "id" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${searchSyncConfig.workerBatchSize}
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

      if (!handler) {
        this.logger.debug(`Ignoring unrelated search event type: ${event.eventType}`);
      } else {
        await handler(event);
      }

      const result = await this.prisma.searchOutboxEvent.updateMany({
        where: {
          id: event.id,
          status: OutboxEventStatus.PROCESSING,
          lockedBy: this.workerId,
        },
        data: {
          status: OutboxEventStatus.PROCESSED,
          processedAt: new Date(),
          lockedAt: null,
          lockedBy: null,
        },
      });

      if (result.count !== 1) {
        this.logger.warn(`Search outbox ${event.id} lease was lost before completion.`);
      }
    } catch (error: unknown) {
      await this.fail(event, error);
    } finally {
      clearInterval(heartbeat);
    }
  }

  private startHeartbeat(eventId: string) {
    return setInterval(() => {
      void this.prisma.searchOutboxEvent.updateMany({
        where: { id: eventId, status: OutboxEventStatus.PROCESSING, lockedBy: this.workerId },
        data: { lockedAt: new Date() },
      });
    }, searchSyncConfig.leaseHeartbeatMs);
  }

  private async fail(event: ClaimedOutboxEvent, error: unknown) {
    const attempts = event.attempts + 1;
    const dead = attempts >= event.maxAttempts;
    const delay = Math.min(searchSyncConfig.retryBaseMs * 2 ** Math.max(attempts - 1, 0), 3600_000);

    const message = error instanceof Error ? error.message : String(error);

    this.logger.error(`Search outbox ${event.id} failed attempt ${attempts}: ${message}`);

    const result = await this.prisma.searchOutboxEvent.updateMany({
      where: {
        id: event.id,
        status: OutboxEventStatus.PROCESSING,
        lockedBy: this.workerId,
      },
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

    if (result.count !== 1) {
      this.logger.warn(`Search outbox ${event.id} lease was lost before failure handling.`);
    }
  }

  // Idempotent State-Based Sync Implementation
  private async handleBookSync(event: ClaimedOutboxEvent) {
    const payload = event.payload as unknown as SyncEventPayload;
    const bookId = payload.bookId;

    if (!Number.isSafeInteger(bookId) || bookId <= 0) {
      throw new Error('Invalid payload: missing bookId');
    }

    // Always fetch the LATEST state directly from PostgreSQL
    const book = await this.prisma.book.findUnique({
      where: { id: bookId },
      include: {
        type: true,
        genres: { include: { genre: true } },
        contributors: {
          include: { contributor: true },
        },
      },
    });

    // Book might have been deleted before the CREATE/UPDATE event was processed
    if (!book) {
      await this.searchService.deleteBook(bookId);
      return;
    }

    const document: BookSearchDocument = {
      id: book.id,
      title: book.title,
      originalTitle: book.originalTitle,
      alternativeTitles: book.alternativeTitles,
      coverImage: book.coverImage || null,
      bookTypeSlug: book.type.slug,
      genreSlugs: book.genres.map((bg) => bg.genre.slug),
      publishStatus: book.publishStatus,
      trendScore: Number(book.trendScore || 0),
      popularityScore: Number(book.popularityScore || 0),
      createdAt: book.createdAt.getTime(),
      lastContentUpdate: (book.lastContentUpdate ?? book.updatedAt).getTime(),
      typeIsActive: book.type.isActive,
      isFeatured: book.isFeatured,
      status: book.status,
      ageRating: book.ageRating,
    };

    await this.searchService.syncBook(document);
    this.logger.log(`Synced book ${book.id} to Meilisearch`);
  }

  private async handleBookDelete(event: ClaimedOutboxEvent) {
    const payload = event.payload as unknown as SyncEventPayload;
    const bookId = payload.bookId;

    if (!Number.isSafeInteger(bookId) || bookId <= 0) {
      throw new Error('Invalid payload: missing bookId');
    }

    await this.searchService.deleteBook(bookId);
    this.logger.log(`Deleted book ${bookId} from Meilisearch`);
  }
}
