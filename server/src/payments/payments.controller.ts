import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InitializePaymentDto } from './dto/initialize-payment.dto';
import { PaymentsService } from './payments.service';

@Controller('wallet/payment')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly configService: ConfigService,
  ) {}

  @Post('initialize')
  @UseGuards(JwtAuthGuard)
  initialize(@Request() req: any, @Body() body: InitializePaymentDto) {
    return this.paymentsService.initializePayment({
      userId: req.user.userId,
      amount: body.amount,
      provider: body.provider,
      currency: body.currency,
      description: body.description,
    });
  }

  @Get('callback/:provider')
  async callback(
    @Param('provider') provider: string,
    @Query() query: Record<string, unknown>,
    @Res() res: Response,
  ) {
    const authority = this.extractAuthority(query);
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') ?? '/';

    try {
      const result = await this.paymentsService.verifyPayment(
        provider,
        authority,
        query,
      );
      const path = result.success ? 'payment/success' : 'payment/failure';
      return res.redirect(`${frontendUrl.replace(/\/$/, '')}/${path}`);
    } catch {
      return res.redirect(`${frontendUrl.replace(/\/$/, '')}/payment/failure`);
    }
  }

  private extractAuthority(query: Record<string, unknown>): string {
    const authority = query.Authority ?? query.authority ?? query.token;
    return typeof authority === 'string' ? authority : '';
  }
}
