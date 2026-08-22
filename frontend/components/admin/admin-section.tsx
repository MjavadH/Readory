'use client';

import type { LucideIcon } from 'lucide-react';

export function SectionHeader({ title, Icon }: { title: string; Icon?: LucideIcon }) {
  return (
    <div className="flex items-center align-middle gap-2">
      {Icon && <Icon className="size-5" />}
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

export function EmptySection({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}
