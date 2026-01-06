import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

@Module({
  providers: [DashboardService, PrismaService, ConfigService],
  controllers: [DashboardController]
})
export class DashboardModule {}
