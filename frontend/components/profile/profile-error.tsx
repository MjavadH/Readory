import { motion } from 'framer-motion';
import { RefreshCw, SearchX, TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';

type ProfileErrorProps = {
  /** `notFound` renders the 404 flavour, `error` the retryable failure. */
  variant: 'notFound' | 'error';
  message?: string;
  onRetry?: () => void;
};

export function ProfileError({ variant, message, onRetry }: ProfileErrorProps) {
  const t = useTranslations('PublicProfile');
  const notFound = variant === 'notFound';

  return (
    <main className="mx-auto flex min-h-[65vh] w-full max-w-md flex-col items-center justify-center gap-5 px-4 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 18 }}
        className="grid size-16 place-items-center rounded-3xl border border-border/70 bg-muted/50 text-muted-foreground"
      >
        {notFound ? (
          <SearchX aria-hidden className="size-7" />
        ) : (
          <TriangleAlert aria-hidden className="size-7 text-destructive" />
        )}
      </motion.div>

      <div className="space-y-2">
        <h1 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
          {notFound ? t('NotFoundTitle') : t('LoadFailedTitle')}
        </h1>
        <p className="text-sm text-muted-foreground">
          {message ?? (notFound ? t('NotFound') : t('LoadFailed'))}
        </p>
      </div>

      {!notFound && onRetry ? (
        <Button variant="outline" onClick={onRetry} className="gap-2">
          <RefreshCw aria-hidden className="size-4" />
          {t('Retry')}
        </Button>
      ) : null}
    </main>
  );
}
