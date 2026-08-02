import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OutboxModule } from '../outbox/outbox.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationOutboxProcessor } from './notification-outbox.processor';
@Module({
  imports: [PrismaModule, OutboxModule, AuditLogModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationOutboxProcessor],
  exports: [NotificationsService],
})
export class NotificationsModule {}
