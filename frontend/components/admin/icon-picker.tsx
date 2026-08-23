'use client';

import type { IconKey } from '@readory/shared';
import { Palette, Search } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { AppIcon } from '@/components/AppIcon';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { iconRegistry } from '@/lib/iconRegistry';

interface IconPickerProps {
  value?: IconKey | null;
  onChange: (key: IconKey | null) => void;
  triggerClassName?: string;
}

export function IconPicker({ value, onChange, triggerClassName }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const iconKeys = useMemo(() => Object.keys(iconRegistry) as IconKey[], []);

  const filteredIcons = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return iconKeys;
    return iconKeys.filter((k) => k.toLowerCase().includes(q));
  }, [iconKeys, search]);

  const handleSelect = (key: IconKey | null) => {
    onChange(key);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className={
            triggerClassName ??
            'h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted opacity-100 lg:opacity-0 group-hover:opacity-100 transition-all shrink-0'
          }
        >
          <Palette className="h-4 w-4" />
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Select Icon</DialogTitle>
        </DialogHeader>

        <div className="relative my-2">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search icons..."
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Current:</span>
          <div className="flex items-center gap-2">
            <AppIcon name={value ?? null} className="h-4 w-4" />
            <span className="font-mono text-xs">{value ?? 'none'}</span>
            <Button variant="outline" size="sm" onClick={() => handleSelect(null)}>
              Clear
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 max-h-[320px] overflow-y-auto p-1">
          {filteredIcons.map((key) => (
            <Button
              key={key}
              type="button"
              variant={value === key ? 'default' : 'outline'}
              className="h-12 w-full"
              onClick={() => handleSelect(key)}
            >
              <AppIcon name={key} className="h-6 w-6" />
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
