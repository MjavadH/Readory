import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { OutboxModule } from '../outbox/outbox.module';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationOutboxProcessor } from './notification-outbox.processor';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
@Module({
  imports: [PrismaModule, OutboxModule, AuditLogModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationOutboxProcessor],
  exports: [NotificationsService],
})
export class NotificationsModule {}
