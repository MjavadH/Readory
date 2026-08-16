import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DomainEvent } from './domain-events';
import { notificationConfig } from '../notifications/notification.config';
import { searchSyncConfig } from '../search/config/search-sync.config';

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
