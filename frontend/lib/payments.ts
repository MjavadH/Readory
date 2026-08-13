import { apiClient, getApiErrorMessage } from '@/lib/api-client';
import type { IconKey } from '@readory/shared';

/* -------------------------------------------------------------------------- */
/*  Provider registry — add a new gateway by appending one entry here.         */
/*  `id` MUST match the key registered in the backend PaymentFactory.          */
/* -------------------------------------------------------------------------- */

export type PaymentProvider = {
  /** Backend provider key (PaymentFactory.register), always uppercase. */
  id: string;
  /** i18n key under the `Wallet.providers` namespace. */
  labelKey: string;
  /** i18n key for the short helper line under the provider name. */
  descriptionKey: string;
  /** Optional logo served from /public. Falls back to initials when absent. */
  logo?: string;
  /** Currency the gateway settles in. */
  currency: string;
  /** Inclusive deposit bounds, in the smallest displayed unit. */
  minAmount: number;
  maxAmount: number;
  /** Hide without deleting (e.g. gateway under maintenance). */
  enabled: boolean;
  /** Optional icon key when you prefer the shared icon set over a logo. */
  iconKey?: IconKey;
};

export const PAYMENT_PROVIDERS: PaymentProvider[] = [
  {
    id: 'MOCK',
    labelKey: 'mock',
    descriptionKey: 'mockDescription',
    currency: 'IRR',
    minAmount: 10_000,
    maxAmount: 500_000_000,
    enabled: true,
  },
];

export const getEnabledProviders = () => PAYMENT_PROVIDERS.filter((p) => p.enabled);

export const findProvider = (id: string | null | undefined) =>
  PAYMENT_PROVIDERS.find((p) => p.id === id?.trim().toUpperCase());

/* API */

export type InitializePaymentBody = {
  amount: number;
  provider: string;
  currency?: string;
  description?: string;
};

export type InitializePaymentResponse = {
  invoiceId: number;
  authority: string;
  redirectUrl: string;
  reused?: boolean;
};

export type PaymentResult = {
  success: boolean;
  invoiceId?: number;
  refId?: string;
};

export const initializePayment = (body: InitializePaymentBody) =>
  apiClient.post<InitializePaymentResponse, InitializePaymentBody>(
    '/wallet/payment/initialize',
    body,
  );

export const getPaymentResult = (token: string) =>
  apiClient.get<PaymentResult>(`/wallet/payment/result/${encodeURIComponent(token)}`);

/* Errors */

export const paymentErrorKey = (error: unknown): string => {
  const status = (error as { status?: number })?.status;
  switch (status) {
    case 400:
      return 'invalidRequest';
    case 401:
      return 'unauthenticated';
    case 409:
      return 'alreadyProcessed';
    case 429:
      return 'rateLimited';
    case 404:
      return 'notFound';
    default:
      return status && status >= 500 ? 'server' : 'unknown';
  }
};

export const paymentErrorMessage = (error: unknown, fallback: string) =>
  getApiErrorMessage(error, fallback);

/* Formatting */

export const formatAmount = (value: number, locale: string, currency?: string) => {
  try {
    return new Intl.NumberFormat(locale, {
      maximumFractionDigits: 0,
      ...(currency ? { style: 'currency', currency, currencyDisplay: 'narrowSymbol' } : {}),
    }).format(value);
  } catch {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
  }
};

export const parseAmount = (raw: string) => {
  // Accepts grouped input plus Persian/Arabic-Indic digits.
  const normalized = raw
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[^\d]/g, '');
  return normalized ? Number(normalized) : Number.NaN;
};
