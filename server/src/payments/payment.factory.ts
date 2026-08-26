import { BadRequestException, Injectable } from '@nestjs/common';
import { MockPaymentDriver } from './drivers/mock-payment.driver';
import { PaymentDriver } from './payment-driver.interface';

@Injectable()
export class PaymentFactory {
  private readonly drivers = new Map<string, PaymentDriver>();

  constructor(private readonly mockPaymentDriver: MockPaymentDriver) {
    this.register('MOCK', this.mockPaymentDriver);
  }

  register(provider: string, driver: PaymentDriver): void {
    this.drivers.set(this.normalizeProvider(provider), driver);
  }

  resolve(provider: string): PaymentDriver {
    const driver = this.drivers.get(this.normalizeProvider(provider));

    if (!driver) {
      throw new BadRequestException(`Unsupported payment provider: ${provider}`);
    }

    return driver;
  }

  private normalizeProvider(provider: string): string {
    return provider.trim().toUpperCase();
  }
}
