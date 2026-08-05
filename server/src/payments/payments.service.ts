import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentStatus } from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { WalletsService } from '../wallets/wallets.service';
import { PaymentFactory } from './payment.factory';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import { RATE_LIMITS } from '../rate-limit/rate-limit.constants';

type InitializePaymentInput = {
  userId: number;
  amount: number;
  provider: string;
  currency?: string;
  description?: string;
  request?: Request;
};

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentFactory: PaymentFactory,
    private readonly walletsService: WalletsService,
    private readonly configService: ConfigService,
    private readonly rateLimitService: RateLimitService,
  ) {}

  async initializePayment(input: InitializePaymentInput) {
    if (input.amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    const provider = input.provider.trim().toUpperCase();
    const driver = this.paymentFactory.resolve(provider);
    const reusableInvoice = await this.findReusablePendingInvoice(
      input.userId,
      input.amount,
      provider,
      input.currency ?? 'IRR',
    );
    if (reusableInvoice && driver.getRedirectUrl) {
      return {
        invoiceId: reusableInvoice.id,
        authority: reusableInvoice.authority,
        redirectUrl: driver.getRedirectUrl(reusableInvoice.authority),
        reused: true,
      };
    }
    await this.assertPaymentAllowed(input);

    const callbackUrl = this.buildCallbackUrl(provider);
    const initialized = await driver.initialize(input.amount, callbackUrl, input.description);

    const invoice = await this.prisma.paymentInvoice.create({
      data: {
        userId: input.userId,
        amount: input.amount,
        currency: input.currency ?? 'IRR',
        provider,
        authority: initialized.authority,
      },
    });

    return {
      invoiceId: invoice.id,
      authority: initialized.authority,
      redirectUrl: initialized.redirectUrl,
    };
  }

  async verifyPayment(provider: string, authority: string, queryParams: Record<string, unknown>) {
    const normalizedProvider = provider.trim().toUpperCase();
    const invoice = await this.prisma.paymentInvoice.findUnique({
      where: { authority },
    });

    if (!invoice || invoice.provider !== normalizedProvider) {
      throw new NotFoundException('Payment invoice not found');
    }

    if (invoice.status !== PaymentStatus.PENDING) {
      throw new ConflictException('Payment invoice is already processed');
    }

    const driver = this.paymentFactory.resolve(normalizedProvider);
    const verification = await driver.verify(authority, Number(invoice.amount), queryParams);

    if (!verification.success) {
      await this.prisma.paymentInvoice.update({
        where: { id: invoice.id },
        data: { status: PaymentStatus.FAILED },
      });

      return { success: false, invoiceId: invoice.id };
    }

    const refId = verification.refId ?? authority;

    const walletReference = `Gateway Deposit (${normalizedProvider}) | Ref: ${refId}`;

    await this.prisma.$transaction(async (tx) => {
      const updatedInvoice = await tx.paymentInvoice.updateMany({
        where: { id: invoice.id, status: PaymentStatus.PENDING },
        data: { status: PaymentStatus.SUCCESS, refId },
      });

      if (updatedInvoice.count === 0) {
        throw new ConflictException('Payment invoice is already processed');
      }

      await this.walletsService.credit(invoice.userId, Number(invoice.amount), walletReference, tx);
    });

    return { success: true, invoiceId: invoice.id, refId };
  }

  private async assertPaymentAllowed(input: InitializePaymentInput): Promise<void> {
    const userKey = String(input.userId);
    const ip = input.request ? this.rateLimitService.ipFromRequest(input.request) : 'unknown';
    await this.rateLimitService.consume({
      key: this.rateLimitService.key('payment', 'cooldown', 'user', userKey),
      limit: 1,
      ttlSeconds: RATE_LIMITS.payment.cooldownSeconds,
      message: 'Please wait before creating another payment request.',
    });
    await this.rateLimitService.consume({
      key: this.rateLimitService.key('payment', 'hourly', 'user', userKey),
      ...RATE_LIMITS.payment.hourly,
      message: 'Hourly payment creation limit exceeded.',
    });
    await this.rateLimitService.consume({
      key: this.rateLimitService.key('payment', 'daily', 'user', userKey),
      ...RATE_LIMITS.payment.daily,
      message: 'Daily payment creation limit exceeded.',
    });
    await this.rateLimitService.consume({
      key: this.rateLimitService.key('payment', 'hourly', 'ip', ip),
      limit: RATE_LIMITS.payment.hourly.limit * 3,
      ttlSeconds: RATE_LIMITS.payment.hourly.ttlSeconds,
      message: 'Too many payment attempts from this IP.',
    });

    const pendingCount = await this.prisma.paymentInvoice.count({
      where: { userId: input.userId, status: PaymentStatus.PENDING },
    });
    if (pendingCount >= RATE_LIMITS.payment.pending.limit) {
      throw new BadRequestException(
        'Too many pending payment requests. Please complete or wait for existing payments before creating another.',
      );
    }
  }

  private async findReusablePendingInvoice(
    userId: number,
    amount: number,
    provider: string,
    currency: string,
  ) {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return this.prisma.paymentInvoice.findFirst({
      where: {
        userId,
        provider,
        currency,
        status: PaymentStatus.PENDING,
        amount,
        createdAt: { gte: fiveMinutesAgo },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private buildCallbackUrl(provider: string): string {
    const baseUrl = this.configService.get<string>('APP_URL') ?? 'http://localhost:3000';
    return `${baseUrl.replace(/\/$/, '')}/wallet/payment/callback/${provider}`;
  }
}
