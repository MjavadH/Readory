import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WalletsModule } from '../wallets/wallets.module';
import { MockPaymentDriver } from './drivers/mock-payment.driver';
import { PaymentFactory } from './payment.factory';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [PrismaModule, WalletsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentFactory, MockPaymentDriver],
  exports: [PaymentsService, PaymentFactory],
})
export class PaymentsModule {}
