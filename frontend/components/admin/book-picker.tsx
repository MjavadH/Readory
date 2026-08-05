import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Check, Loader2, Star, BookOpen } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { getBookCoverThumbnailUrl } from '@/lib/media';
import type { BookCardData } from '@/lib/types';
import { AppPagination } from '@/components/app-pagination';

export type BookPickerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  books: BookCardData[];
  value?: number | null;
  onSelect: (book: BookCardData | null) => void;
  isLoading?: boolean;
  title?: string;
  description?: string;
  allowClear?: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  page: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  totalPages: number;
  limit?: number;
};

export function BookPicker({
  open,
  onOpenChange,
  books,
  value,
  onSelect,
  isLoading = false,
  title,
  description,
  searchQuery,
  onSearchChange,
  page,
  onPageChange,
  totalItems,
  totalPages,
  limit = 18,
}: BookPickerProps) {
  const t = useTranslations('AdminPage.BookPicker');
  const paginationScrollRef = React.useRef<HTMLDivElement>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:w-full sm:max-w-5xl max-h-[90vh] overflow-y-auto p-0 gap-0">
        {/* Header */}
        <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-border">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base sm:text-lg font-semibold text-start">
              {title || t('SelectBook')}
            </DialogTitle>
            {description && (
              <DialogDescription className="text-xs sm:text-sm text-start">
                {description}
              </DialogDescription>
            )}
          </DialogHeader>

          {/* Search */}
          <div className="relative mt-4">
            <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={t('SearchBookPlaceholder')}
              className="ps-9 h-10 bg-muted/40 border-border focus-visible:bg-background"
            />
          </div>
        </div>

        {/* Body */}
        <div ref={paginationScrollRef} className="relative px-5 sm:px-6 py-5 min-h-80">
          {isLoading ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-sm">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : books.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
              <div className="flex items-center justify-center size-12 rounded-full bg-muted">
                <BookOpen className="size-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                {searchQuery.trim() ? t('NoBooksFoundMatch') : t('NoBooksProvided')}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-6 xl:grid-cols-6 gap-x-3 gap-y-5">
              {books.map((book) => {
                const isSelected = value === book.id;

                return (
                  <button
                    key={book.id}
                    type="button"
                    onClick={() => {
                      onSelect(book);
                      onOpenChange(false);
                    }}
                    className={[
                      'group text-start relative flex flex-col overflow-hidden rounded-lg border bg-card transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                      isSelected
                        ? 'border-primary ring-1 ring-primary'
                        : 'border-border hover:border-foreground/20',
                    ].join(' ')}
                  >
                    <div className="aspect-2/3 w-full bg-muted relative overflow-hidden">
                      <img
                        src={
                          book.coverImage
                            ? getBookCoverThumbnailUrl(book.coverImage)
                            : '/placeholder.svg'
                        }
                        alt={book.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />

                      {book.type && (
                        <div className="absolute top-2 ltr:left-2 rtl:right-2 z-10">
                          <Badge
                            variant="secondary"
                            className="bg-background/85 backdrop-blur-sm text-[10px] font-medium px-1.5 py-0.5 border border-border/50"
                          >
                            {book.type.name}
                          </Badge>
                        </div>
                      )}

                      {isSelected && (
                        <div className="absolute top-2 ltr:right-2 rtl:left-2 z-10 rounded-full bg-primary text-primary-foreground p-1">
                          <Check className="size-3.5" strokeWidth={3} />
                        </div>
                      )}
                    </div>

                    <div className="p-2.5 flex flex-col gap-1">
                      <h3 className="line-clamp-2 text-xs sm:text-sm font-medium leading-snug text-foreground">
                        {book.title}
                      </h3>

                      {book.contributors && (
                        <p className="line-clamp-1 text-[11px] text-muted-foreground">
                          {book.contributors}
                        </p>
                      )}

                      {book.ratingAvg !== undefined && book.ratingAvg > 0 && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <Star className="size-3 fill-amber-500 text-amber-500" />
                          <span className="text-[11px] font-medium text-muted-foreground">
                            {book.ratingAvg}
                          </span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-4 border-t border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-muted/20">
          {totalPages > 1 && (
            <AppPagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={limit}
              itemLabel={t('BooksLabel') || 'Book'}
              onPageChange={onPageChange}
              canGoPrevious={page > 1}
              canGoNext={page < totalPages}
              scrollTarget={paginationScrollRef}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
