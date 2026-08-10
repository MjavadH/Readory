import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ContributorGender, CONTRIBUTOR_GENDER_VALUES } from '@shared/contributor-metadata';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLocaleInfo } from '@/hooks/use-locale-info';

export type ContributorEditorValue = {
  name: string;
  originalName: string;
  slug: string;
  biography: string;
  gender: ContributorGender;
};

export type ContributorFieldErrors = Partial<Record<keyof ContributorEditorValue, string>>;

export type ContributorEditorMode = 'create' | 'edit';

type ContributorEditorProps = {
  mode: ContributorEditorMode;
  value: ContributorEditorValue;
  onChange: (patch: Partial<ContributorEditorValue>) => void;
  onSubmit: () => void | Promise<void>;
  onCancel: () => void;
  submitting?: boolean;
  serverErrors?: ContributorFieldErrors;
  formError?: string | null;
};

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function slugify(input: string): string {
  return input
    .toString()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function ContributorsEditor({
  mode,
  value,
  onChange,
  onSubmit,
  onCancel,
  submitting = false,
  serverErrors,
  formError,
}: ContributorEditorProps) {
  const t = useTranslations('Contributors');
  const g = useTranslations('General');
  const { isRTL } = useLocaleInfo();

  const [touched, setTouched] = useState<Record<keyof ContributorEditorValue, boolean>>({
    name: false,
    originalName: false,
    slug: false,
    biography: false,
    gender: false,
  });
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(mode === 'edit');

  // Auto-suggest slug from name until the user edits the slug themselves.
  useEffect(() => {
    if (slugManuallyEdited) return;
    if (!value.name) return;
    const suggested = slugify(value.name);
    if (suggested && suggested !== value.slug) {
      onChange({ slug: suggested });
    }
  }, [value.name, slugManuallyEdited, onChange, value.slug]);

  const clientErrors: ContributorFieldErrors = {};
  if (!value.name.trim()) clientErrors.name = t('Validation_NameRequired');
  else if (value.name.length > 255) clientErrors.name = t('Validation_MaxLength', { max: 255 });
  if (!value.slug.trim()) clientErrors.slug = t('Validation_SlugRequired');
  else if (value.slug.length > 255) clientErrors.slug = t('Validation_MaxLength', { max: 255 });
  else if (!SLUG_REGEX.test(value.slug)) clientErrors.slug = t('Validation_SlugFormat');
  if (value.originalName.length > 255)
    clientErrors.originalName = t('Validation_MaxLength', { max: 255 });
  if (value.gender.length > 50) clientErrors.gender = t('Validation_MaxLength', { max: 50 });

  const errorFor = (field: keyof ContributorEditorValue): string | undefined => {
    if (serverErrors?.[field]) return serverErrors[field];
    if (touched[field] && clientErrors[field]) return clientErrors[field];
    return undefined;
  };

  const isValid = Object.keys(clientErrors).length === 0;

  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();
    setTouched({ name: true, originalName: true, slug: true, biography: true, gender: true });
    if (!isValid || submitting) return;
    await onSubmit();
  };

  const inputClass = (hasError: boolean) =>
    cn('shadow-sm', hasError && 'border-destructive focus-visible:ring-destructive');

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {formError ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {formError}
        </div>
      ) : null}

      {/* Name + Slug */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="contributors-name">
            {t('Field_Name')} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="contributors-name"
            value={value.name}
            onChange={(e) => onChange({ name: e.target.value })}
            onBlur={() => setTouched((s) => ({ ...s, name: true }))}
            placeholder={t('Placeholder_Name')}
            maxLength={255}
            autoComplete="off"
            aria-invalid={!!errorFor('name')}
            aria-describedby={errorFor('name') ? 'contributors-name-error' : undefined}
            className={inputClass(!!errorFor('name'))}
          />
          {errorFor('name') ? (
            <p id="contributors-name-error" className="text-xs text-destructive">
              {errorFor('name')}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="contributors-slug">
            {t('Field_Slug')} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="contributors-slug"
            value={value.slug}
            onChange={(e) => {
              setSlugManuallyEdited(true);
              onChange({ slug: e.target.value });
            }}
            onBlur={() => setTouched((s) => ({ ...s, slug: true }))}
            placeholder={t('Placeholder_Slug')}
            maxLength={255}
            dir="ltr"
            autoComplete="off"
            aria-invalid={!!errorFor('slug')}
            aria-describedby={
              errorFor('slug') ? 'contributors-slug-error' : 'contributors-slug-hint'
            }
            className={inputClass(!!errorFor('slug'))}
          />
          {errorFor('slug') ? (
            <p id="contributors-slug-error" className="text-xs text-destructive">
              {errorFor('slug')}
            </p>
          ) : (
            <p id="contributors-slug-hint" className="text-xs text-muted-foreground">
              {t('Field_SlugHint')}
            </p>
          )}
        </div>
      </div>

      {/* Original name + Gender */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="contributors-original-name">{t('Field_OriginalName')}</Label>
          <Input
            id="contributors-original-name"
            value={value.originalName}
            onChange={(e) => onChange({ originalName: e.target.value })}
            onBlur={() => setTouched((s) => ({ ...s, originalName: true }))}
            placeholder={t('Placeholder_OriginalName')}
            maxLength={255}
            autoComplete="off"
            aria-invalid={!!errorFor('originalName')}
            className={inputClass(!!errorFor('originalName'))}
          />
          {errorFor('originalName') ? (
            <p className="text-xs text-destructive">{errorFor('originalName')}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="contributors-gender">{t('Field_Gender')}</Label>
          <Select
            dir={isRTL ? 'rtl' : 'ltr'}
            value={value.gender || ContributorGender.UNKNOWN}
            onValueChange={(g) => onChange({ ...value, gender: g as ContributorGender })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              {CONTRIBUTOR_GENDER_VALUES.map((gender) => (
                <SelectItem key={gender} value={gender}>
                  {t(`ContributorGender_${gender}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errorFor('gender') ? (
            <p className="text-xs text-destructive">{errorFor('gender')}</p>
          ) : null}
        </div>
      </div>

      {/* Biography */}
      <div className="space-y-1.5">
        <Label htmlFor="contributors-biography">{t('Field_Biography')}</Label>
        <Textarea
          id="contributors-biography"
          value={value.biography}
          onChange={(e) => onChange({ biography: e.target.value })}
          placeholder={t('Placeholder_Biography')}
          rows={6}
          className="shadow-sm"
        />
      </div>

      <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={submitting}
          className="flex-1"
        >
          {g('Cancel')}
        </Button>
        <Button type="submit" disabled={submitting || !isValid} className="flex-1">
          {submitting ? (
            <>
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
              {mode === 'create' ? t('Creating') : t('Saving')}
            </>
          ) : mode === 'create' ? (
            t('Create')
          ) : (
            t('SaveChanges')
          )}
        </Button>
      </div>
    </form>
  );
}
