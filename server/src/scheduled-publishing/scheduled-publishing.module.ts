import { Module } from '@nestjs/common';
import { ScheduledPublishingController } from './scheduled-publishing.controller';
import { ScheduledPublishingService } from './scheduled-publishing.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CacheModule } from '../cache/cache.module';
import { PublicModule } from '../public/public.module';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [PrismaModule, CacheModule, PublicModule, AuditLogModule],
  controllers: [ScheduledPublishingController],
  providers: [ScheduledPublishingService],
  exports: [ScheduledPublishingService],
})
export class ScheduledPublishingModule {}
