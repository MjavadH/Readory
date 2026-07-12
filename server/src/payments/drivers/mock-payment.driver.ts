import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PaymentDriver } from '../payment-driver.interface';

@Injectable()
export class MockPaymentDriver implements PaymentDriver {
  getRedirectUrl(authority: string): string {
    const baseUrl = process.env.APP_URL ?? 'http://localhost:3000';
    const redirectUrl = new URL(
      `${baseUrl.replace(/\/$/, '')}/wallet/payment/callback/MOCK`,
    );
    redirectUrl.searchParams.set('Authority', authority);
    redirectUrl.searchParams.set('Status', 'OK');
    return redirectUrl.toString();
  }

  async initialize(
    amount: number,
    callbackUrl: string,
    description?: string,
  ): Promise<{ authority: string; redirectUrl: string }> {
    const authority = `MOCK-${randomUUID()}`;
    const redirectUrl = new URL(callbackUrl);

    redirectUrl.searchParams.set('Authority', authority);
    redirectUrl.searchParams.set('Status', 'OK');
    redirectUrl.searchParams.set('amount', amount.toString());

    if (description) {
      redirectUrl.searchParams.set('description', description);
    }

    return { authority, redirectUrl: redirectUrl.toString() };
  }

  async verify(
    authority: string,
    amount: number,
    queryParams: Record<string, unknown>,
  ): Promise<{ success: boolean; refId?: string }> {
    const status = String(queryParams.Status ?? queryParams.status ?? 'OK');

    if (status.toUpperCase() !== 'OK') {
      return { success: false };
    }

    return {
      success: true,
      refId: `MOCK-REF-${authority}-${amount}`,
    };
  }
}
