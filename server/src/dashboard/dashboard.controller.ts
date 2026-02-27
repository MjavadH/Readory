import {Controller, Get, UseGuards, Request, Query} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RoleName } from '@prisma/client';
import { DashboardService } from './dashboard.service';
import { WalletsService } from '../wallets/wallets.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
    constructor(
        private dashboardService: DashboardService,
        private walletsService: WalletsService,
    ) {}

    /**
     * User dashboard:
     * - continue reading (last unfinished chapter)
     * - recent purchased-books access (limited)
     * - recent transactions (limited)
     * - wallet balance
     * - user profile info (email/username)
     */
    @Get()
    async getOverview(
        @Request() req: any,
        @Query('txLimit') txLimit: string = '6',
        @Query('libraryLimit') libraryLimit: string = '9',
    ) {
        const userId = req.user.id || req.user.userId;
        return this.dashboardService.getUserDashboardOverview(userId, {
            txLimit: Number(txLimit),
            libraryLimit: Number(libraryLimit),
        });
    }

    // Full transaction history
    @Get('history')
    async getHistory(
        @Request() req: any,
        @Query('page') page: string = '1',
        @Query('limit') limit: string = '30',
    ) {
        const userId = req.user.id || req.user.userId;

        const wallet = await this.walletsService.getWallet(userId, {
            page: Number(page),
            limit: Number(limit),
        });

        return {
            balance: wallet.balance,
            totals: wallet.totals,
            ...wallet.transactions,
        };
    }

    // Full library list
    @Get('library')
    async getLibrary(
        @Request() req: any,
        @Query('page') page: string = '1',
        @Query('limit') limit: string = '24',
    ) {
        const userId = req.user.id || req.user.userId;
        return this.dashboardService.getUserLibrary(userId, Number(page), Number(limit));
    }

    @Get('admin')
    @UseGuards(RolesGuard)
    @Roles(RoleName.ADMIN)
    async getAdminStats(@Request() req: any) {
        const userId = req.user.id || req.user.userId;

        return this.dashboardService.getAdminDashboardStats(req.user.permissions, Number(userId));
    }
}