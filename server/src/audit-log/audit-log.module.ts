import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from '../prisma/prisma.module';
import { CacheModule } from '../cache/cache.module';
import { AuditLogController } from './audit-log.controller';
import { AuditLogRepository } from './audit-log.repository';
import { AuditLogService } from './audit-log.service';
import { AuditLogInterceptor } from './interceptors/audit-log.interceptor';

@Module({
  imports: [PrismaModule, CacheModule],
  controllers: [AuditLogController],
  providers: [AuditLogRepository, AuditLogService, { provide: APP_INTERCEPTOR, useClass: AuditLogInterceptor }],
  exports: [AuditLogService],
})
export class AuditLogModule {}
