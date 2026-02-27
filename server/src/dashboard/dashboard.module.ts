import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import {WalletsModule} from "../wallets/wallets.module";
import {AuthModule} from "../auth/auth.module";
import {PrismaModule} from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule, WalletsModule, AuthModule],
  providers: [DashboardService],
  controllers: [DashboardController],
  exports: [DashboardService],
})
export class DashboardModule {}
