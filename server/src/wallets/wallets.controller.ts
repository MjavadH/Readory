import {Controller, Get, Post, Body, UseGuards, Request, Query} from '@nestjs/common';
import { WalletsService } from './wallets.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {Roles} from "../auth/roles.decorator";
import {RoleName} from "@prisma/client";
import { RequirePermissions } from '../auth/permissions.decorator';
import { AdminPermissions } from '../auth/permissions.enum';
import { PermissionsGuard } from '../auth/permissions.guard';
import {RolesGuard} from "../auth/roles.guard";

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
    getAllTransactions(
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 20
    ) {
        return this.walletsService.getAllTransactions(Number(page), Number(limit));
    }
}
