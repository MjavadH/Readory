import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DomainEvent } from './domain-events';
import { notificationConfig } from '../notifications/notification.config';

@Injectable()
export class OutboxService {
  constructor(private prisma: PrismaService) {}

  create(tx: Prisma.TransactionClient, event: DomainEvent) {
    return tx.domainOutboxEvent.create({
      data: {
        eventType: event.type,
        eventVersion: event.version,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        payload: event.payload as Prisma.InputJsonValue,
        maxAttempts: notificationConfig.maxAttempts,
      },
    });
  }
}
