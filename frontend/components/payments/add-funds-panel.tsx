'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CreditCard, Loader2, ShieldCheck } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import {
  formatAmount,
  getEnabledProviders,
  initializePayment,
  type PaymentProvider,
  parseAmount,
  paymentErrorKey,
  paymentErrorMessage,
} from '@/lib/payments';
import { cn } from '@/lib/utils';

const QUICK_AMOUNTS = [50_000, 100_000, 200_000, 500_000] as const;

interface AddFundsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currency?: string;
  onSuccess?: () => void;
}

export function AddFundsPanel({ open, onOpenChange, currency, onSuccess }: AddFundsPanelProps) {
  const t = useTranslations('Wallet');
  const locale = useLocale();

  const providers = useMemo(() => getEnabledProviders(), []);
  const [providerId, setProviderId] = useState<string>(providers[0]?.id ?? '');
  const [rawAmount, setRawAmount] = useState('');
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const provider: PaymentProvider | undefined =
    providers.find((p) => p.id === providerId) ?? providers[0];
  const amount = parseAmount(rawAmount);

  const validationKey = useMemo(() => {
    if (!provider) return 'noProvider';
    if (!rawAmount.trim()) return 'amountRequired';
    if (!Number.isFinite(amount) || amount <= 0) return 'amountInvalid';
    if (amount < provider.minAmount) return 'amountTooLow';
    if (amount > provider.maxAmount) return 'amountTooHigh';
    return null;
  }, [amount, provider, rawAmount]);

  useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => {
        setRawAmount('');
        setTouched(false);
        setServerError(null);
        setSubmitting(false);
        setProviderId(providers[0]?.id ?? '');
      }, 0);

      return () => clearTimeout(timer);
    }
  }, [open, providers]);

  const errorText = (() => {
    if (serverError) return serverError;
    if (touched && validationKey) {
      if (validationKey === 'amountTooLow' && provider)
        return t('errors.amountTooLow', { min: formatAmount(provider.minAmount, locale) });
      if (validationKey === 'amountTooHigh' && provider)
        return t('errors.amountTooHigh', { max: formatAmount(provider.maxAmount, locale) });
    }
    return null;
  })();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setTouched(true);
    setServerError(null);
    if (validationKey || !provider || submitting) return;

    setSubmitting(true);
    try {
      const result = await initializePayment({
        amount,
        provider: provider.id,
        currency: provider.currency,
        description: t('depositDescription'),
      });

      if (!result?.redirectUrl) {
        setServerError(t('errors.noRedirect'));
        setSubmitting(false);
        return;
      }

      onSuccess?.();
      window.location.assign(result.redirectUrl);
    } catch (error) {
      const key = paymentErrorKey(error);
      // Prefer the backend message (rate limits, pending invoices) when present.
      setServerError(paymentErrorMessage(error, t(`errors.${key}`)));
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={cn(
          'max-h-[92dvh] overflow-y-auto rounded-t-3xl border-border/70 p-0',
          'sm:mx-auto sm:max-w-lg sm:rounded-3xl sm:mb-4',
        )}
      >
        <div aria-hidden className="mx-auto mt-3 h-1.5 w-10 rounded-full bg-muted sm:hidden" />

        <form onSubmit={handleSubmit} className="space-y-6 p-5 pb-8 sm:p-6">
          <header className="space-y-1.5">
            <SheetTitle className="text-start text-lg font-bold">{t('addFunds')}</SheetTitle>
            <SheetDescription className="text-start text-sm">
              {t('addFundsSubtitle')}
            </SheetDescription>
          </header>

          {/* Amount */}
          <div className="space-y-3">
            <label htmlFor="deposit-amount" className="text-sm font-medium">
              {t('amountLabel')}
            </label>

            <div className="relative">
              <Input
                id="deposit-amount"
                inputMode="numeric"
                autoComplete="off"
                dir="ltr"
                placeholder="0"
                value={rawAmount ? formatAmount(parseAmount(rawAmount) || 0, locale) : ''}
                onChange={(e) => {
                  setRawAmount(e.target.value);
                  setServerError(null);
                }}
                onBlur={() => setTouched(true)}
                aria-invalid={Boolean(errorText)}
                aria-describedby={errorText ? 'deposit-error' : undefined}
                className={cn(
                  'h-14 rounded-2xl pe-16 text-start text-xl font-bold tabular-nums',
                  errorText && 'border-destructive focus-visible:ring-destructive/40',
                )}
              />
              <span className="pointer-events-none absolute inset-y-0 inset-e-4 flex items-center text-xs font-medium text-muted-foreground">
                {t(`currency.${provider?.currency ?? currency ?? 'IRR'}`)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {QUICK_AMOUNTS.map((value) => {
                const active = parseAmount(rawAmount) === value;
                return (
                  <motion.button
                    key={value}
                    type="button"
                    whileTap={{ scale: 0.96 }}
                    onClick={() => {
                      setRawAmount(String(value));
                      setServerError(null);
                    }}
                    className={cn(
                      'rounded-xl border px-2 py-2.5 text-xs font-semibold tabular-nums transition-colors',
                      active
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-card text-foreground hover:bg-accent',
                    )}
                  >
                    {formatAmount(value, locale)}
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Providers */}
          <fieldset className="space-y-3">
            <legend className="mb-3 text-sm font-medium">{t('providerLabel')}</legend>

            {providers.length === 0 ? (
              <p className="rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground">
                {t('errors.noProvider')}
              </p>
            ) : (
              <div className="grid gap-2">
                {providers.map((item) => {
                  const selected = item.id === provider?.id;
                  return (
                    <motion.label
                      key={item.id}
                      whileTap={{ scale: 0.99 }}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 rounded-2xl border p-3 transition-colors',
                        selected
                          ? 'border-primary bg-primary/5 ring-1 ring-inset ring-primary/30'
                          : 'border-border bg-card hover:bg-accent/60',
                      )}
                    >
                      <input
                        type="radio"
                        name="payment-provider"
                        value={item.id}
                        checked={selected}
                        onChange={() => {
                          setProviderId(item.id);
                          setServerError(null);
                        }}
                        className="sr-only"
                      />
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted">
                        {item.logo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.logo} alt="" className="h-6 w-6 object-contain" />
                        ) : (
                          <CreditCard className="h-5 w-5 text-muted-foreground" aria-hidden />
                        )}
                      </span>
                      <span className="min-w-0 flex-1 text-start">
                        <span className="block truncate text-sm font-semibold">
                          {t(`providers.${item.labelKey}`)}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {t(`providers.${item.descriptionKey}`)}
                        </span>
                      </span>
                      <span
                        aria-hidden
                        className={cn(
                          'h-4 w-4 shrink-0 rounded-full border-2 transition-colors',
                          selected ? 'border-primary bg-primary' : 'border-muted-foreground/40',
                        )}
                      />
                    </motion.label>
                  );
                })}
              </div>
            )}
          </fieldset>

          {/* Errors */}
          <AnimatePresence initial={false}>
            {errorText && (
              <motion.p
                id="deposit-error"
                role="alert"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="flex items-start gap-2 overflow-hidden rounded-xl bg-destructive/10 p-3 text-xs font-medium text-destructive"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>{errorText}</span>
              </motion.p>
            )}
          </AnimatePresence>

          <div className="space-y-3">
            <Button
              type="submit"
              disabled={submitting || providers.length === 0}
              className="h-12 w-full rounded-2xl text-sm font-semibold"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  {t('redirecting')}
                </>
              ) : (
                t('continueToGateway')
              )}
            </Button>

            <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              {t('secureNote')}
            </p>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
