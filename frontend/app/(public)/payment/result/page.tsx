'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Check,
  Loader2,
  Receipt,
  RotateCcw,
  Wallet,
  XCircle,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  getPaymentResult,
  paymentErrorKey,
  paymentErrorMessage,
  type PaymentResult,
} from '@/lib/payments';

type Status = 'loading' | 'success' | 'failed' | 'error';

const EASE = [0.22, 1, 0.36, 1] as const;

export default function PaymentResultPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const t = useTranslations('Wallet');

  const [status, setStatus] = useState<Status>('loading');
  const [result, setResult] = useState<PaymentResult | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!token) {
      setStatus('error');
      setErrorText(t('errors.notFound'));
      return;
    }
    setStatus('loading');
    setErrorText(null);
    try {
      const data = await getPaymentResult(token);
      setResult(data);
      setStatus(data.success ? 'success' : 'failed');
    } catch (error) {
      setResult(null);
      setStatus('error');
      setErrorText(paymentErrorMessage(error, t(`errors.${paymentErrorKey(error)}`)));
    }
  }, [t, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const copyRef = async () => {
    if (!result?.refId) return;
    try {
      await navigator.clipboard.writeText(result.refId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable — silently ignore */
    }
  };

  const success = status === 'success';
  const isFailure = status === 'failed' || status === 'error';

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-8 sm:px-6">
      <div className="w-full max-w-md">
        <AnimatePresence mode="wait" initial={false}>
          {status === 'loading' ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: EASE }}
              role="status"
              aria-live="polite"
              className="flex flex-col items-center gap-3 rounded-3xl border border-border/60 bg-card p-10 shadow-sm"
            >
              <Loader2 className="h-9 w-9 animate-spin text-primary" aria-hidden />
              <p className="text-sm text-muted-foreground">{t('result.verifying')}</p>
            </motion.div>
          ) : (
            <motion.section
              key="result"
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.4, ease: EASE }}
              aria-live="polite"
              className="relative isolate overflow-hidden rounded-3xl border border-border/60 bg-card shadow-xl"
            >
              <span
                aria-hidden
                className={cn(
                  'block h-1.5 w-full',
                  success
                    ? 'bg-linear-to-r from-emerald-400 to-emerald-600'
                    : 'bg-linear-to-r from-destructive/70 to-destructive',
                )}
              />
              <motion.span
                aria-hidden
                initial={{ opacity: 0.4, scale: 0.9 }}
                animate={{ opacity: [0.35, 0.6, 0.35], scale: [0.95, 1.05, 0.95] }}
                transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
                className={cn(
                  'pointer-events-none absolute -top-16 -inset-e-12 h-40 w-40 rounded-full blur-3xl',
                  success ? 'bg-emerald-500/20' : 'bg-destructive/15',
                )}
              />

              <div className="relative px-6 pb-6 pt-8 text-center sm:px-8 sm:pt-10">
                <motion.div
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.08, type: 'spring', stiffness: 320, damping: 20 }}
                  className={cn(
                    'mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full ring-8',
                    success
                      ? 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/10 dark:text-emerald-400'
                      : 'bg-destructive/10 text-destructive ring-destructive/5',
                  )}
                >
                  {success ? (
                    <CheckCircle2 className="h-11 w-11" aria-hidden />
                  ) : (
                    <XCircle className="h-11 w-11" aria-hidden />
                  )}
                </motion.div>

                <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  {success ? t('result.successTitle') : t('result.failureTitle')}
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  {status === 'error'
                    ? (errorText ?? t('errors.unknown'))
                    : success
                      ? t('result.successDescription')
                      : t('result.failureDescription')}
                </p>

                {result && (result.refId || result.invoiceId !== undefined) && (
                  <div className="mt-6 rounded-2xl border border-border/70 bg-muted/40 p-4 text-start">
                    {result.refId && (
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                          <Receipt className="h-4 w-4" aria-hidden />
                          {t('result.refId')}
                        </span>
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span
                            dir="ltr"
                            className="truncate font-mono text-sm font-semibold text-foreground"
                          >
                            {result.refId}
                          </span>
                          <motion.button
                            type="button"
                            onClick={copyRef}
                            whileTap={{ scale: 0.9 }}
                            aria-label={t('result.copy')}
                            className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {copied ? (
                              <Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden />
                            ) : (
                              <Copy className="h-3.5 w-3.5" aria-hidden />
                            )}
                          </motion.button>
                        </span>
                      </div>
                    )}

                    {result.invoiceId !== undefined && (
                      <div
                        className={cn(
                          'flex items-center justify-between gap-3',
                          result.refId && 'mt-3 border-t border-border/70 pt-3',
                        )}
                      >
                        <span className="text-xs font-medium text-muted-foreground">
                          {t('result.invoiceId')}
                        </span>
                        <span dir="ltr" className="font-mono text-sm font-semibold text-foreground">
                          #{result.invoiceId}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-6 flex flex-col gap-2">
                  {isFailure && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void load()}
                      className="h-12 w-full rounded-2xl text-sm font-semibold"
                    >
                      <RotateCcw className="h-4 w-4" aria-hidden />
                      {t('result.retry')}
                    </Button>
                  )}

                  <Button
                    type="button"
                    onClick={() => router.replace('/dashboard')}
                    className="h-12 w-full rounded-2xl text-sm font-semibold"
                  >
                    <Wallet className="h-4 w-4" aria-hidden />
                    {t('result.backToWallet')}
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => router.replace('/')}
                    className="h-11 w-full rounded-2xl text-sm font-medium text-muted-foreground"
                  >
                    <ArrowLeft className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
                    {t('result.backHome')}
                  </Button>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
