'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { spring } from './types';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/** Animated wrapper so toggled controls collapse/expand smoothly. */
export function ControlSlot({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  const [animating, setAnimating] = useState(true);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, width: 0, scale: 0.8 }}
      animate={{ opacity: 1, width: 'auto', scale: 1 }}
      exit={{ opacity: 0, width: 0, scale: 0.8 }}
      transition={spring}
      onAnimationStart={() => setAnimating(true)}
      onAnimationComplete={() => setAnimating(false)}
      onLayoutAnimationStart={() => setAnimating(true)}
      onLayoutAnimationComplete={() => setAnimating(false)}
      className={`${animating ? 'overflow-hidden' : 'overflow-visible'} ${className}`}
    >
      {children}
    </motion.div>
  );
}

export function ToolbarButton({
  icon,
  label,
  onClick,
  disabled,
  active,
  className = '',
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  className?: string;
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: disabled ? 1 : 0.9 }}
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors duration-150 ${
        active
          ? 'bg-primary/20 text-primary'
          : 'text-foreground/70 hover:bg-secondary hover:text-foreground'
      } disabled:cursor-not-allowed disabled:opacity-30 ${className}`}
    >
      {icon}
    </motion.button>
  );
}

export function SheetAction({
  icon,
  label,
  onClick,
  disabled,
  active,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl px-2 py-4 transition-colors disabled:opacity-40 ${
        active
          ? 'bg-primary/15 text-primary'
          : 'bg-secondary/70 text-foreground/80 hover:bg-secondary hover:text-foreground'
      }`}
    >
      {icon}
      <span className="line-clamp-1 text-[11px] font-medium">{label}</span>
    </motion.button>
  );
}

export function Divider() {
  return <div className="mx-0.5 h-5 w-px shrink-0 bg-border/60" />;
}

export function SettingRow({
  icon,
  label,
  checked,
  onChange,
}: {
  icon: ReactNode;
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className="group flex w-full items-center gap-3 rounded-xl px-2 py-2 text-start transition-colors hover:bg-secondary"
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
          checked ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground'
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground/85">
        {label}
      </span>
      <span
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
          checked ? 'bg-primary' : 'bg-border'
        }`}
      >
        <motion.span
          layout
          transition={spring}
          className="absolute h-4 w-4 rounded-full bg-background shadow-sm"
          style={{ insetInlineStart: checked ? 'calc(100% - 1.125rem)' : '0.125rem' }}
        />
      </span>
    </button>
  );
}

export function Popover({
  open,
  children,
  onOpened,
  onClose,
}: {
  open: boolean;
  children: ReactNode;
  onOpened?: () => void;
  onClose?: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shift, setShift] = useState(0);

  useEffect(() => {
    if (open) {
      onOpened?.();
    } else {
      const timer = setTimeout(() => setShift(0), 0);
      return () => clearTimeout(timer);
    }
  }, [open, onOpened]);

  /* Keep the panel inside the viewport (works for both RTL and LTR). */
  useIsomorphicLayoutEffect(() => {
    if (!open) return;
    const reposition = () => {
      const el = ref.current;
      if (!el) return;
      const margin = 12;
      const rect = el.getBoundingClientRect();
      const vw = document.documentElement.clientWidth;
      let delta = 0;
      if (rect.left < margin) delta = margin - rect.left;
      else if (rect.right > vw - margin) delta = vw - margin - rect.right;
      if (Math.abs(delta) > 0.5) setShift((prev) => prev + delta);
    };
    const raf = requestAnimationFrame(reposition);
    window.addEventListener('resize', reposition);
    window.addEventListener('orientationchange', reposition);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('orientationchange', reposition);
    };
  }, [open, shift]);

  /* Click / tap outside closes the popover. */
  useEffect(() => {
    if (!open || !onClose) return;
    const onPointerDown = (e: PointerEvent) => {
      const el = ref.current;
      if (!el) return;
      const root = el.closest('[data-popover-root]') ?? el;
      if (!root.contains(e.target as Node)) onClose();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          role="dialog"
          initial={{ opacity: 0, y: 10, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.96 }}
          transition={spring}
          style={{ ['--popover-shift' as string]: `${shift}px` }}
          className="toolbar-glass absolute bottom-full left-1/2 mb-3 w-max max-w-[calc(100vw-1.5rem)] translate-x-[calc(-50%+var(--popover-shift))] rounded-2xl p-4 shadow-2xl ring-1 ring-border/60"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
