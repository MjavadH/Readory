import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  const t = useTranslations('AdminPage.Dashboard');
  return (
    <Card className="border-destructive/40 bg-destructive/5">
      <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <p className="text-base font-semibold text-foreground">{t('Error.Title')}</p>
          <p className="text-sm text-muted-foreground">{message ?? t('Error.Description')}</p>
        </div>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            {t('Error.Retry')}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function SectionError({
  message,
  onRetry,
  className,
}: {
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  const t = useTranslations('AdminPage.Dashboard');
  return (
    <Card className={className}>
      <CardContent className="flex items-center justify-between gap-4 py-6">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <div>
            <p className="text-sm font-medium">{t('Error.SectionTitle')}</p>
            <p className="text-xs text-muted-foreground">
              {message ?? t('Error.SectionDescription')}
            </p>
          </div>
        </div>
        {onRetry && (
          <Button variant="ghost" size="sm" onClick={onRetry} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            {t('Error.Retry')}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
