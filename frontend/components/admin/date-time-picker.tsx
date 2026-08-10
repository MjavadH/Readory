import * as React from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useIsMobile } from '@/hooks/use-mobile';

export type DateTimePickerProps = {
  value?: Date;
  defaultValue?: Date;
  onChange?: (date: Date) => void;
  min?: Date;
  max?: Date;
  showTime?: boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  locale?: string;
};

type Parts = { year: number; month: number; day: number };

const MS_DAY = 86_400_000;

function getLocale(locale?: string) {
  if (locale) return locale;
  if (typeof navigator !== 'undefined' && navigator.language) return navigator.language;
  return 'en-US';
}

function getCalendar(locale: string) {
  try {
    return new Intl.DateTimeFormat(locale).resolvedOptions().calendar ?? 'gregory';
  } catch {
    return 'gregory';
  }
}

/** Extract localized calendar parts (year/month index/day) for a given Date. */
function getParts(date: Date, locale: string, calendar: string): Parts {
  const fmt = new Intl.DateTimeFormat(`${locale}-u-ca-${calendar}`, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    numberingSystem: 'latn',
  });
  const parts = fmt.formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { year: get('year'), month: get('month'), day: get('day') };
}

/** Format day number for display in the target calendar's native numerals. */
function formatDayLabel(date: Date, locale: string, calendar: string) {
  return new Intl.DateTimeFormat(`${locale}-u-ca-${calendar}`, { day: 'numeric' }).format(date);
}

function formatMonthYear(date: Date, locale: string, calendar: string) {
  return new Intl.DateTimeFormat(`${locale}-u-ca-${calendar}`, {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function formatTrigger(date: Date, locale: string, calendar: string, showTime: boolean) {
  return new Intl.DateTimeFormat(`${locale}-u-ca-${calendar}`, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(showTime ? { hour: 'numeric', minute: '2-digit', hour12: true } : {}),
  }).format(date);
}

function startOfDay(d: Date) {
  const n = new Date(d);
  n.setHours(0, 0, 0, 0);
  return n;
}

function samePart(a: Parts, b: Parts) {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

/** Build the visible month grid (always 6 rows x 7 cols) around `cursor`. */
function buildMonthGrid(cursor: Date, locale: string, calendar: string) {
  const cursorParts = getParts(cursor, locale, calendar);

  // Walk back day-by-day until the month part changes -> first of month.
  let firstOfMonth = startOfDay(cursor);
  for (let i = 0; i < 40; i++) {
    const prev = new Date(firstOfMonth.getTime() - MS_DAY);
    if (getParts(prev, locale, calendar).month !== cursorParts.month) break;
    firstOfMonth = prev;
  }

  // Start of week (Sunday). Simple, works across locales for a compact grid.
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());

  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart.getTime() + i * MS_DAY);
    cells.push({
      date: d,
      inMonth: getParts(d, locale, calendar).month === cursorParts.month,
    });
  }
  return cells;
}

function getWeekdays(locale: string) {
  const fmt = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  // 2024-01-07 is a Sunday.
  const base = new Date(2024, 0, 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    return fmt.format(d);
  });
}

function to12h(hour24: number) {
  const ampm: 'AM' | 'PM' = hour24 >= 12 ? 'PM' : 'AM';
  const h = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return { hour12: h, ampm };
}

function from12h(hour12: number, ampm: 'AM' | 'PM') {
  const h = hour12 % 12;
  return ampm === 'PM' ? h + 12 : h;
}

type Draft = {
  date: Date; // day precision
  hour12: number;
  minute: number;
  ampm: 'AM' | 'PM';
};

function makeDraft(source: Date): Draft {
  const { hour12, ampm } = to12h(source.getHours());
  return {
    date: startOfDay(source),
    hour12,
    minute: source.getMinutes(),
    ampm,
  };
}

function composeDate(draft: Draft, showTime: boolean): Date {
  const d = new Date(draft.date);
  if (showTime) {
    d.setHours(from12h(draft.hour12, draft.ampm), draft.minute, 0, 0);
  }
  return d;
}

function clampToBounds(date: Date, min?: Date, max?: Date) {
  if (min && date < min) return new Date(min);
  if (max && date > max) return new Date(max);
  return date;
}

export function DateTimePicker({
  value,
  defaultValue,
  onChange,
  min,
  max,
  showTime = true,
  placeholder = 'Select date',
  disabled,
  className,
  locale: localeProp,
}: DateTimePickerProps) {
  const isMobile = useIsMobile();
  const locale = React.useMemo(() => getLocale(localeProp), [localeProp]);
  const calendar = React.useMemo(() => getCalendar(locale), [locale]);

  const isControlled = value !== undefined;
  const [internal, setInternal] = React.useState<Date | undefined>(defaultValue);
  const current = isControlled ? value : internal;

  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<Draft>(() => makeDraft(current ?? new Date()));
  const [cursor, setCursor] = React.useState<Date>(current ?? new Date());

  // Reset draft each time the popover/drawer opens.
  React.useEffect(() => {
    if (open) {
      const base = current ?? clampToBounds(new Date(), min, max);
      setDraft(makeDraft(base));
      setCursor(base);
    }
  }, [open, current, max, min]);

  const weekdays = React.useMemo(() => getWeekdays(locale), [locale]);
  const grid = React.useMemo(
    () => buildMonthGrid(cursor, locale, calendar),
    [cursor, locale, calendar],
  );

  const minDay = min ? startOfDay(min) : undefined;
  const maxDay = max ? startOfDay(max) : undefined;

  const isDayDisabled = (d: Date) => {
    if (minDay && d < minDay) return true;
    if (maxDay && d > maxDay) return true;
    return false;
  };

  const goMonth = (delta: number) => {
    const next = new Date(cursor);
    next.setDate(1);
    next.setMonth(next.getMonth() + delta);
    setCursor(next);
  };

  const canPrev = React.useMemo(() => {
    if (!minDay) return true;
    const first = grid.find((c) => c.inMonth)?.date;
    return first ? first > minDay : true;
  }, [grid, minDay]);

  const canNext = React.useMemo(() => {
    if (!maxDay) return true;
    const last = [...grid].reverse().find((c) => c.inMonth)?.date;
    return last ? last < maxDay : true;
  }, [grid, maxDay]);

  const handleConfirm = () => {
    let composed = composeDate(draft, showTime);
    composed = clampToBounds(composed, min, max);
    if (!isControlled) setInternal(composed);
    onChange?.(composed);
    setOpen(false);
  };

  const handleCancel = () => setOpen(false);

  const triggerLabel = current ? formatTrigger(current, locale, calendar, showTime) : placeholder;

  const trigger = (
    <Button
      type="button"
      variant="outline"
      disabled={disabled}
      className={cn(
        'w-full justify-start gap-2 font-normal',
        !current && 'text-muted-foreground',
        className,
      )}
    >
      <CalendarIcon className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate text-left">{triggerLabel}</span>
    </Button>
  );

  const todayParts = getParts(new Date(), locale, calendar);
  const selectedParts = getParts(draft.date, locale, calendar);

  const body = (
    <div className="pointer-events-auto flex flex-col gap-3 p-3 sm:gap-4 sm:p-4">
      {/* Header */}
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => goMonth(-1)}
          disabled={!canPrev}
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
        </Button>
        <div className="min-w-0 truncate text-center text-sm font-medium sm:text-base">
          {formatMonthYear(cursor, locale, calendar)}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => goMonth(1)}
          disabled={!canNext}
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
        </Button>
      </div>

      {/* Weekdays */}
      <div className="grid grid-cols-7 gap-1 text-center text-[0.7rem] font-medium text-muted-foreground">
        {weekdays.map((w) => (
          <div key={w} className="py-1">
            {w}
          </div>
        ))}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7 gap-1">
        {grid.map(({ date, inMonth }, i) => {
          const dParts = getParts(date, locale, calendar);
          const isSelected = samePart(dParts, selectedParts);
          const isToday = samePart(dParts, todayParts);
          const dDisabled = isDayDisabled(date);
          return (
            <button
              key={i}
              type="button"
              disabled={dDisabled}
              onClick={() => {
                setDraft((d) => ({ ...d, date: startOfDay(date) }));
                if (!inMonth) setCursor(date);
              }}
              className={cn(
                'flex aspect-square items-center justify-center rounded-md text-sm transition-colors',
                'hover:bg-accent hover:text-accent-foreground',
                !inMonth && 'text-muted-foreground/50',
                isToday && !isSelected && 'ring-1 ring-ring/40',
                isSelected &&
                  'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
                dDisabled && 'pointer-events-none opacity-40',
              )}
            >
              {formatDayLabel(date, locale, calendar)}
            </button>
          );
        })}
      </div>

      {/* Time */}
      {showTime && (
        <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 border-t pt-3">
          <Select
            value={String(draft.hour12)}
            onValueChange={(v) => setDraft((d) => ({ ...d, hour12: Number(v) }))}
          >
            <SelectTrigger className="h-9" aria-label="Hour">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                <SelectItem key={h} value={String(h)}>
                  {String(h).padStart(2, '0')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={String(draft.minute)}
            onValueChange={(v) => setDraft((d) => ({ ...d, minute: Number(v) }))}
          >
            <SelectTrigger className="h-9" aria-label="Minute">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {Array.from({ length: 60 }, (_, i) => i).map((m) => (
                <SelectItem key={m} value={String(m)}>
                  {String(m).padStart(2, '0')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="inline-flex overflow-hidden rounded-md border">
            {(['AM', 'PM'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setDraft((d) => ({ ...d, ampm: p }))}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium transition-colors',
                  draft.ampm === p
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-transparent text-muted-foreground hover:bg-accent',
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
        <Button type="button" variant="ghost" onClick={handleCancel}>
          Cancel
        </Button>
        <Button type="button" onClick={handleConfirm}>
          Confirm
        </Button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>{trigger}</DrawerTrigger>
        <DrawerContent className="pointer-events-auto">
          <DrawerHeader className="pb-0">
            <DrawerTitle className="text-base">
              {showTime ? 'Select date & time' : 'Select date'}
            </DrawerTitle>
          </DrawerHeader>
          <div className="mx-auto w-full max-w-sm pb-[env(safe-area-inset-bottom)]">{body}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="start"
        className="pointer-events-auto w-[calc(100vw-2rem)] max-w-[320px] p-0 sm:w-75"
      >
        {body}
      </PopoverContent>
    </Popover>
  );
}

export default DateTimePicker;
