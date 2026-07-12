export interface PaymentDriver {
  initialize(
    amount: number,
    callbackUrl: string,
    description?: string,
  ): Promise<{ authority: string; redirectUrl: string }>;

  getRedirectUrl?(authority: string): string;

  verify(
    authority: string,
    amount: number,
    queryParams: Record<string, unknown>,
  ): Promise<{ success: boolean; refId?: string }>;
}
