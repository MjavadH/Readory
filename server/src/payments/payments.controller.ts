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
  NotFoundException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import type { Request as ExpressRequest, Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InitializePaymentDto } from './dto/initialize-payment.dto';
import { PaymentsService } from './payments.service';
import { randomUUID } from 'crypto';
import { CacheManager } from '../cache/cache.manager';

@Controller('wallet/payment')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly configService: ConfigService,
    private readonly cacheManager: CacheManager,
  ) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('initialize')
  @UseGuards(JwtAuthGuard)
  initialize(
    @Request() req: ExpressRequest & { user: { userId: number } },
    @Body() body: InitializePaymentDto,
  ) {
    return this.paymentsService.initializePayment({
      userId: req.user.userId,
      request: req,
      amount: body.amount,
      provider: body.provider,
      currency: body.currency,
      description: body.description,
    });
  }

  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Get('callback/:provider')
  async callback(
    @Param('provider') provider: string,
    @Query() query: Record<string, unknown>,
    @Res() res: Response,
  ) {
    const authority = this.extractAuthority(query);
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') ?? '/';
    const resultToken = randomUUID();

    try {
      const result = await this.paymentsService.verifyPayment(provider, authority, query);

      // Store result in cache for 5 minutes
      await this.cacheManager.setString(
        `payment_result:${resultToken}`,
        JSON.stringify({
          success: result.success,
          invoiceId: result.invoiceId,
          refId: result.refId,
        }),
        300,
      );
    } catch (error) {
      await this.cacheManager.setString(
        `payment_result:${resultToken}`,
        JSON.stringify({ success: false }),
        300,
      );
    }

    // Redirect to a unified result page
    return res.redirect(`${frontendUrl.replace(/\/$/, '')}/payment/result?token=${resultToken}`);
  }

  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Get('result/:token')
  async getPaymentResult(@Param('token') token: string) {
    const cacheKey = `payment_result:${token}`;
    const cachedData = await this.cacheManager.getString(cacheKey);

    if (!cachedData) {
      throw new NotFoundException('Invalid or expired payment token');
    }

    return JSON.parse(cachedData);
  }

  private extractAuthority(query: Record<string, unknown>): string {
    const authority = query.trackId ?? query.Authority ?? query.authority ?? query.token;
    return typeof authority === 'string' ? authority : '';
  }
}
