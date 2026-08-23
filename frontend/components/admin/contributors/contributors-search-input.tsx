'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, Search, X } from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api-client';
import { cn } from '@/lib/utils';

type ContributorResult = {
  id: number;
  name: string;
  originalName?: string | null;
};

type ContributorListResponse = {
  data: ContributorResult[];
  meta?: unknown;
};

export type ContributorSearchValue = { id: number; name: string } | null;

export function ContributorsSearchInput({
  value,
  onChange,
  isRTL,
  t,
  excludeIds = [],
  placeholder,
}: {
  value: ContributorSearchValue;
  onChange: (next: ContributorSearchValue) => void;
  isRTL: boolean;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
  excludeIds?: number[];
  placeholder?: string;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ContributorResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Close on click-outside
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  // Debounced fetch
  useEffect(() => {
    if (value) return; // selected mode, no search
    const q = query.trim();
    if (q.length < 3) {
      abortRef.current?.abort();
      return;
    }

    const handle = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      try {
        const res = await apiClient.get<ContributorListResponse>('/contributor', {
          query: { q, page: 1, limit: 10 },
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        setResults(Array.isArray(res?.data) ? res.data : []);
        setHighlight(0);
      } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') return;
        setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);

    return () => clearTimeout(handle);
  }, [query, value]);

  const filtered = results.filter((r) => !excludeIds.includes(r.id));

  const commitSelect = useCallback(
    (contributors: ContributorResult) => {
      onChange({ id: contributors.id, name: contributors.name });
      setQuery('');
      setResults([]);
      setOpen(false);
    },
    [onChange],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, Math.max(filtered.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      if (filtered[highlight]) {
        e.preventDefault();
        commitSelect(filtered[highlight]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  // Selected chip mode
  if (value) {
    return (
      <div
        ref={rootRef}
        className={cn(
          'flex min-h-9 w-full items-center gap-2 rounded-md border border-input bg-transparent px-3 py-1.5 text-sm shadow-xs transition-[color,box-shadow]',
          'dark:bg-input/30',
        )}
      >
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate font-medium text-foreground">{value.name}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            onChange(null);
            setQuery('');
            setResults([]);
            setOpen(true);
            setTimeout(() => inputRef.current?.focus(), 0);
          }}
          className="h-6 w-6 shrink-0 p-0 text-muted-foreground hover:text-foreground"
          aria-label={t('RemoveContributor')}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  const showEmpty = !loading && query.trim().length >= 3 && filtered.length === 0;
  const showHint = !loading && query.trim().length > 0 && query.trim().length < 3;

  return (
    <div ref={rootRef} className="relative w-full" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="relative">
        <Search className="pointer-events-none absolute inset-s-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            const nextQuery = e.target.value;
            const trimmed = nextQuery.trim();

            setQuery(nextQuery);
            setOpen(true);

            if (trimmed.length < 3) {
              abortRef.current?.abort();
              setResults([]);
              setLoading(false);
              setHighlight(0);
            }
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? t('SearchContributors')}
          className="ps-9 pe-9"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={open}
        />
        {loading && (
          <Loader2 className="absolute inset-e-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      <AnimatePresence>
        {open && (loading || showEmpty || showHint || filtered.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
            className="absolute inset-x-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-md border border-border bg-popover text-popover-foreground shadow-md"
            role="listbox"
          >
            {loading && (
              <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>{t('Loading')}</span>
              </div>
            )}
            {!loading && showHint && (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                {t('TypeAtLeast3Chars')}
              </div>
            )}
            {!loading && showEmpty && (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                {t('NoContributorsFound')}
              </div>
            )}
            {!loading &&
              filtered.map((contributors, i) => (
                <button
                  type="button"
                  key={contributors.id}
                  role="option"
                  aria-selected={i === highlight}
                  onMouseEnter={() => setHighlight(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    commitSelect(contributors);
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-2 text-start text-sm transition-colors',
                    i === highlight
                      ? 'bg-accent text-accent-foreground'
                      : 'hover:bg-accent hover:text-accent-foreground',
                  )}
                >
                  <span className="min-w-0 flex-1 truncate font-medium">{contributors.name}</span>
                  {contributors.originalName && (
                    <span className="shrink-0 truncate text-xs text-muted-foreground">
                      {contributors.originalName}
                    </span>
                  )}
                </button>
              ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
