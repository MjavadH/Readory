import { AnimatePresence, motion, type Transition } from 'framer-motion';
import {
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useLocaleInfo } from '@/hooks/use-locale-info';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

export type DateTimePickerProps = {
  value?: Date | undefined;
  defaultValue?: Date | undefined;
  onChange?: ((date: Date) => void) | undefined;
  min?: Date | undefined;
  max?: Date | undefined;
  showTime?: boolean | undefined;
  placeholder?: string | undefined;
  disabled?: boolean | undefined;
  className?: string | undefined;
  locale?: string | undefined;
};

type Parts = { year: number; month: number; day: number };

const MS_DAY = 86_400_000;
const EASE: Transition = { duration: 0.18, ease: [0.32, 0.72, 0, 1] };

// Intl caching.

const dtfCache = new Map<string, Intl.DateTimeFormat>();
function dtf(locale: string, options: Intl.DateTimeFormatOptions) {
  const key = `${locale}|${JSON.stringify(options)}`;
  let f = dtfCache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, options);
    dtfCache.set(key, f);
  }
  return f;
}

const nfCache = new Map<string, Intl.NumberFormat>();
function nf(locale: string) {
  let f = nfCache.get(locale);
  if (!f) {
    f = new Intl.NumberFormat(locale, { useGrouping: false });
    nfCache.set(locale, f);
  }
  return f;
}

function getCalendar(locale: string) {
  try {
    return dtf(locale, {}).resolvedOptions().calendar ?? 'gregory';
  } catch {
    return 'gregory';
  }
}

const partsCache = new Map<string, Parts>();
function getParts(date: Date, locale: string, calendar: string): Parts {
  const time = date.getTime();
  const key = `${time}|${locale}|${calendar}`;
  const hit = partsCache.get(key);
  if (hit) return hit;

  const parts = dtf(`${locale}-u-ca-${calendar}`, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    numberingSystem: 'latn',
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const result: Parts = { year: get('year'), month: get('month'), day: get('day') };

  // Bounded cache so long sessions can't grow without limit.
  if (partsCache.size > 4000) partsCache.clear();
  partsCache.set(key, result);
  return result;
}

function formatDayLabel(date: Date, locale: string, calendar: string) {
  return dtf(`${locale}-u-ca-${calendar}`, { day: 'numeric' }).format(date);
}

function formatMonthLong(date: Date, locale: string, calendar: string) {
  return dtf(`${locale}-u-ca-${calendar}`, { month: 'long' }).format(date);
}

function formatMonthShort(date: Date, locale: string, calendar: string) {
  return dtf(`${locale}-u-ca-${calendar}`, { month: 'short' }).format(date);
}

function formatNumber(n: number, locale: string) {
  return nf(locale).format(n);
}

function formatTrigger(date: Date, locale: string, calendar: string, showTime: boolean) {
  return dtf(`${locale}-u-ca-${calendar}`, {
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

function addDays(d: Date, n: number) {
  return startOfDay(new Date(d.getTime() + n * MS_DAY + (n === 0 ? 0 : 0)));
}

function samePart(a: Parts, b: Parts) {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

// month arithmetic

function startOfCalMonth(date: Date, locale: string, calendar: string) {
  let d = startOfDay(date);
  let parts = getParts(d, locale, calendar);

  // Jump back (day - 1) days: lands on the 1st for every sane calendar.
  if (parts.day > 1) {
    d = addDays(d, -(parts.day - 1));
    parts = getParts(d, locale, calendar);
  }

  // Correct for DST / rounding edge cases (at most a couple of steps).
  let guard = 0;
  while (parts.day > 1 && guard++ < 4) {
    d = addDays(d, -(parts.day - 1));
    parts = getParts(d, locale, calendar);
  }
  guard = 0;
  while (guard++ < 4) {
    const prev = addDays(d, -1);
    if (getParts(prev, locale, calendar).month === parts.month) {
      d = prev;
      parts = getParts(d, locale, calendar);
    } else break;
  }
  return d;
}

function addCalMonths(date: Date, delta: number, locale: string, calendar: string) {
  let d = startOfCalMonth(date, locale, calendar);
  if (delta === 0) return d;

  const step = delta > 0 ? 1 : -1;
  for (let i = 0; i < Math.abs(delta); i++) {
    d =
      step > 0
        ? startOfCalMonth(addDays(d, 32), locale, calendar)
        : startOfCalMonth(addDays(d, -1), locale, calendar);
  }
  return d;
}

function addCalYears(date: Date, delta: number, locale: string, calendar: string) {
  if (delta === 0) return startOfCalMonth(date, locale, calendar);
  const start = startOfCalMonth(date, locale, calendar);
  const startParts = getParts(start, locale, calendar);
  const targetYear = startParts.year + delta;

  let guess = startOfCalMonth(addDays(start, Math.round(delta * 365.2425)), locale, calendar);
  let guessParts = getParts(guess, locale, calendar);

  let guard = 0;
  while (
    (guessParts.year !== targetYear || guessParts.month !== startParts.month) &&
    guard++ < 24
  ) {
    const monthDelta = (targetYear - guessParts.year) * 12 + (startParts.month - guessParts.month);
    if (monthDelta === 0) break;
    guess = addCalMonths(guess, monthDelta, locale, calendar);
    guessParts = getParts(guess, locale, calendar);
  }
  return guess;
}

function buildMonthGrid(cursor: Date, locale: string, calendar: string) {
  const month = getParts(cursor, locale, calendar).month;
  const firstOfMonth = startOfCalMonth(cursor, locale, calendar);

  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());

  const cells: { date: Date; inMonth: boolean; key: string; label: string }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = startOfDay(new Date(gridStart.getTime() + i * MS_DAY));
    cells.push({
      date: d,
      inMonth: getParts(d, locale, calendar).month === month,
      key: String(d.getTime()),
      label: formatDayLabel(d, locale, calendar),
    });
  }
  return cells;
}

function getWeekdays(locale: string) {
  const narrow = dtf(locale, { weekday: 'narrow' });
  const full = dtf(locale, { weekday: 'long' });
  const base = new Date(2024, 0, 7); // Sunday
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    return { label: narrow.format(d), key: full.format(d) };
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

type Draft = { date: Date; hour12: number; minute: number; ampm: 'AM' | 'PM' };

function makeDraft(source: Date): Draft {
  const { hour12, ampm } = to12h(source.getHours());
  return { date: startOfDay(source), hour12, minute: source.getMinutes(), ampm };
}

function composeDate(draft: Draft, showTime: boolean): Date {
  const d = new Date(draft.date);
  if (showTime) d.setHours(from12h(draft.hour12, draft.ampm), draft.minute, 0, 0);
  return d;
}

function clampToBounds(date: Date, min?: Date, max?: Date) {
  if (min && date < min) return new Date(min);
  if (max && date > max) return new Date(max);
  return date;
}

// time stepper

function TimeStepper({
  label,
  value,
  min,
  max,
  onChange,
  pad = true,
  lockKeyboard,
  locale,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  pad?: boolean;
  lockKeyboard: boolean;
  locale: string;
}) {
  const t = useTranslations('DateTimePicker');
  const [text, setText] = React.useState<string | null>(null);

  const wrap = (n: number) => (n > max ? min : n < min ? max : n);
  const display = pad ? String(value).padStart(2, '0') : String(value);

  const commit = (raw: string) => {
    const n = Number(raw.replace(/[^\d]/g, ''));
    if (!Number.isNaN(n) && raw.trim() !== '') onChange(Math.min(max, Math.max(min, n)));
    setText(null);
  };

  return (
    <div className="flex flex-col items-center gap-0.5">
      <button
        type="button"
        aria-label={`${t('Increase')} ${label}`}
        onClick={() => onChange(wrap(value + 1))}
        className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:scale-95"
      >
        <ChevronUp className="h-3.5 w-3.5" />
      </button>

      <div className="relative h-8 w-11 overflow-hidden rounded-md border bg-muted/40">
        <input
          aria-label={label}
          value={text ?? display}
          readOnly={lockKeyboard}
          inputMode="numeric"
          onFocus={(e) => !lockKeyboard && e.currentTarget.select()}
          onChange={(e) => setText(e.target.value.slice(0, 2))}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              onChange(wrap(value + 1));
            }
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              onChange(wrap(value - 1));
            }
          }}
          className={cn(
            'absolute inset-0 h-full w-full rounded-md bg-transparent text-center text-sm font-semibold tabular-nums outline-none',
            'focus-visible:ring-2 focus-visible:ring-ring/50',
            lockKeyboard && 'caret-transparent',
          )}
          dir="ltr"
        />
      </div>

      <button
        type="button"
        aria-label={`${t('Decrease')} ${label}`}
        onClick={() => onChange(wrap(value - 1))}
        className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:scale-95"
      >
        <ChevronDown className="h-3.5 w-3.5" />
      </button>

      <span className="text-[0.6rem] leading-none text-muted-foreground">
        {label}
        <span className="sr-only"> {formatNumber(value, locale)}</span>
      </span>
    </div>
  );
}

// picker

type View = 'days' | 'months' | 'years';

export function DateTimePicker({
  value,
  defaultValue,
  onChange,
  min,
  max,
  showTime = true,
  placeholder,
  disabled,
  className,
  locale: localeProp,
}: DateTimePickerProps) {
  const isMobile = useIsMobile();
  const t = useTranslations('DateTimePicker');
  const info = useLocaleInfo();
  const dir = info.direction;
  const locale = localeProp ?? info.localeInfo.locale;
  const calendar = React.useMemo(() => getCalendar(locale), [locale]);

  const isControlled = value !== undefined;
  const [internal, setInternal] = React.useState<Date | undefined>(defaultValue);
  const current = isControlled ? value : internal;

  const [open, setOpen] = React.useState(false);
  const [view, setView] = React.useState<View>('days');
  const [dirStep, setDirStep] = React.useState(1);
  const [draft, setDraft] = React.useState<Draft>(() => makeDraft(current ?? new Date()));
  const [cursor, setCursor] = React.useState<Date>(() => current ?? new Date());

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      const base = current ?? clampToBounds(new Date(), min, max);
      setDraft(makeDraft(base));
      setCursor(base);
      setView('days');
    }
    setOpen(nextOpen);
  };

  const weekdays = React.useMemo(() => getWeekdays(locale), [locale]);

  const cursorParts = React.useMemo(
    () => getParts(cursor, locale, calendar),
    [cursor, locale, calendar],
  );
  const cursorYear = cursorParts.year;

  const grid = React.useMemo(
    () => buildMonthGrid(cursor, locale, calendar),
    [cursor, locale, calendar],
  );

  // Only built while the months view is on screen.
  const months = React.useMemo(() => {
    if (view !== 'months') return [];
    let d = addCalMonths(cursor, 1 - cursorParts.month, locale, calendar);
    return Array.from({ length: 12 }, (_, i) => {
      if (i > 0) d = addCalMonths(d, 1, locale, calendar);
      return { date: d, label: formatMonthShort(d, locale, calendar), index: i + 1 };
    });
  }, [view, cursor, cursorParts.month, locale, calendar]);

  // A 12-year page in the cursor's own calendar. Only built for the years view,
  // and each year is one step from the previous one instead of a fresh walk.
  const yearStart = cursorYear - (((cursorYear % 12) + 12) % 12);
  const years = React.useMemo(() => {
    if (view !== 'years') return [];
    let d = addCalYears(cursor, yearStart - cursorYear, locale, calendar);
    return Array.from({ length: 12 }, (_, i) => {
      if (i > 0) d = addCalMonths(d, 12, locale, calendar);
      return { year: yearStart + i, date: d };
    });
  }, [view, cursor, cursorYear, yearStart, locale, calendar]);

  const minDay = React.useMemo(() => (min ? startOfDay(min) : undefined), [min]);
  const maxDay = React.useMemo(() => (max ? startOfDay(max) : undefined), [max]);

  const isDayDisabled = (d: Date) => {
    if (minDay && d < minDay) return true;
    if (maxDay && d > maxDay) return true;
    return false;
  };

  const goMonth = (delta: number) => {
    setDirStep(delta);
    setCursor(addCalMonths(cursor, delta, locale, calendar));
  };

  const canPrev = React.useMemo(() => {
    if (!minDay) return true;
    const first = grid.find((c) => c.inMonth)?.date;
    return first ? first > minDay : true;
  }, [grid, minDay]);

  const canNext = React.useMemo(() => {
    if (!maxDay) return true;
    let last: Date | undefined;
    for (let i = grid.length - 1; i >= 0; i--) {
      if (grid[i]?.inMonth) {
        last = grid[i]?.date;
        break;
      }
    }
    return last ? last < maxDay : true;
  }, [grid, maxDay]);

  const handleConfirm = () => {
    const composed = clampToBounds(composeDate(draft, showTime), min, max);
    if (!isControlled) setInternal(composed);
    onChange?.(composed);
    setOpen(false);
  };

  const triggerLabel = current
    ? formatTrigger(current, locale, calendar, showTime)
    : (placeholder ?? t('Placeholder'));

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
      <span className="min-w-0 flex-1 truncate text-start">{triggerLabel}</span>
    </Button>
  );

  const todayParts = React.useMemo(
    () => getParts(startOfDay(new Date()), locale, calendar),
    [locale, calendar],
  );
  const selectedParts = React.useMemo(
    () => getParts(draft.date, locale, calendar),
    [draft.date, locale, calendar],
  );
  const slide = dir === 'rtl' ? -1 : 1;

  const headerNav = (delta: number) => {
    if (view === 'days') return goMonth(delta);
    setDirStep(delta);
    setCursor(addCalYears(cursor, delta * (view === 'months' ? 1 : 12), locale, calendar));
  };

  const headerLabel =
    view === 'days'
      ? `${formatMonthLong(cursor, locale, calendar)} ${formatNumber(cursorYear, locale)}`
      : view === 'months'
        ? formatNumber(cursorYear, locale)
        : `${formatNumber(yearStart, locale)} – ${formatNumber(yearStart + 11, locale)}`;

  const body = (
    <div className="pointer-events-auto flex flex-col gap-2 p-2.5 sm:p-3">
      {/* Header */}
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={() => headerNav(-1)}
          disabled={view === 'days' && !canPrev}
          aria-label={view === 'years' ? t('PrevYears') : t('PrevMonth')}
        >
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
        </Button>

        <button
          type="button"
          onClick={() =>
            setView((v) => (v === 'days' ? 'months' : v === 'months' ? 'years' : 'days'))
          }
          aria-label={t('ChooseMonthYear')}
          className="mx-auto inline-flex min-w-0 items-center gap-1 rounded-md px-2 py-0.5 text-sm font-medium transition-colors hover:bg-accent"
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={headerLabel}
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={EASE}
              className="truncate"
            >
              {headerLabel}
            </motion.span>
          </AnimatePresence>
          <motion.span animate={{ rotate: view === 'days' ? 0 : 180 }} transition={EASE}>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </motion.span>
        </button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={() => headerNav(1)}
          disabled={view === 'days' && !canNext}
          aria-label={view === 'years' ? t('NextYears') : t('NextMonth')}
        >
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
        </Button>
      </div>

      {/* Morphing panel */}
      <motion.div layout transition={EASE} className="relative overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          {view === 'days' && (
            <motion.div
              key="days"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={EASE}
              className="flex flex-col gap-1"
            >
              <div className="grid grid-cols-7 text-center text-[0.65rem] font-medium text-muted-foreground">
                {weekdays.map((w) => (
                  <div key={w.key} className="py-0.5">
                    {w.label}
                  </div>
                ))}
              </div>

              <AnimatePresence mode="popLayout" initial={false}>
                <motion.div
                  key={`${cursorYear}-${cursorParts.month}`}
                  initial={{ opacity: 0, x: dirStep * 10 * slide }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -dirStep * 10 * slide }}
                  transition={EASE}
                  className="grid grid-cols-7 gap-px"
                >
                  {grid.map(({ date, inMonth, key, label }) => {
                    const dParts = getParts(date, locale, calendar);
                    const isSelected = samePart(dParts, selectedParts);
                    const isToday = samePart(dParts, todayParts);
                    const dDisabled = isDayDisabled(date);
                    return (
                      <button
                        key={key}
                        type="button"
                        disabled={dDisabled}
                        onClick={() => {
                          setDraft((d) => ({ ...d, date: startOfDay(date) }));
                          if (!inMonth) setCursor(date);
                        }}
                        className={cn(
                          'relative flex h-8 items-center justify-center rounded-md text-[0.8rem] transition-colors',
                          'hover:bg-accent hover:text-accent-foreground',
                          !inMonth && 'text-muted-foreground/50',
                          isToday && !isSelected && 'ring-1 ring-ring/40',
                          dDisabled && 'pointer-events-none opacity-40',
                        )}
                      >
                        {isSelected && (
                          <motion.span
                            layoutId="dtp-day-selected"
                            transition={EASE}
                            className="absolute inset-0 rounded-md bg-primary"
                          />
                        )}
                        <span
                          className={cn('relative z-10', isSelected && 'text-primary-foreground')}
                        >
                          {label}
                        </span>
                      </button>
                    );
                  })}
                </motion.div>
              </AnimatePresence>
            </motion.div>
          )}

          {view === 'months' && (
            <motion.div
              key="months"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={EASE}
              className="grid grid-cols-3 gap-1"
            >
              {months.map((m) => {
                const active = cursorParts.month === m.index;
                return (
                  <button
                    key={m.index}
                    type="button"
                    onClick={() => {
                      setCursor(m.date);
                      setView('days');
                    }}
                    className={cn(
                      'rounded-md px-2 py-2 text-[0.8rem] transition-colors hover:bg-accent',
                      active && 'bg-primary text-primary-foreground hover:bg-primary',
                    )}
                  >
                    {m.label}
                  </button>
                );
              })}
            </motion.div>
          )}

          {view === 'years' && (
            <motion.div
              key="years"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={EASE}
              className="grid grid-cols-3 gap-1"
            >
              {years.map((y) => {
                const active = cursorYear === y.year;
                return (
                  <button
                    key={y.year}
                    type="button"
                    onClick={() => {
                      setCursor(y.date);
                      setView('months');
                    }}
                    className={cn(
                      'rounded-md px-2 py-2 text-[0.8rem] tabular-nums transition-colors hover:bg-accent',
                      active && 'bg-primary text-primary-foreground hover:bg-primary',
                    )}
                  >
                    {formatNumber(y.year, locale)}
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Time */}
      {showTime && (
        <motion.div
          layout
          transition={EASE}
          className="flex items-start justify-center gap-2 border-t pt-2"
        >
          <TimeStepper
            label={t('Hour')}
            value={draft.hour12}
            min={1}
            max={12}
            lockKeyboard={isMobile}
            locale={locale}
            onChange={(n) => setDraft((d) => ({ ...d, hour12: n }))}
          />
          <span className="pt-5 text-sm font-semibold text-muted-foreground">:</span>
          <TimeStepper
            label={t('Minute')}
            value={draft.minute}
            min={0}
            max={59}
            lockKeyboard={isMobile}
            locale={locale}
            onChange={(n) => setDraft((d) => ({ ...d, minute: n }))}
          />
          <div className="mt-4 inline-flex flex-col overflow-hidden rounded-md border">
            {(['AM', 'PM'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setDraft((d) => ({ ...d, ampm: p }))}
                className="relative px-2.5 py-1 text-[0.7rem] font-medium transition-colors"
              >
                {draft.ampm === p && (
                  <motion.span
                    layoutId="dtp-ampm"
                    transition={EASE}
                    className="absolute inset-0 bg-primary"
                  />
                )}
                <span
                  className={cn(
                    'relative z-10',
                    draft.ampm === p ? 'text-primary-foreground' : 'text-muted-foreground',
                  )}
                >
                  {p === 'AM' ? t('AM') : t('PM')}
                </span>
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Footer */}
      <div className="grid grid-cols-2 gap-2 border-t pt-2 sm:flex sm:justify-end">
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          {t('Cancel')}
        </Button>
        <Button type="button" size="sm" onClick={handleConfirm}>
          {t('Confirm')}
        </Button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={handleOpenChange}>
        <DrawerTrigger asChild>{trigger}</DrawerTrigger>
        <DrawerContent
          className="pointer-events-auto max-h-[92svh]"
          // Keep the on-screen keyboard closed: never autofocus a field.
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DrawerHeader className="px-4 pb-0 pt-2">
            <DrawerTitle className="text-sm">
              {showTime ? t('SelectDateTime') : t('SelectDate')}
            </DrawerTitle>
          </DrawerHeader>
          <div className="mx-auto w-full max-w-sm overflow-y-auto pb-[env(safe-area-inset-bottom)]">
            {body}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={6}
        avoidCollisions
        collisionPadding={12}
        sticky="partial"
        className="pointer-events-auto max-h-[min(28rem,calc(100svh-2rem))] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto p-0"
      >
        <motion.div
          initial={{ opacity: 0, y: -4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={EASE}
        >
          {body}
        </motion.div>
      </PopoverContent>
    </Popover>
  );
}

export default DateTimePicker;
