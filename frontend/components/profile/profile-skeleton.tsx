'use client';

import { Skeleton } from '@/components/ui/skeleton';

export function ProfileSkeleton() {
  return (
    <main
      aria-busy="true"
      aria-live="polite"
      className="mx-auto w-full max-w-7xl space-y-8 px-4 py-5 sm:px-6 sm:py-7 lg:px-8"
    >
      {/* Header */}
      <div className="overflow-hidden rounded-3xl border border-border/70 bg-card sm:rounded-[2rem]">
        <Skeleton className="h-28 w-full rounded-none sm:h-40 lg:h-48" />
        <div className="px-4 pb-5 sm:px-7 sm:pb-7">
          <div className="-mt-12 flex flex-col gap-4 sm:-mt-14 sm:flex-row sm:items-end sm:justify-between">
            <div className="grid grid-cols-[auto_minmax(0,1fr)] items-end gap-3 sm:gap-4">
              <Skeleton className="size-20 shrink-0 rounded-2xl sm:size-28 sm:rounded-3xl" />
              <div className="min-w-0 space-y-2 pb-1 sm:pb-2">
                <Skeleton className="h-6 w-40 sm:h-8 sm:w-56" />
                <Skeleton className="h-3.5 w-28 sm:w-36" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Collections */}
      <SectionSkeleton>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-6">
          <Skeleton className="h-56 rounded-3xl sm:col-span-2 lg:col-span-4" />
          <Skeleton className="h-56 rounded-3xl lg:col-span-2" />
          <Skeleton className="h-56 rounded-3xl lg:col-span-2" />
          <Skeleton className="hidden h-56 rounded-3xl sm:block lg:col-span-2" />
          <Skeleton className="hidden h-56 rounded-3xl lg:block lg:col-span-2" />
        </div>
      </SectionSkeleton>

      {/* Favorites */}
      <SectionSkeleton>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="space-y-2.5">
              <Skeleton className="aspect-2/3 w-full rounded-lg" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-3 w-3/5" />
            </div>
          ))}
        </div>
      </SectionSkeleton>

      {/* Ratings + reading rows */}
      {[0, 1].map((row) => (
        <SectionSkeleton key={row}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-28 rounded-2xl" />
            ))}
          </div>
        </SectionSkeleton>
      ))}
    </main>
  );
}

function SectionSkeleton({ children }: { children: React.ReactNode }) {
  return (
    <section className="space-y-4 sm:space-y-5">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-1.5 rounded-full sm:h-6" />
        <Skeleton className="h-6 w-36 sm:h-7 sm:w-48" />
      </div>
      {children}
    </section>
  );
}
