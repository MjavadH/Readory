import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DomainEvent } from './domain-events';
import { notificationConfig } from '../notifications/notification.config';

@Injectable()
export class OutboxService {
  constructor() {}

  async create(tx: Prisma.TransactionClient, event: DomainEvent) {
    const outboxData = {
      eventType: event.type,
      eventVersion: event.version,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      payload: event.payload as Prisma.InputJsonValue,
      maxAttempts: notificationConfig.maxAttempts,
    };

    await Promise.all([
      tx.domainOutboxEvent.create({ data: outboxData }),
      tx.searchOutboxEvent.create({ data: outboxData }),
    ]);
  }
}
