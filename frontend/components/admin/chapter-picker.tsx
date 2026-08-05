import * as React from 'react';
import { useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Check, Loader2, FileText } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { AppPagination } from '@/components/app-pagination';

export type ChapterItemData = {
  id: number;
  title: string | null;
  index: number;
  price?: number | null;
  isFree?: boolean;
  publishStatus?: string;
  updatedAt?: string;
};

export type ChapterPickerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chapters: ChapterItemData[];
  value?: number | null;
  onSelect: (chapter: ChapterItemData | null) => void;
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

export function ChapterPicker({
  open,
  onOpenChange,
  chapters,
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
  limit = 50,
}: ChapterPickerProps) {
  const t = useTranslations('AdminPage.ChapterPicker');
  const paginationScrollRef = React.useRef<HTMLDivElement>(null);

  // Clear search when closed
  useEffect(() => {
    if (!open) {
      onSearchChange('');
      onPageChange(1);
    }
  }, [open, onSearchChange, onPageChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:w-full sm:max-w-3xl max-h-[90vh] overflow-y-auto p-0 gap-0">
        {/* Header */}
        <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-border">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base sm:text-lg font-semibold text-start">
              {title || t('SelectChapter')}
            </DialogTitle>
            {description && (
              <DialogDescription className="text-xs sm:text-sm text-start">
                {description}
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="relative mt-4">
            <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={t('SearchChapterPlaceholder')}
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
          ) : chapters.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
              <div className="flex items-center justify-center size-12 rounded-full bg-muted">
                <FileText className="size-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                {searchQuery.trim() ? t('NoChaptersFoundMatch') : t('NoChaptersProvided')}
              </p>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-border rounded-lg border border-border overflow-hidden">
              {chapters.map((chapter) => {
                const isSelected = value === chapter.id;

                return (
                  <button
                    key={chapter.id}
                    type="button"
                    onClick={() => {
                      onSelect(chapter);
                      onOpenChange(false);
                    }}
                    className={[
                      'group relative flex items-center gap-3 px-3 sm:px-4 py-3 text-start transition-colors outline-none focus-visible:bg-accent',
                      isSelected ? 'bg-primary/5 hover:bg-primary/10' : 'bg-card hover:bg-muted/50',
                    ].join(' ')}
                  >
                    {/* Chapter Index */}
                    <div
                      className={[
                        'flex items-center justify-center shrink-0 size-10 rounded-md text-sm font-semibold tabular-nums',
                        isSelected
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground group-hover:bg-background border border-border',
                      ].join(' ')}
                    >
                      {chapter.index}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <span className="text-sm font-medium truncate text-foreground">
                        {chapter.title || `${t('Chapter')} ${chapter.index}`}
                      </span>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        {chapter.publishStatus && (
                          <span className="text-[11px] text-muted-foreground">
                            {chapter.publishStatus}
                          </span>
                        )}
                        {chapter.isFree && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 h-4 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 font-normal"
                          >
                            {t('Free')}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Indicator */}
                    {isSelected && (
                      <div className="shrink-0 text-primary">
                        <Check className="size-4" strokeWidth={3} />
                      </div>
                    )}
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
              itemLabel={t('ChaptersLabel') || 'Chapter'}
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
