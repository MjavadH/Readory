import {
  AGE_RATING_VALUES,
  type AgeRating,
  BOOK_STATUS_VALUES,
  BookStatus,
  PublicationStatus,
} from '@readory/shared';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BookOpen,
  BookText,
  Calendar,
  Check,
  Eye,
  Hash,
  ImageIcon,
  LayoutGrid,
  LucideBookOpenText,
  Sparkles,
  Tag,
  Type,
  X,
} from 'lucide-react';
import Image from 'next/image';
import type React from 'react';
import { useCallback, useRef, useState } from 'react';
import {
  type BookContributorEntry,
  ContributorsField,
} from '@/components/admin/contributors/contributors-field';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { getBookCoverThumbnailUrl } from '@/lib/media';
import { cn } from '@/lib/utils';

type OptionItem = { id: number; name: string };

export type BookEditorValue = {
  title?: string;
  originalTitle?: string | null;
  alternativeTitles?: string[];
  contributors?: BookContributorEntry[];
  description?: string | null;
  coverImage?: string;
  isFeatured?: boolean;
  publishStatus?: PublicationStatus;
  status?: BookStatus;
  ageRating?: AgeRating | null;
  publicationYear?: number | null;
  typeId?: number;
  genreIds?: number[];
};

type BookEditorStat = {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  small?: boolean;
};

function PillInput({
  pills,
  onAdd,
  onRemove,
  icon,
  placeholder,
  className,
}: {
  pills: string[];
  onAdd: (value: string) => void;
  onRemove: (index: number) => void;
  icon?: React.ReactNode;
  placeholder?: string;
  className?: string;
}) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const commitValue = useCallback(
    (raw: string) => {
      const trimmed = raw.trim();
      if (trimmed.length > 0) {
        onAdd(trimmed);
      }
      setInputValue('');
    },
    [onAdd],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
      e.preventDefault();
      commitValue(inputValue);
    } else if (e.key === 'Backspace' && inputValue === '' && pills.length > 0) {
      onRemove(pills.length - 1);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val.includes(',')) {
      const parts = val.split(',');
      parts.slice(0, -1).forEach((p) => commitValue(p));
      setInputValue(parts[parts.length - 1]);
    } else {
      setInputValue(val);
    }
  };

  const handleBlur = () => {
    // Do NOT auto-commit on blur per spec: only committed pills are sent
  };

  return (
    <div
      className={cn(
        'flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent px-3 py-1.5 text-sm shadow-xs transition-[color,box-shadow]',
        'focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50',
        'dark:bg-input/30',
        className,
      )}
      onClick={() => inputRef.current?.focus()}
    >
      {icon && <span className="pointer-events-none shrink-0 text-muted-foreground">{icon}</span>}
      <AnimatePresence initial={false}>
        {pills.map((pill, i) => (
          <motion.div
            key={pill + i}
            initial={{ opacity: 0, scale: 0.75 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.75 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            style={{ display: 'contents' }}
          >
            <Badge
              variant="secondary"
              className="flex h-6 shrink-0 items-center gap-1 rounded-full px-2 py-0 text-xs font-medium"
            >
              <span className="max-w-35 truncate">{pill}</span>
              <button
                type="button"
                aria-label={`Remove ${pill}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(i);
                }}
                className="ms-0.5 shrink-0 rounded-full p-0.5 text-secondary-foreground/60 transition-colors hover:bg-secondary-foreground/20 hover:text-secondary-foreground focus:outline-none"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          </motion.div>
        ))}
      </AnimatePresence>
      <input
        ref={inputRef}
        value={inputValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={pills.length === 0 ? placeholder : ''}
        className="h-6 min-w-20 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
      />
    </div>
  );
}

export function BookEditor({
  value,
  onChange,
  types,
  genres,
  isRTL,
  t,
  onSelectCover,
  coverAlt,
}: {
  value: BookEditorValue;
  onChange: (value: BookEditorValue) => void;
  types: OptionItem[];
  genres: OptionItem[];
  isRTL: boolean;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
  onSelectCover: () => void;
  coverAlt: string;
  stats?: BookEditorStat[];
}) {
  const handleAddAltTitle = (v: string) => {
    const current = value.alternativeTitles ?? [];
    if (!current.includes(v)) {
      onChange({ ...value, alternativeTitles: [...current, v] });
    }
  };
  const handleRemoveAltTitle = (i: number) => {
    const current = value.alternativeTitles ?? [];
    onChange({ ...value, alternativeTitles: current.filter((_, idx) => idx !== i) });
  };

  const coverUrl = value.coverImage
    ? getBookCoverThumbnailUrl(value.coverImage)
    : '/placeholder.svg';

  return (
    <div className="grid gap-6 sm:gap-8 lg:grid-cols-[240px_1fr]">
      {/* Cover */}
      <motion.div
        className="mx-auto w-40 self-start sm:w-52 lg:sticky lg:top-20 lg:w-full"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
      >
        <div className="group relative overflow-hidden rounded-xl border border-border/60 bg-muted shadow-xl ring-1 ring-black/5 dark:ring-white/5">
          <div className="aspect-2/3 w-full">
            <Image
              src={coverUrl}
              alt={coverAlt}
              width={480}
              height={720}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 640px) 70vw, 240px"
              priority
            />
          </div>
        </div>
        <Button type="button" variant="outline" className="mt-3 w-full" onClick={onSelectCover}>
          <ImageIcon className="me-2 h-4 w-4" />
          {t('BookSelectCover')}
        </Button>
      </motion.div>

      <div className="min-w-0">
        <motion.div
          className="space-y-0 divide-y divide-border/60"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: {
              transition: { staggerChildren: 0.07, delayChildren: 0.1 },
            },
          }}
        >
          {/* Display Settings */}
          <EditSection icon={<Eye className="h-4 w-4" />} title={t('DisplaySettings')}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <ToggleRow
                icon={<Eye className="h-4 w-4 text-muted-foreground" />}
                label={t('Publish')}
                description={t('MarkPublished')}
                checked={value.publishStatus === PublicationStatus.PUBLISHED}
                onCheckedChange={(checked) =>
                  onChange({
                    ...value,
                    publishStatus: checked ? PublicationStatus.PUBLISHED : PublicationStatus.DRAFT,
                  })
                }
                activeColor="emerald"
              />
              <ToggleRow
                icon={<Sparkles className="h-4 w-4 text-muted-foreground" />}
                label={t('Featured')}
                description={t('MarkFeatured')}
                checked={value.isFeatured ?? false}
                onCheckedChange={(checked) => onChange({ ...value, isFeatured: checked })}
                activeColor="amber"
              />
            </div>
          </EditSection>

          {/* Basic Info */}
          <EditSection icon={<BookOpen className="h-4 w-4" />} title={t('BasicInfo')}>
            <div className="space-y-4">
              <EditField label={t('BookTitle')} required>
                <div className="relative">
                  <BookText className="pointer-events-none absolute inset-s-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={value.title || ''}
                    onChange={(e) => onChange({ ...value, title: e.target.value })}
                    className="h-11 ps-9 text-base font-medium"
                    placeholder={t('BookTitlePlaceholder')}
                  />
                </div>
              </EditField>

              <div className="grid gap-4 sm:grid-cols-2">
                <EditField label={t('OriginalTitle')}>
                  <div className="relative">
                    <Type className="pointer-events-none absolute inset-s-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={value.originalTitle || ''}
                      onChange={(e) => onChange({ ...value, originalTitle: e.target.value })}
                      placeholder={t('OriginalTitlePlaceholder')}
                      className="ps-9"
                    />
                  </div>
                </EditField>
                <EditField label={t('PublicationYear')}>
                  <div className="relative">
                    <Calendar className="pointer-events-none absolute inset-s-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={value.publicationYear ?? ''}
                      onChange={(e) =>
                        onChange({
                          ...value,
                          publicationYear: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      className="ps-9"
                      placeholder={t('PublicationYearPlaceholder')}
                    />
                  </div>
                </EditField>
              </div>

              {/* Contributors */}
              <EditField label={t('Contributors')}>
                <ContributorsField
                  value={value.contributors ?? []}
                  onChange={(contributors) => onChange({ ...value, contributors })}
                  isRTL={isRTL}
                  t={t}
                />
              </EditField>

              {/* Alternative Titles */}
              <EditField label={t('AlternativeTitles')}>
                <PillInput
                  pills={value.alternativeTitles ?? []}
                  onAdd={handleAddAltTitle}
                  onRemove={handleRemoveAltTitle}
                  icon={<Hash className="h-4 w-4" />}
                  placeholder={t('AlternativeTitlesPlaceholder')}
                />
              </EditField>
            </div>
          </EditSection>

          {/* Classification */}
          <EditSection icon={<LayoutGrid className="h-4 w-4" />} title={t('Classification')}>
            <div className="grid gap-4 sm:grid-cols-3">
              <EditField required label={t('BookType')}>
                <Select
                  dir={isRTL ? 'rtl' : 'ltr'}
                  value={`${value.typeId}` || ''}
                  onValueChange={(e) => onChange({ ...value, typeId: Number(e) })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    {types.map((tp) => (
                      <SelectItem key={tp.id} value={`${tp.id}`}>
                        {tp.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </EditField>

              <EditField label={t('BookStatus')}>
                <Select
                  dir={isRTL ? 'rtl' : 'ltr'}
                  value={value.status || BookStatus.Upcoming}
                  onValueChange={(status) => onChange({ ...value, status: status as BookStatus })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    {BOOK_STATUS_VALUES.map((status: string) => (
                      <SelectItem key={status} value={status}>
                        {t(`BookStatus_${status}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </EditField>

              <EditField label={t('AgeRating')}>
                <Select
                  dir={isRTL ? 'rtl' : 'ltr'}
                  value={value.ageRating || ''}
                  onValueChange={(ageRating) =>
                    onChange({
                      ...value,
                      ageRating: ageRating !== 'None' ? (ageRating as AgeRating) : null,
                    })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t('SelectAgeRating')} />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectItem value="None">{t('None')}</SelectItem>
                    <SelectSeparator />
                    <SelectGroup>
                      {AGE_RATING_VALUES.map((ageRating: string) => (
                        <SelectItem key={ageRating} value={ageRating}>
                          {t(`AgeRating_${ageRating}`)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </EditField>
            </div>
          </EditSection>

          {/* Genres */}
          <EditSection icon={<Tag className="h-4 w-4" />} title={t('BookGenres')}>
            <div className="flex flex-wrap gap-2">
              {genres.map((gn) => {
                const isSelected = value.genreIds?.includes(gn.id);
                return (
                  <motion.button
                    key={gn.id}
                    type="button"
                    onClick={() => {
                      const current = value.genreIds || [];
                      const next = isSelected
                        ? current.filter((id) => id !== gn.id)
                        : [...current, gn.id];
                      onChange({ ...value, genreIds: next });
                    }}
                    whileTap={{ scale: 0.93 }}
                    animate={isSelected ? { scale: 1.04 } : { scale: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                      isSelected
                        ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                        : 'border-border bg-background text-foreground hover:border-primary/50 hover:bg-accent',
                    )}
                  >
                    <AnimatePresence initial={false}>
                      {isSelected && (
                        <motion.span
                          key="check"
                          initial={{ opacity: 0, scale: 0.4, width: 0 }}
                          animate={{ opacity: 1, scale: 1, width: '0.75rem' }}
                          exit={{ opacity: 0, scale: 0.4, width: 0 }}
                          transition={{ duration: 0.15, ease: 'easeOut' }}
                          className="overflow-hidden"
                        >
                          <Check className="h-3 w-3" />
                        </motion.span>
                      )}
                    </AnimatePresence>
                    {gn.name}
                  </motion.button>
                );
              })}
            </div>
          </EditSection>

          {/* Description */}
          <EditSection
            icon={<LucideBookOpenText className="h-4 w-4" />}
            title={t('BookDescription')}
          >
            <Textarea
              value={value.description || ''}
              onChange={(e) => onChange({ ...value, description: e.target.value })}
              placeholder={t('BookDescriptionPlaceholder')}
              rows={5}
              className="resize-none"
            />
          </EditSection>
        </motion.div>
      </div>
    </div>
  );
}

function EditSection({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 16 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
      }}
      className="py-5 first:pt-0"
    >
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          {icon}
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {title}
        </span>
      </div>
      {children}
    </motion.div>
  );
}

function EditField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">
        {label}
        {required && <span className="ms-0.5 text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}

function ToggleRow({
  icon,
  label,
  description,
  checked,
  onCheckedChange,
  activeColor,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  activeColor?: 'emerald' | 'amber';
}) {
  const activeRing =
    activeColor === 'emerald'
      ? 'data-[active=true]:border-emerald-500/40 data-[active=true]:bg-emerald-500/5'
      : activeColor === 'amber'
        ? 'data-[active=true]:border-amber-500/40 data-[active=true]:bg-amber-500/5'
        : '';

  return (
    <motion.label
      data-active={checked}
      animate={checked ? { scale: 1.015 } : { scale: 1 }}
      transition={{ type: 'spring', stiffness: 350, damping: 22 }}
      className={cn(
        'flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border/60 bg-background px-4 py-3 transition-all duration-150 hover:border-border',
        activeRing,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="shrink-0 text-muted-foreground">{icon}</span>
        <div className="min-w-0">
          <p className="text-sm font-medium leading-none">{label}</p>
          <p className="mt-1 truncate text-[11px] text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </motion.label>
  );
}
