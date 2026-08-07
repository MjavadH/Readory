'use client';

import * as React from 'react';
import { motion } from 'framer-motion';

import { cn } from '@/lib/utils';

type SectionProps = {
  title: string;
  description?: string;
  emptyLabel?: string;
  isEmpty?: boolean;
  action?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
};

export function ProfileSection({
  title,
  description,
  emptyLabel,
  isEmpty = false,
  action,
  className,
  children,
}: SectionProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className={cn('space-y-4 sm:space-y-5', className)}
    >
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex min-w-0 items-center gap-2">
            <span aria-hidden className="h-5 w-1.5 shrink-0 rounded-full bg-primary sm:h-6" />
            <h2 className="truncate text-lg font-bold tracking-tight text-foreground sm:text-2xl">
              {title}
            </h2>
          </div>
          {description ? (
            <p className="line-clamp-2 ps-3.5 text-xs text-muted-foreground sm:text-sm">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>

      {isEmpty ? (
        <p className="rounded-3xl border border-dashed border-border bg-muted/30 px-5 py-8 text-center text-sm text-muted-foreground">
          {emptyLabel}
        </p>
      ) : (
        children
      )}
    </motion.section>
  );
}
