'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowLeft, BookOpen, Home, Search } from 'lucide-react';

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.09, delayChildren: 0.05 },
  },
};

export function NotFoundContent() {
  const t = useTranslations('NotFound');

  return (
    <section className="relative isolate overflow-hidden">
      {/* Ambient background — decorative only */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,theme(colors.primary/12),transparent_70%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.55] [mask-image:radial-gradient(70%_60%_at_50%_20%,black,transparent)] bg-[linear-gradient(to_right,theme(colors.foreground/6)_1px,transparent_1px),linear-gradient(to_bottom,theme(colors.foreground/6)_1px,transparent_1px)] bg-[size:36px_36px]"
      />

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-3xl flex-col items-center justify-center gap-6 px-5 py-16 text-center sm:gap-7 sm:px-8 sm:py-20 lg:max-w-4xl"
      >
        {/* Badge */}
        <motion.span
          variants={fadeUp}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur sm:text-sm"
        >
          <BookOpen className="size-4 shrink-0 text-primary" aria-hidden />
          {t('badge')}
        </motion.span>

        {/* 404 mark */}
        <motion.div variants={fadeUp} className="relative">
          <h1 className="bg-gradient-to-b from-foreground to-foreground/45 bg-clip-text text-[5.5rem] font-black leading-none tracking-tight text-transparent sm:text-[8rem] lg:text-[10rem]">
            404
          </h1>
          <motion.div
            aria-hidden
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut', delay: 0.25 }}
            className="mx-auto h-px w-40 origin-center bg-gradient-to-r from-transparent via-primary to-transparent sm:w-56"
          />
        </motion.div>

        <motion.h2
          variants={fadeUp}
          className="text-balance text-xl font-bold text-foreground sm:text-2xl lg:text-3xl"
        >
          {t('title')}
        </motion.h2>

        <motion.p
          variants={fadeUp}
          className="max-w-md text-pretty text-sm leading-relaxed text-muted-foreground sm:max-w-xl sm:text-base"
        >
          {t('description')}
        </motion.p>

        {/* Actions */}
        <motion.div
          variants={fadeUp}
          className="flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center"
        >
          <Link
            href="/"
            className="group inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:h-12 sm:text-base"
          >
            <Home className="size-4 shrink-0" aria-hidden />
            {t('actions.home')}
          </Link>

          <Link
            href="/books"
            className="group inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card px-6 text-sm font-semibold text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:h-12 sm:text-base"
          >
            <Search className="size-4 shrink-0" aria-hidden />
            {t('actions.browse')}
            <ArrowLeft
              className="size-4 shrink-0 transition-transform rtl:rotate-0 ltr:rotate-180 ltr:group-hover:translate-x-1 rtl:group-hover:-translate-x-1"
              aria-hidden
            />
          </Link>
        </motion.div>

        {/* Helper hint */}
        <motion.p variants={fadeUp} className="text-xs text-muted-foreground sm:text-sm">
          {t('hint')}
        </motion.p>
      </motion.div>
    </section>
  );
}
