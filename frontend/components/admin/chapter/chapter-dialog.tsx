'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Hash, Type, AlertCircle, Coins, Unlock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { PublicationStatus } from '@readory/shared';
import DateTimePicker from '@/components/admin/date-time-picker';
import { ChapterStatusTabs, MorphReveal } from '@/components/admin/chapter/chapter-status-tabs';
import { cn } from '@/lib/utils';

export type ChapterFormValue = {
  title: string;
  index: number;
  price: number;
  isFree: boolean;
  publishStatus: PublicationStatus;
  publishAt?: Date;
};

export type ChapterDialogProps = {
  open: boolean;
  mode: 'add' | 'edit';
  value: ChapterFormValue;
  onChange: (value: ChapterFormValue) => void;
  onClose: () => void;
  onSubmit: () => Promise<void> | void;
  /** useTranslations('Books') */
  t: (key: string, values?: Record<string, string | number>) => string;
  /** useTranslations('General') */
  g: (key: string, values?: Record<string, string | number>) => string;
};

type Errors = Partial<Record<'title' | 'index' | 'price' | 'publishAt', string>>;

function FieldError({ message }: { message?: string }) {
  return (
    <AnimatePresence initial={false}>
      {message && (
        <motion.p
          initial={{ opacity: 0, y: -4, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, y: -4, height: 0 }}
          transition={{ duration: 0.18 }}
          className="flex items-center gap-1.5 text-xs font-medium text-destructive"
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{message}</span>
        </motion.p>
      )}
    </AnimatePresence>
  );
}

export function ChapterDialog({
  open,
  mode,
  value,
  onChange,
  onClose,
  onSubmit,
  t,
  g,
}: ChapterDialogProps) {
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) {
      setErrors({});
      setTouched(false);
      setSubmitting(false);
    }
  }, [open]);

  const validate = useMemo(
    () =>
      (form: ChapterFormValue): Errors => {
        const next: Errors = {};

        if (!form.title.trim()) next.title = t('ErrorTitleRequired');
        if (!Number.isFinite(form.index) || form.index < 1) next.index = t('ErrorIndexRequired');

        // Paid chapter must have a price greater than zero.
        if (!form.isFree && (!Number.isFinite(form.price) || Number(form.price) <= 0)) {
          next.price = t('ErrorPriceRequired');
        }

        if (form.publishStatus === PublicationStatus.SCHEDULED) {
          if (!form.publishAt) next.publishAt = t('ErrorScheduleDateRequired');
          else if (form.publishAt.getTime() <= Date.now())
            next.publishAt = t('ErrorScheduleDateInFuture');
        }

        return next;
      },
    [t],
  );

  const update = (patch: Partial<ChapterFormValue>) => {
    const next = { ...value, ...patch };
    onChange(next);
    if (touched) setErrors(validate(next));
  };

  const handleStatusChange = (status: PublicationStatus) => {
    update({
      publishStatus: status,
      publishAt:
        status === PublicationStatus.SCHEDULED
          ? (value.publishAt ?? new Date(Date.now() + 3600_000))
          : undefined,
    });
  };

  const handleSubmit = async () => {
    setTouched(true);
    const next = validate(value);
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    try {
      await onSubmit();
    } finally {
      setSubmitting(false);
    }
  };

  const hasErrors = Object.keys(errors).length > 0;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1.5rem)] overflow-y-auto rounded-2xl p-4 sm:max-w-lg sm:p-6">
        <DialogHeader className="text-start">
          <DialogTitle className="text-lg sm:text-xl">
            {mode === 'add' ? t('AddNewChapter') : t('EditChapter')}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            {t('ChapterDialogDescription')}
          </DialogDescription>
        </DialogHeader>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="space-y-5 pt-1"
        >
          {/* Title + index */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_7rem]">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <Type className="h-3.5 w-3.5" />
                {t('ChapterTitle')}
              </Label>
              <Input
                value={value.title}
                onChange={(e) => update({ title: e.target.value })}
                placeholder={t('EnterChapterTitle')}
                aria-invalid={!!errors.title}
                className={cn(
                  'h-11',
                  errors.title && 'border-destructive focus-visible:ring-destructive',
                )}
              />
              <FieldError message={errors.title} />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <Hash className="h-3.5 w-3.5" />
                {t('ChapterIndex')}
              </Label>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                value={Number.isFinite(value.index) ? value.index : ''}
                onChange={(e) => update({ index: parseInt(e.target.value, 10) || 0 })}
                placeholder={t('ChapterNumber')}
                aria-invalid={!!errors.index}
                className={cn(
                  'h-11',
                  errors.index && 'border-destructive focus-visible:ring-destructive',
                )}
              />
              <FieldError message={errors.index} />
            </div>
          </div>

          {/* Publication status */}
          <div className="space-y-3 rounded-xl border border-border/60 bg-card p-3 sm:p-4">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t('PublishStatus')}
            </Label>

            <ChapterStatusTabs value={value.publishStatus} onChange={handleStatusChange} t={t} />

            <MorphReveal show={value.publishStatus === PublicationStatus.SCHEDULED}>
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {t('PublishAt')}
                </Label>
                <DateTimePicker
                  value={value.publishAt}
                  onChange={(date) => update({ publishAt: date })}
                  min={new Date()}
                />
                <FieldError message={errors.publishAt} />
              </div>
            </MorphReveal>
          </div>

          {/* Access + price */}
          <div className="space-y-3 rounded-xl border border-border/60 bg-card p-3 sm:p-4">
            <label className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-sm font-medium">
                <Unlock className="h-4 w-4 text-muted-foreground" />
                {t('FreeChapter')}
              </span>
              <Switch
                id="isFree"
                checked={value.isFree}
                onCheckedChange={(checked) =>
                  update({ isFree: checked, price: checked ? 0 : value.price })
                }
              />
            </label>

            <MorphReveal show={!value.isFree}>
              <div className="space-y-2 border-t border-border/60 pt-3">
                <Label className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <Coins className="h-3.5 w-3.5" />
                  {t('Price', { CurrencySymbols: g('CurrencySymbols') + g('CurrencyName') })}
                </Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  dir="ltr"
                  value={value.price === 0 ? '' : String(value.price)}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^\d.]/g, '');
                    update({ price: raw === '' ? 0 : Number(raw) });
                  }}
                  placeholder="0.00"
                  aria-invalid={!!errors.price}
                  className={cn(
                    'h-11 text-start',
                    errors.price && 'border-destructive focus-visible:ring-destructive',
                  )}
                />
                <FieldError message={errors.price} />
              </div>
            </MorphReveal>
          </div>
        </motion.div>

        <DialogFooter className="mt-2 flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" className="h-11 w-full sm:w-auto" onClick={onClose}>
            {g('Cancel')}
          </Button>
          <Button
            className="h-11 w-full sm:w-auto"
            onClick={handleSubmit}
            disabled={submitting || (touched && hasErrors)}
          >
            <Check className="h-4 w-4 me-2" />
            {mode === 'add' ? t('AddChapter') : t('SaveChanges')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
