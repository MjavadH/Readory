import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { AdminPermissions } from '../auth/permissions.enum';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import type { WalletsService } from './wallets.service';

@UseGuards(JwtAuthGuard)
@Controller('wallet')
export class WalletsController {
  constructor(private walletsService: WalletsService) {}

  @Get()
  getWallet(@Request() req: any) {
    return this.walletsService.getWallet(req.user.userId);
  }

  @Get('transactions')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(RoleName.ADMIN)
  @RequirePermissions(AdminPermissions.MANAGE_FINANCE)
  getAllTransactions(@Query('page') page: number = 1, @Query('limit') limit: number = 20) {
    return this.walletsService.getAllTransactions(Number(page), Number(limit));
  }
}
