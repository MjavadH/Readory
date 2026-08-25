'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, Contrast, Maximize, RefreshCcw, RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onAction: (action: string) => void;
  /** Hide the reset-zoom entry when the reader is not zoomed in. */
  canResetZoom?: boolean;
  activeFilter?: FilterKey | string | null;
}

export type FilterKey = 'none' | 'sepia' | 'paper' | 'e-ink';

/** Keep in sync with the CSS the reader applies for each option. */
const FILTER_CSS: Record<FilterKey, string> = {
  none: '',
  sepia: 'sepia(100%)',
  paper: 'sepia(20%) brightness(0.9) contrast(1.1)',
  'e-ink': 'grayscale(100%) contrast(150%)',
};

const FILTER_KEYS = Object.keys(FILTER_CSS) as FilterKey[];

/** Map either a key or a CSS filter string onto a key; null when unknown. */
function normalizeFilter(value: string | null | undefined): FilterKey | null {
  if (value === null || value === undefined) return null;
  const raw = value.trim().toLowerCase().replace(/\s+/g, ' ');
  if (raw === '' || raw === 'none') return 'none';
  return (
    FILTER_KEYS.find(
      (key) => key === raw || FILTER_CSS[key].toLowerCase().replace(/\s+/g, ' ') === raw,
    ) ?? null
  );
}

const MENU_MARGIN = 10;
const MORPH_DURATION = 0.28;
const EASE_OUT = [0.16, 1, 0.3, 1] as const;
const SPRING_LAYOUT = { type: 'spring', stiffness: 520, damping: 38, mass: 0.7 } as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

/** Clip rect collapsed around the invocation point, used for the open morph. */
function collapsedClip(origin: { x: number; y: number }, size: { width: number; height: number }) {
  const half = 8;
  const top = clamp(origin.y - half, 0, size.height);
  const right = clamp(size.width - origin.x - half, 0, size.width);
  const bottom = clamp(size.height - origin.y - half, 0, size.height);
  const left = clamp(origin.x - half, 0, size.width);
  return `inset(${top}px ${right}px ${bottom}px ${left}px round 12px)`;
}

const CLIP_SHOWN = 'inset(0px 0px 0px 0px round 16px)';

/** Mobile / small-tablet portrait gets a bottom sheet instead of a floating card. */
function useIsCompact() {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const sync = () => setCompact(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return compact;
}

export function ReaderContextMenu({
  x,
  y,
  onClose,
  onAction,
  canResetZoom = false,
  activeFilter,
}: ContextMenuProps) {
  const t = useTranslations('Books');
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const compact = useIsCompact();
  const reduce = useReducedMotion() ?? false;

  /* filter state */
  const controlledFilter = normalizeFilter(activeFilter);
  const [localFilter, setLocalFilter] = useState<FilterKey>(controlledFilter ?? 'none');
  const [prevControlled, setPrevControlled] = useState(controlledFilter);

  if (controlledFilter !== prevControlled) {
    setPrevControlled(controlledFilter);
    if (controlledFilter) {
      setLocalFilter(controlledFilter);
    }
  }

  const selectedFilter = controlledFilter ?? localFilter;

  const [pos, setPos] = useState({ left: x, top: y });
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const [morphReady, setMorphReady] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  /* position */
  useLayoutEffect(() => {
    if (compact) return;
    const el = menuRef.current;
    if (!el) return;

    const { width, height } = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const left = clamp(x, MENU_MARGIN, Math.max(MENU_MARGIN, vw - width - MENU_MARGIN));
    const top = clamp(y, MENU_MARGIN, Math.max(MENU_MARGIN, vh - height - MENU_MARGIN));

    setPos({ left, top });
    setSize({ width, height });
    setOrigin({
      x: clamp(x - left, 12, Math.max(12, width - 12)),
      y: clamp(y - top, 12, Math.max(12, height - 12)),
    });
    setMorphReady(false);

    if (reduce) {
      setMorphReady(true);
      return;
    }

    let openFrame = 0;
    const prepare = requestAnimationFrame(() => {
      openFrame = requestAnimationFrame(() => setMorphReady(true));
    });
    return () => {
      cancelAnimationFrame(prepare);
      cancelAnimationFrame(openFrame);
    };
  }, [x, y, compact, reduce]);

  /* keyboard */
  const items = useCallback(
    () =>
      Array.from(
        menuRef.current?.querySelectorAll<HTMLElement>('[data-menu-item="true"]:not([disabled])') ??
          [],
      ),
    [],
  );

  useEffect(() => {
    const frame = requestAnimationFrame(() => items()[0]?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [items]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const moveFocus = (direction: 1 | -1) => {
    const list = items();
    if (!list.length) return;
    const current = list.indexOf(document.activeElement as HTMLElement);
    const next = current < 0 ? 0 : (current + direction + list.length) % list.length;
    list[next]?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      moveFocus(event.key === 'ArrowDown' ? 1 : -1);
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const list = items();
      list[event.key === 'Home' ? 0 : list.length - 1]?.focus();
    } else if (event.key === 'Tab') {
      onClose();
    }
  };

  const select = (action: string) => {
    onAction(action);
    onClose();
  };

  /** Filters keep the menu open so the check mark can animate to the new pick. */
  const selectFilter = (key: FilterKey) => {
    setLocalFilter(key);
    onAction(`filter-${key}`);
  };

  const filters = useMemo(
    () => [
      { key: 'none' as FilterKey, label: t('FilterNormal') },
      { key: 'sepia' as FilterKey, label: t('FilterSepia') },
      { key: 'paper' as FilterKey, label: t('FilterPaper') },
      { key: 'e-ink' as FilterKey, label: t('FilterEInk') },
    ],
    [t],
  );

  const ctx = { activeId, setActiveId, menuId, reduce };

  const body = (
    <>
      <div className="flex flex-col gap-0.5">
        <ContextItem
          ctx={ctx}
          icon={<Maximize className="h-4 w-4" />}
          label={t('Fullscreen')}
          onSelect={() => select('fullscreen')}
        />
        <ContextItem
          ctx={ctx}
          icon={<RefreshCcw className="h-4 w-4" />}
          label={t('ReloadPage')}
          onSelect={() => select('reload')}
        />
        <AnimatePresence initial={false}>
          {canResetZoom && (
            <motion.div
              key="reset-zoom"
              initial={reduce ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18, ease: EASE_OUT }}
              className="overflow-hidden"
            >
              <ContextItem
                ctx={ctx}
                icon={<RotateCcw className="h-4 w-4" />}
                label={t('ResetZoom')}
                onSelect={() => select('reset-zoom')}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <hr className="my-1.5 h-px border-0 bg-border/70" />

      {/* Contrast / filter matrix */}
      <div className="px-1 pb-0.5">
        <span className="mb-2 flex items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <Contrast className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{t('Contrast')}</span>
        </span>
        <div className="grid grid-cols-2 gap-1.5">
          {filters.map((filter) => (
            <FilterButton
              key={filter.key}
              ctx={ctx}
              label={filter.label}
              checked={selectedFilter === filter.key}
              onSelect={() => selectFilter(filter.key)}
            />
          ))}
        </div>
      </div>
    </>
  );

  /* compact: sheet */
  if (compact) {
    return (
      <>
        <motion.button
          type="button"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2, ease: EASE_OUT }}
          aria-label={t('Close')}
          className="fixed inset-0 z-100 bg-foreground/25 backdrop-blur-[2px]"
          onClick={onClose}
          onContextMenu={(e) => {
            e.preventDefault();
            onClose();
          }}
        />
        <motion.div
          ref={menuRef}
          id={menuId}
          role="menu"
          dir="inherit"
          tabIndex={-1}
          onKeyDown={onKeyDown}
          onContextMenu={(e) => e.preventDefault()}
          initial={reduce ? { opacity: 0 } : { y: '100%' }}
          animate={reduce ? { opacity: 1 } : { y: 0 }}
          transition={reduce ? { duration: 0.12 } : { type: 'spring', stiffness: 420, damping: 36 }}
          drag={reduce ? false : 'y'}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.35 }}
          onDragEnd={(_, info) => {
            if (info.offset.y > 90 || info.velocity.y > 700) onClose();
          }}
          className="toolbar-glass fixed inset-x-0 bottom-0 z-101 rounded-t-3xl border border-border/80 p-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-foreground shadow-2xl outline-none ring-1 ring-border/60"
        >
          <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-muted-foreground/35" />
          {body}
        </motion.div>
      </>
    );
  }

  /* pointer: floating morph card */
  return (
    <>
      <button
        type="button"
        aria-label={t('Close')}
        className="fixed inset-0 z-100"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />

      <div
        style={{ top: pos.top, left: pos.left }}
        className="fixed z-101 filter-[drop-shadow(0_18px_28px_rgb(0_0_0/0.18))]"
      >
        <motion.div
          ref={menuRef}
          id={menuId}
          role="menu"
          dir="inherit"
          tabIndex={-1}
          onKeyDown={onKeyDown}
          onContextMenu={(e) => e.preventDefault()}
          initial={false}
          animate={{
            opacity: morphReady ? 1 : 0,
            clipPath: morphReady || reduce ? CLIP_SHOWN : collapsedClip(origin, size),
          }}
          transition={
            reduce
              ? { duration: 0.1, ease: EASE_OUT }
              : { duration: MORPH_DURATION, ease: EASE_OUT }
          }
          className="toolbar-glass min-w-56 max-w-[min(20rem,calc(100vw-1.25rem))] overflow-hidden rounded-2xl border border-border p-1.5 text-foreground outline-none ring-1 ring-border/60"
        >
          {body}
        </motion.div>
      </div>
    </>
  );
}

/* pieces */

type ItemCtx = {
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  menuId: string;
  reduce: boolean;
};

function ContextItem({
  ctx,
  icon,
  label,
  onSelect,
}: {
  ctx: ItemCtx;
  icon: ReactNode;
  label: string;
  onSelect: () => void;
}) {
  const id = useId();
  const active = ctx.activeId === id;

  return (
    <button
      type="button"
      role="menuitem"
      data-menu-item="true"
      tabIndex={-1}
      onFocus={() => ctx.setActiveId(id)}
      onPointerMove={(e) => {
        if (e.pointerType !== 'touch') e.currentTarget.focus();
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      className="relative isolate flex w-full select-none items-center gap-3 rounded-xl px-3 py-3 text-start text-sm font-medium text-foreground outline-none sm:py-2.5"
    >
      {active && (
        <motion.span
          layoutId={`${ctx.menuId}-active`}
          transition={ctx.reduce ? { duration: 0 } : SPRING_LAYOUT}
          className="absolute inset-0 -z-10 rounded-xl bg-secondary"
        />
      )}
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
}

function FilterButton({
  ctx,
  label,
  checked,
  onSelect,
}: {
  ctx: ItemCtx;
  label: string;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={checked}
      data-menu-item="true"
      tabIndex={-1}
      onFocus={() => ctx.setActiveId(null)}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      className={`flex items-center justify-between gap-1.5 rounded-xl border px-2.5 py-2.5 text-xs font-medium outline-none transition-colors sm:py-2 ${
        checked
          ? 'border-transparent bg-primary/10 text-primary'
          : 'border-border/60 bg-secondary/40 text-foreground/80 hover:bg-secondary hover:text-foreground'
      }`}
    >
      <span className="min-w-0 truncate">{label}</span>
      <AnimatePresence initial={false}>
        {checked && (
          <motion.span
            key="check"
            initial={ctx.reduce ? false : { opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: ctx.reduce ? 1 : 0.7 }}
            transition={{ duration: 0.14, ease: EASE_OUT }}
            className="shrink-0"
          >
            <Check className="h-3.5 w-3.5" strokeWidth={2.6} />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
