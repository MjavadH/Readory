'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { BookOpen, FolderOpen, Layers3 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { CollectionCover } from '@/components/collections/collection-cover';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import type { MyCollectionCard } from '@/lib/collection-types';
import type { BookCardData } from '@/lib/types';

export type CollectionSelectionItem = MyCollectionCard;

export type CollectionSelectionProps = {
  open: boolean;
  collections: CollectionSelectionItem[];
  selectedIds: number[];
  loading?: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectedIdsChange: (ids: number[]) => void;
  onSave: () => void | Promise<void>;
};

const SKELETON_KEYS = [
  'collection-skeleton-1',
  'collection-skeleton-2',
  'collection-skeleton-3',
  'collection-skeleton-4',
];

function useDesktopPanel() {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsDesktop(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return isDesktop;
}

function SelectionHeader({ selectedCount }: { selectedCount: number }) {
  const t = useTranslations('Books');

  return (
    <div className="flex min-w-0 items-start gap-3 text-start">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Layers3 className="h-5 w-5" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-bold text-foreground sm:text-xl">{t('SelectCollections')}</h2>
          <AnimatePresence mode="popLayout" initial={false}>
            {selectedCount > 0 && (
              <motion.span
                key={selectedCount}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary"
              >
                {t('CollectionsSelected', { count: selectedCount })}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">
          {t('SelectCollectionsDescription')}
        </p>
      </div>
    </div>
  );
}

function CollectionCard({
  collection,
  checked,
  onToggle,
}: {
  collection: CollectionSelectionItem;
  checked: boolean;
  onToggle: (id: number, checked: boolean) => void;
}) {
  const t = useTranslations('Books');
  const checkboxId = `collection-${collection.id}`;

  const books = (collection as { books?: BookCardData[] }).books;
  const covers = (collection as { covers?: string[] }).covers;

  return (
    <motion.label
      htmlFor={checkboxId}
      variants={{
        hidden: { opacity: 0 },
        visible: { opacity: 1 },
      }}
      className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background ${
        checked
          ? 'border-primary/45 bg-primary/5'
          : 'border-border/80 bg-card hover:border-primary/25 hover:bg-muted/30'
      }`}
    >
      <span className="relative block border-b border-border/60 bg-muted/30">
        <CollectionCover
          books={books}
          covers={covers}
          size="compact"
          animate={false}
          className="pointer-events-none"
        />
        <span className="absolute inset-e-2.5 top-2.5 z-10">
          <Checkbox
            id={checkboxId}
            checked={checked}
            onCheckedChange={(value) => onToggle(collection.id, value === true)}
            aria-label={collection.title}
            className="h-5 w-5 rounded-md border-border/80 bg-background/85 shadow-sm backdrop-blur"
          />
        </span>
      </span>
      <span className="flex min-w-0 items-start gap-3 p-3.5">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-foreground sm:text-[15px]">
            {collection.title}
          </span>
          {collection.description && (
            <span className="mt-0.5 line-clamp-1 block text-xs leading-5 text-muted-foreground">
              {collection.description}
            </span>
          )}
        </span>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-border/70 bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground">
          <BookOpen className="h-3.5 w-3.5 text-primary" aria-hidden />
          <span>{collection.bookCount}</span>
          <span className="sr-only">{t('BooksCount', { count: collection.bookCount })}</span>
        </span>
      </span>
    </motion.label>
  );
}

function CollectionList({
  collections,
  selectedIds,
  loading,
  onToggle,
}: {
  collections: CollectionSelectionItem[];
  selectedIds: number[];
  loading: boolean;
  onToggle: (id: number, checked: boolean) => void;
}) {
  const t = useTranslations('Books');
  const reduceMotion = useReducedMotion();

  if (loading && collections.length === 0) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {SKELETON_KEYS.map((key) => (
          <div
            key={key}
            className="overflow-hidden rounded-2xl border border-border/70 bg-muted/40 p-3"
          >
            <div className="mb-3 aspect-video w-full animate-pulse rounded-xl bg-muted" />
            <div className="h-4 w-2/5 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  if (collections.length === 0) {
    return (
      <div className="flex min-h-56 flex-col items-center justify-center px-6 py-10 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <FolderOpen className="h-6 w-6" aria-hidden />
        </div>
        <p className="mt-4 text-sm font-semibold text-foreground">{t('NoUserCollections')}</p>
      </div>
    );
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: reduceMotion ? {} : { staggerChildren: 0.03 } },
      }}
      className="grid grid-cols-1 gap-3 sm:grid-cols-2"
    >
      {collections.map((collection) => (
        <CollectionCard
          key={collection.id}
          collection={collection}
          checked={selectedIds.includes(collection.id)}
          onToggle={onToggle}
        />
      ))}
    </motion.div>
  );
}

function SelectionActions({
  canSave,
  loading,
  onCancel,
  onSave,
}: {
  canSave: boolean;
  loading: boolean;
  onCancel: () => void;
  onSave: () => void | Promise<void>;
}) {
  const g = useTranslations('General');
  const t = useTranslations('Books');

  return (
    <div className="grid grid-cols-2 gap-3">
      <Button
        type="button"
        variant="outline"
        size="lg"
        onClick={onCancel}
        disabled={loading}
        className="h-11 rounded-xl"
      >
        {g('Cancel')}
      </Button>
      <Button
        type="button"
        size="lg"
        onClick={() => void onSave()}
        disabled={!canSave || loading}
        className="h-11 rounded-xl shadow-sm shadow-primary/20"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            {t('Saving')}
          </span>
        ) : (
          g('Save')
        )}
      </Button>
    </div>
  );
}

function SelectionBody({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 sm:px-5">
      {children}
    </div>
  );
}

export function CollectionSelection({
  open,
  collections,
  selectedIds,
  loading = false,
  onOpenChange,
  onSelectedIdsChange,
  onSave,
}: CollectionSelectionProps) {
  const t = useTranslations('Books');
  const isDesktop = useDesktopPanel();
  const selectedCount = selectedIds.length;
  const initialIds = useMemo(
    () =>
      collections
        .filter((collection) => collection.containsBook)
        .map((collection) => collection.id),
    [collections],
  );
  const hasChanges = useMemo(() => {
    if (initialIds.length !== selectedIds.length) return true;
    const current = new Set(selectedIds);
    return initialIds.some((id) => !current.has(id));
  }, [initialIds, selectedIds]);

  const toggleCollection = (id: number, checked: boolean) => {
    onSelectedIdsChange(
      checked
        ? [...new Set([...selectedIds, id])]
        : selectedIds.filter((selectedId) => selectedId !== id),
    );
  };

  const list = (
    <CollectionList
      collections={collections}
      selectedIds={selectedIds}
      loading={loading}
      onToggle={toggleCollection}
    />
  );

  const actions = (
    <SelectionActions
      canSave={collections.length > 0 && hasChanges}
      loading={loading}
      onCancel={() => onOpenChange(false)}
      onSave={onSave}
    />
  );

  if (!isDesktop) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
        <DrawerContent className="max-h-[88dvh] rounded-t-3xl border-border bg-card">
          <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col">
            <DrawerHeader className="border-b border-border/70 px-4 pb-4 pt-2 text-start sm:px-5">
              <DrawerTitle asChild>
                <div>
                  <SelectionHeader selectedCount={selectedCount} />
                </div>
              </DrawerTitle>
              <DrawerDescription className="sr-only">
                {t('SelectCollectionsDescription')}
              </DrawerDescription>
            </DrawerHeader>
            <SelectionBody>{list}</SelectionBody>
            <DrawerFooter className="border-t border-border/70 bg-card/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:px-5">
              {actions}
            </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[82dvh] w-[min(94vw,44rem)] max-w-2xl flex-col gap-0 overflow-hidden rounded-2xl border-border bg-card p-0 shadow-2xl">
        <div className="border-b border-border/70 px-6 py-5 pe-14">
          <DialogTitle asChild>
            <div>
              <SelectionHeader selectedCount={selectedCount} />
            </div>
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t('SelectCollectionsDescription')}
          </DialogDescription>
        </div>
        <SelectionBody>{list}</SelectionBody>
        <div className="border-t border-border/70 bg-card/95 px-6 py-4 backdrop-blur">
          {actions}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default CollectionSelection;
