import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WalletsService } from '../wallets/wallets.service';
import { PaymentFactory } from './payment.factory';

type InitializePaymentInput = {
  userId: number;
  amount: number;
  provider: string;
  currency?: string;
  description?: string;
};

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentFactory: PaymentFactory,
    private readonly walletsService: WalletsService,
    private readonly configService: ConfigService,
  ) {}

  async initializePayment(input: InitializePaymentInput) {
    if (input.amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    const provider = input.provider.trim().toUpperCase();
    const driver = this.paymentFactory.resolve(provider);
    const callbackUrl = this.buildCallbackUrl(provider);
    const initialized = await driver.initialize(
      input.amount,
      callbackUrl,
      input.description,
    );

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

  async verifyPayment(
    provider: string,
    authority: string,
    queryParams: Record<string, unknown>,
  ) {
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
    const verification = await driver.verify(
      authority,
      Number(invoice.amount),
      queryParams,
    );

    if (!verification.success) {
      await this.prisma.paymentInvoice.update({
        where: { id: invoice.id },
        data: { status: PaymentStatus.FAILED },
      });

      return { success: false, invoiceId: invoice.id };
    }

    const refId = verification.refId ?? authority;

    await this.prisma.$transaction(async (tx) => {
      await tx.paymentInvoice.update({
        where: { id: invoice.id },
        data: { status: PaymentStatus.SUCCESS, refId },
      });

      await this.walletsService.credit(
        invoice.userId,
        Number(invoice.amount),
        refId,
        tx,
      );
    });

    return { success: true, invoiceId: invoice.id, refId };
  }

  private buildCallbackUrl(provider: string): string {
    const baseUrl =
      this.configService.get<string>('APP_URL') ?? 'http://localhost:3000';
    return `${baseUrl.replace(/\/$/, '')}/wallet/payment/callback/${provider}`;
  }
}
