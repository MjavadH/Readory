'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type * as React from 'react';

import { cn } from '@/lib/utils';

export interface AdminPageHeaderProps {
  icon: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Optional back link. When omitted, no back button is rendered. */
  back?: string | { href: string; label?: React.ReactNode };
  /** Buttons / meta chips rendered on the opposite side. */
  actions?: React.ReactNode;
  /** Optional extra row rendered under the header (search bar, tabs, ...). */
  children?: React.ReactNode;
  className?: string;
}

export function AdminPageHeader({
  icon: Icon,
  title,
  description,
  back,
  actions,
  children,
  className,
}: AdminPageHeaderProps) {
  const reduceMotion = useReducedMotion();
  const t = useTranslations('General');

  const backHref = typeof back === 'string' ? back : back?.href;
  const backLabel = (typeof back === 'object' && back?.label) || (backHref ? t('Back') : null);

  const container = {
    hidden: { opacity: 0, y: reduceMotion ? 0 : -8 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.25,
        ease: [0.22, 1, 0.36, 1] as const,
        staggerChildren: reduceMotion ? 0 : 0.05,
      },
    },
  };

  const item = {
    hidden: { opacity: 0, y: reduceMotion ? 0 : 4 },
    show: { opacity: 1, y: 0, transition: { duration: 0.2 } },
  };

  return (
    <motion.header
      variants={container}
      initial="hidden"
      animate="show"
      className={cn(
        'grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between',
        className,
      )}
    >
      <motion.div variants={item} className="flex min-w-0 items-center gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          {backHref ? (
            <motion.div
              whileTap={reduceMotion ? undefined : { scale: 0.9 }}
              className="mb-0.5 inline-flex"
            >
              <Link
                href={backHref}
                aria-label={typeof backLabel === 'string' ? backLabel : undefined}
                className="group inline-flex min-h-7 items-center gap-1.5 rounded-md px-1.5 py-0.5 -ms-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ArrowLeft
                  className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:-translate-x-0.5 rtl:rotate-180 rtl:group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
                <span className="truncate">{backLabel}</span>
              </Link>
            </motion.div>
          ) : null}
          <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
          {description ? (
            <p className="truncate text-xs text-muted-foreground sm:text-sm">{description}</p>
          ) : null}
        </div>
      </motion.div>

      {actions ? (
        <motion.div
          variants={item}
          className="col-span-2 flex shrink-0 flex-wrap items-center gap-2 sm:col-auto sm:justify-end"
        >
          {actions}
        </motion.div>
      ) : null}

      {children ? (
        <motion.div variants={item} className="col-span-2 w-full sm:basis-full">
          {children}
        </motion.div>
      ) : null}
    </motion.header>
  );
}

export default AdminPageHeader;
