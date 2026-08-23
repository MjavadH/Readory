import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { notificationConfig } from '../notifications/notification.config';
import { searchSyncConfig } from '../search/config/search-sync.config';
import type { DomainEvent } from './domain-events';

@Injectable()
export class OutboxService {
  async create(tx: Prisma.TransactionClient, event: DomainEvent) {
    const baseData = {
      eventType: event.type,
      eventVersion: event.version,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      payload: event.payload as Prisma.InputJsonValue,
    };

    await Promise.all([
      tx.domainOutboxEvent.create({
        data: {
          ...baseData,
          maxAttempts: notificationConfig.maxAttempts,
        },
      }),

      tx.searchOutboxEvent.create({
        data: {
          ...baseData,
          maxAttempts: searchSyncConfig.maxAttempts,
        },
      }),
    ]);
  }
}
