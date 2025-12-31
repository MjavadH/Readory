import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { WalletsService } from './wallets.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('wallet')
export class WalletsController {
    constructor(private walletsService: WalletsService) {}

    // GET /wallet – returns current user’s wallet and transactions
    @Get()
    getWallet(@Request() req: any) {
        return this.walletsService.getWallet(req.user.userId);
    }

    // POST /wallet/deposit – credit money to wallet
    @Post('deposit')
    deposit(@Request() req: any, @Body() body: { amount: number; reference?: string }) {
        return this.walletsService.credit(req.user.userId, Number(body.amount), body.reference);
    }
}
