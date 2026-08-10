import * as React from 'react';
import { AnimatePresence, motion, Reorder } from 'framer-motion';
import { useTranslations } from 'next-intl';
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  CalendarDays,
  ChevronDown,
  GripVertical,
  ListOrdered,
  Loader2,
  Pencil,
  Plus,
  StickyNote,
  Trash2,
} from 'lucide-react';

import { apiClient, getApiErrorMessage } from '@/lib/api-client';
import { useToast } from '@/providers/toast-provider';
import { cn } from '@/lib/utils';
import { getBookCoverThumbnailUrl } from '@/lib/media';
import { BookCard } from '@/components/book-card';
import { CollectionCover } from '@/components/collections/collection-cover';
import { formatUpdateTime } from '@/lib/time';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { ResponsiveModal } from '@/components/responsive-modal';
import { CollectionFormFields } from '@/components/collections/collection-form-fields';
import { BookPicker } from '@/components/admin/book-picker';
import { getBookUrl, type BookCardData } from '@/lib/types';
import {
  collectionToForm,
  type Collection,
  COLLECTION_SLUG_REGEX,
  type CollectionFormState,
  type CollectionItem,
} from '@/lib/collection-types';
import Image from 'next/image';

const DESCRIPTION_COLLAPSED_CHARS = 320;
const PICKER_LIMIT = 18;

type BooksResponse = {
  books: BookCardData[];
  stats: { total: number; Published: number; Drafts: number };
};

export type CollectionDetailProps = {
  collection: Collection;
  /** Owner or system admin: can edit the collection and its items. */
  canEdit: boolean;
  /** Only admins can add books to a collection from CollectionDetail. */
  canAddItems?: boolean;
  /** Where each book links to. */
  bookHref?: (book: BookCardData) => string;
  onChanged: () => void | Promise<void>;
  onDeleted?: () => void;
};

export function CollectionDetail({
  collection,
  canEdit,
  canAddItems = false,
  bookHref = (book) => getBookUrl(book),
  onChanged,
  onDeleted,
}: CollectionDetailProps) {
  const t = useTranslations('Collections');
  const tTime = useTranslations('Time');
  const toast = useToast();

  const isSystem = collection.type === 'SYSTEM';
  const isFavorites = collection.type === 'FAVORITES';

  const [descExpanded, setDescExpanded] = React.useState(false);
  const [manageMode, setManageMode] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  // ---- collection edit ------------------------------------------------
  const [editOpen, setEditOpen] = React.useState(false);
  const [form, setForm] = React.useState<CollectionFormState>(() => collectionToForm(collection));

  const openEdit = () => {
    setForm(collectionToForm(collection));
    setEditOpen(true);
  };

  const saveCollection = async () => {
    const slug = form.slug.trim();
    if (!form.title.trim()) {
      toast.error(t('Toast.TitleRequired'));
      return;
    }
    if (!slug) {
      toast.error(t('Toast.SlugRequired'));
      return;
    }
    if (!COLLECTION_SLUG_REGEX.test(slug)) {
      toast.error(t('Toast.SlugInvalid'));
      return;
    }
    setIsSaving(true);
    try {
      await apiClient.patch(`/collections/${collection.id}`, {
        title: form.title.trim(),
        slug,
        description: form.description.trim() || undefined,
        ...(isSystem
          ? {
              featured: form.featured,
              visibility: form.visibility,
              allowIndexing: form.allowIndexing,
            }
          : { visibility: form.visibility, allowIndexing: form.allowIndexing }),
      });
      toast.success(t('Toast.Updated'));
      setEditOpen(false);
      await onChanged();
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('Toast.SaveFailed')));
    } finally {
      setIsSaving(false);
    }
  };

  const deleteCollection = async () => {
    setIsSaving(true);
    try {
      await apiClient.delete(`/collections/${collection.id}`);
      toast.success(t('Toast.Deleted'));
      setDeleteOpen(false);
      onDeleted?.();
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('Toast.DeleteFailed')));
    } finally {
      setIsSaving(false);
    }
  };

  // ---- items ----------------------------------------------------------
  const collectionItems = React.useMemo(() => collection.items ?? [], [collection.items]);
  const [itemsState, setItemsState] = React.useState(() => ({
    source: collectionItems,
    items: collectionItems,
  }));
  if (itemsState.source !== collectionItems)
    setItemsState({ source: collectionItems, items: collectionItems });
  const items = itemsState.source === collectionItems ? itemsState.items : collectionItems;
  const setItems = React.useCallback((next: CollectionItem[]) => {
    setItemsState((state) => ({ source: state.source, items: next }));
  }, []);
  const [pendingItemId, setPendingItemId] = React.useState<number | null>(null);
  const [isReordering, setIsReordering] = React.useState(false);

  const isOrderDirty = React.useMemo(() => {
    return (
      items.length === collectionItems.length &&
      items.some((item, index) => item.id !== collectionItems[index]?.id)
    );
  }, [collectionItems, items]);

  const persistOrder = async (next: CollectionItem[]) => {
    if (!isOrderDirty) {
      setManageMode(false);
      return;
    }
    const previous = collectionItems;
    setIsReordering(true);
    try {
      await apiClient.put(`/collections/${collection.id}/items/reorder`, {
        itemIds: next.map((item) => item.id),
      });
      setManageMode(false);
      await onChanged();
    } catch (e) {
      setItems(previous);
      toast.error(getApiErrorMessage(e, t('Toast.ReorderFailed')));
    } finally {
      setIsReordering(false);
    }
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    setItems(next);
  };

  const toggleManageMode = () => {
    if (manageMode) void persistOrder(items);
    else setManageMode(true);
  };

  const removeItem = async (item: CollectionItem) => {
    if (!window.confirm(t('ConfirmRemoveItem', { title: item.book.title }))) return;
    setPendingItemId(item.id);
    try {
      await apiClient.delete(`/collections/${collection.id}/items/${item.id}`);
      toast.success(t('Toast.ItemRemoved'));
      await onChanged();
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('Toast.ItemRemoveFailed')));
    } finally {
      setPendingItemId(null);
    }
  };

  // ---- note editing ----------------------------------------------------
  const [noteItem, setNoteItem] = React.useState<CollectionItem | null>(null);
  const [noteDraft, setNoteDraft] = React.useState('');

  const openNote = (item: CollectionItem) => {
    setNoteItem(item);
    setNoteDraft(item.note ?? '');
  };

  const saveNote = async () => {
    if (!noteItem) return;
    setIsSaving(true);
    try {
      await apiClient.patch(`/collections/${collection.id}/items/${noteItem.id}`, {
        note: noteDraft.trim() || undefined,
      });
      toast.success(t('Toast.NoteSaved'));
      setNoteItem(null);
      await onChanged();
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('Toast.SaveFailed')));
    } finally {
      setIsSaving(false);
    }
  };

  // ---- add book (admin only) -------------------------------------------
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [pickerBooks, setPickerBooks] = React.useState<BookCardData[]>([]);
  const [pickerLoading, setPickerLoading] = React.useState(false);
  const [pickerSearch, setPickerSearch] = React.useState('');
  const [pickerPage, setPickerPage] = React.useState(1);
  const [pickerTotal, setPickerTotal] = React.useState(0);

  React.useEffect(() => {
    if (!pickerOpen) return;
    let cancelled = false;

    const load = async () => {
      setPickerLoading(true);
      try {
        const res = await apiClient.get<BooksResponse>(
          `/books/allBooks?status=published&page=${pickerPage}&limit=${PICKER_LIMIT}&q=${encodeURIComponent(pickerSearch)}`,
        );
        if (cancelled) return;
        setPickerBooks(res.books ?? []);
        setPickerTotal(res.stats?.Published ?? res.books?.length ?? 0);
      } catch (e) {
        if (!cancelled) toast.error(getApiErrorMessage(e, t('Toast.LoadBooksFailed')));
      } finally {
        if (!cancelled) setPickerLoading(false);
      }
    };

    const timer = setTimeout(load, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pickerOpen, pickerPage, pickerSearch, t, toast]);

  const addBook = async (book: BookCardData | null) => {
    if (!book) return;
    setIsSaving(true);
    try {
      await apiClient.post(`/collections/${collection.id}/items`, { bookId: book.id });
      toast.success(t('Toast.ItemAdded', { title: book.title }));
      await onChanged();
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('Toast.ItemAddFailed')));
    } finally {
      setIsSaving(false);
    }
  };

  // ---- derived ---------------------------------------------------------
  const description = collection.description?.trim() ?? '';
  const isDescLong = description.length > DESCRIPTION_COLLAPSED_CHARS;
  const descDisplay =
    isDescLong && !descExpanded
      ? `${description.slice(0, DESCRIPTION_COLLAPSED_CHARS).trimEnd()}…`
      : description;

  // Feed the scattered-collage cover with real book records (no mock data).
  const coverBooks = React.useMemo(() => items.slice(0, 5).map((item) => item.book), [items]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
        {/* ------------------------------- details -------------------------- */}
        <motion.aside
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="lg:col-span-4"
        >
          <div className="rounded-3xl border border-border/60 bg-card/70 shadow-sm backdrop-blur-sm lg:sticky lg:top-20">
            <div className="relative overflow-hidden rounded-t-3xl">
              <div className="absolute inset-0 bg-linear-to-br from-primary/15 via-primary/5 to-transparent" />
              <div className="relative flex flex-col items-center gap-4 px-5 pb-6 pt-7 text-center sm:px-6 sm:pt-9">
                <CollectionCover
                  books={coverBooks}
                  size="hero"
                  className="w-full max-w-xs sm:max-w-sm"
                />

                <div className="min-w-0">
                  <h1
                    dir="auto"
                    className="text-balance text-2xl font-black leading-tight tracking-tight sm:text-3xl"
                  >
                    {collection.title}
                  </h1>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 px-5 pb-2 sm:px-6">
              <MiniStat
                icon={<BookOpen className="h-4 w-4" />}
                value={String(collection.bookCount)}
                label={t('BookCount')}
              />
              <MiniStat
                icon={<CalendarDays className="h-4 w-4" />}
                value={formatUpdateTime(collection.updatedAt, tTime)}
                label={t('UpdatedLabel')}
                compact
              />
            </div>

            {description && (
              <div className="px-5 pb-5 pt-4 sm:px-6">
                <Separator className="mb-4" />
                <h2 className="mb-2 text-start text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('About')}
                </h2>
                <p
                  dir="auto"
                  className="whitespace-pre-line text-start text-sm leading-relaxed text-foreground/90"
                >
                  {descDisplay}
                </p>
                {isDescLong && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDescExpanded((v) => !v)}
                    className="mt-2 h-8 gap-1 px-2 text-xs"
                  >
                    {descExpanded ? t('ShowLess') : t('ShowMore')}
                    <ChevronDown
                      className={cn(
                        'h-3.5 w-3.5 transition-transform',
                        descExpanded && 'rotate-180',
                      )}
                    />
                  </Button>
                )}
              </div>
            )}

            {canEdit && (
              <div className="flex flex-col gap-2 border-t border-border/60 px-5 py-4 sm:px-6">
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 gap-1.5"
                    onClick={openEdit}
                    disabled={isSaving}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    {t('Actions.Edit')}
                  </Button>
                </div>
                {!collection.locked && !isFavorites && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setDeleteOpen(true)}
                    disabled={isSaving}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {t('Actions.DeleteCollection')}
                  </Button>
                )}
              </div>
            )}
          </div>
        </motion.aside>

        {/* -------------------------------- items --------------------------- */}
        <section className="lg:col-span-8">
          {canEdit && items.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.05 }}
              className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-border/60 bg-card/50 px-4 py-3"
            >
              {isReordering && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}

              <Button
                size="sm"
                variant={manageMode ? 'default' : 'outline'}
                className="gap-1.5"
                onClick={toggleManageMode}
                disabled={isReordering}
              >
                <ListOrdered className="h-3.5 w-3.5" />
                {manageMode ? t('Actions.Done') : t('Actions.Manage')}
              </Button>

              <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('DeleteCollectionTitle')}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('DeleteCollectionDescription', { title: collection.title })}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isSaving}>{t('Actions.Cancel')}</AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      disabled={isSaving}
                      onClick={(event) => {
                        event.preventDefault();
                        void deleteCollection();
                      }}
                    >
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        t('Actions.Delete')
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {canAddItems && (
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    setPickerSearch('');
                    setPickerPage(1);
                    setPickerOpen(true);
                  }}
                  disabled={isSaving}
                >
                  <Plus className="h-4 w-4" />
                  {t('Actions.AddBook')}
                </Button>
              )}
            </motion.div>
          )}

          {items.length === 0 ? (
            <EmptyItems
              title={t('Empty.ItemsTitle')}
              hint={canAddItems ? t('Empty.ItemsHintAdmin') : t('Empty.ItemsHint')}
            />
          ) : manageMode ? (
            <Reorder.Group
              axis="y"
              values={items}
              onReorder={setItems}
              className="flex flex-col gap-2"
            >
              {items.map((item, index) => (
                <Reorder.Item key={item.id} value={item} className="list-none">
                  <ManageRow
                    item={item}
                    index={index}
                    total={items.length}
                    busy={pendingItemId === item.id}
                    onMoveUp={() => moveItem(index, -1)}
                    onMoveDown={() => moveItem(index, 1)}
                    onEditNote={() => openNote(item)}
                    onRemove={() => void removeItem(item)}
                    labels={{
                      moveUp: t('Actions.MoveUp'),
                      moveDown: t('Actions.MoveDown'),
                      note: t('Actions.EditNote'),
                      remove: t('Actions.Remove'),
                    }}
                  />
                </Reorder.Item>
              ))}
            </Reorder.Group>
          ) : (
            <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              <AnimatePresence initial={false}>
                {items.map((item, index) => (
                  <motion.article
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ duration: 0.25, delay: Math.min(index, 8) * 0.03 }}
                    className="flex flex-col"
                  >
                    <BookCard
                      book={item.book}
                      link={bookHref(item.book)}
                      note={item.note}
                      noteLabel={t('Note')}
                    />
                  </motion.article>
                ))}
              </AnimatePresence>
            </div>
          )}
        </section>
      </div>

      {/* ------------------------------- modals ------------------------------ */}
      <ResponsiveModal
        open={editOpen}
        onOpenChange={setEditOpen}
        title={t('EditCollection')}
        description={t('EditCollectionHint')}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={isSaving}>
              {t('Actions.Cancel')}
            </Button>
            <Button onClick={saveCollection} disabled={isSaving} className="gap-1.5">
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('Actions.Save')}
            </Button>
          </div>
        }
      >
        <CollectionFormFields
          value={form}
          onChange={setForm}
          isSystem={isSystem}
          disableSlug={isFavorites}
        />
      </ResponsiveModal>

      <ResponsiveModal
        open={Boolean(noteItem)}
        onOpenChange={(open) => !open && setNoteItem(null)}
        title={t('EditNote')}
        description={noteItem?.book.title}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setNoteItem(null)} disabled={isSaving}>
              {t('Actions.Cancel')}
            </Button>
            <Button onClick={saveNote} disabled={isSaving} className="gap-1.5">
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('Actions.Save')}
            </Button>
          </div>
        }
      >
        <Textarea
          dir="auto"
          rows={5}
          maxLength={1000}
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          placeholder={t('NotePlaceholder')}
          className="resize-none text-start"
        />
      </ResponsiveModal>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('DeleteCollectionTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('DeleteCollectionDescription', { title: collection.title })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>{t('Actions.Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isSaving}
              onClick={(event) => {
                event.preventDefault();
                void deleteCollection();
              }}
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('Actions.Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {canAddItems && (
        <BookPicker
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          books={pickerBooks}
          onSelect={(book) => void addBook(book)}
          isLoading={pickerLoading}
          title={t('Actions.AddBook')}
          description={t('AddBookHint')}
          searchQuery={pickerSearch}
          onSearchChange={(q) => {
            setPickerSearch(q);
            setPickerPage(1);
          }}
          page={pickerPage}
          onPageChange={setPickerPage}
          totalItems={pickerTotal}
          totalPages={Math.max(1, Math.ceil(pickerTotal / PICKER_LIMIT))}
          limit={PICKER_LIMIT}
        />
      )}
    </div>
  );
}

/* ------------------------------ sub components ----------------------------- */

function MiniStat({
  icon,
  value,
  label,
  compact,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  compact?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/50 px-3 py-2 text-start">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </span>
      <div className="min-w-0">
        <p className={cn('truncate font-bold', compact ? 'text-xs' : 'text-sm')}>{value}</p>
        <p className="truncate text-[10px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function ManageRow({
  item,
  index,
  total,
  busy,
  onMoveUp,
  onMoveDown,
  onEditNote,
  onRemove,
  labels,
}: {
  item: CollectionItem;
  index: number;
  total: number;
  busy: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onEditNote: () => void;
  onRemove: () => void;
  labels: { moveUp: string; moveDown: string; note: string; remove: string };
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card px-3 py-2.5">
      <GripVertical className="hidden h-4 w-4 shrink-0 cursor-grab text-muted-foreground sm:block" />

      <span className="w-5 shrink-0 text-center text-xs font-semibold text-muted-foreground">
        {index + 1}
      </span>

      <div className="h-14 w-10 shrink-0 overflow-hidden rounded-md bg-muted">
        <Image
          src={getBookCoverThumbnailUrl(item.book.coverImage)}
          alt={item.book.title}
          width={55}
          height={55}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>

      <div className="min-w-0 flex-1 text-start">
        <p dir="auto" className="line-clamp-1 text-sm font-medium">
          {item.book.title}
        </p>
        {item.book.contributors && (
          <p dir="auto" className="line-clamp-1 text-[11px] text-muted-foreground">
            {item.book.contributors}
          </p>
        )}
        {item.note && (
          <p dir="auto" className="line-clamp-1 text-[11px] italic text-muted-foreground">
            {item.note}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          aria-label={labels.moveUp}
          disabled={index === 0 || busy}
          onClick={onMoveUp}
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          aria-label={labels.moveDown}
          disabled={index === total - 1 || busy}
          onClick={onMoveDown}
        >
          <ArrowDown className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          aria-label={labels.note}
          disabled={busy}
          onClick={onEditNote}
        >
          <StickyNote className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
          aria-label={labels.remove}
          disabled={busy}
          onClick={onRemove}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

function EmptyItems({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-muted">
        <BookOpen className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-xs px-6 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
