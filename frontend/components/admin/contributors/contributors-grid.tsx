import type { ContributorGender } from '@shared/contributor-metadata';
import { AnimatePresence, motion } from 'framer-motion';
import { Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export type ContributorRow = {
  id: string;
  name: string;
  originalName?: string | null;
  slug: string;
  biography?: string | null;
  gender?: ContributorGender;
};

type Props = {
  contributors: ContributorRow[];
  onEdit: (contributors: ContributorRow) => void;
  onDelete: (contributors: ContributorRow) => void;
};

const cardVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -8, scale: 0.97 },
};

export function ContributorsGrid({ contributors, onEdit, onDelete }: Props) {
  const t = useTranslations('Contributors');
  const g = useTranslations('General');

  return (
    <motion.div
      layout
      className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
      <AnimatePresence mode="popLayout">
        {contributors.map((contributors) => (
          <motion.div
            key={contributors.id}
            layout
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.2, ease: 'easeOut' }}
            whileHover={{ y: -2 }}
          >
            <Card className="h-full overflow-hidden transition-shadow hover:shadow-md">
              <CardContent className="flex h-full flex-col gap-3 p-4">
                <div className="flex items-center text-center gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-base font-semibold leading-tight">
                      {contributors.name}
                    </h3>
                    {contributors.originalName ? (
                      <p className="truncate text-sm text-muted-foreground" dir="auto">
                        {contributors.originalName}
                      </p>
                    ) : null}
                  </div>
                </div>
                <Separator />
                <div className="flex flex-wrap gap-1.5 text-xs">
                  <span
                    dir="ltr"
                    className="inline-flex items-center rounded-md border border-input bg-muted/40 px-2 py-0.5 font-mono text-muted-foreground"
                  >
                    {contributors.slug}
                  </span>
                  {contributors.gender ? (
                    <span className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-secondary-foreground">
                      {t(`ContributorGender_${contributors.gender}`)}
                    </span>
                  ) : null}
                </div>

                {contributors.biography ? (
                  <p className={cn('text-sm text-muted-foreground line-clamp-3')}>
                    {contributors.biography}
                  </p>
                ) : (
                  <p className="text-sm italic text-muted-foreground/70">{t('NoBiography')}</p>
                )}

                <div className="mt-auto flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => onEdit(contributors)}
                    aria-label={t('EditContributor')}
                  >
                    <Pencil className="me-2 h-3.5 w-3.5" />
                    {g('Edit')}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(contributors)}
                    aria-label={t('DeleteContributor')}
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
}

export function ContributorsGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="h-full">
          <CardContent className="flex flex-col gap-3 p-4">
            <div className="flex items-start gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
            <div className="flex gap-1.5">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-12" />
            </div>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
            <div className="mt-2 flex gap-2">
              <Skeleton className="h-8 flex-1" />
              <Skeleton className="h-8 w-10" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
