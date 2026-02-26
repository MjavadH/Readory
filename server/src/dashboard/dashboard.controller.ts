import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RoleName } from '@prisma/client';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
    constructor(private dashboardService: DashboardService) {}

    @Get('admin')
    @UseGuards(RolesGuard)
    @Roles(RoleName.ADMIN)
    async getAdminStats(@Request() req: any) {
        const userId = req.user.id || req.user.userId;

        return this.dashboardService.getAdminDashboardStats(req.user.permissions, Number(userId));
    }
}