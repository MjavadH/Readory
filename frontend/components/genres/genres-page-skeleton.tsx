import { cn } from '@/lib/utils';

const FEATURED_GENRE_SKELETON_COUNT = 5;
const FEATURED_GENRE_SKELETON_KEYS = Array.from(
  { length: FEATURED_GENRE_SKELETON_COUNT },
  (_, i) => `featured-genre-skeleton-${i}`,
);

const GENRE_BOOK_SKELETON_COUNT = 6;
const GENRE_BOOK_SKELETON_KEYS = Array.from(
  { length: GENRE_BOOK_SKELETON_COUNT },
  (_, i) => `genre-book-skeleton-${i}`,
);

const GENRE_PILL_SKELETON_COUNT = 16;
const GENRE_PILL_SKELETON_KEYS = Array.from(
  { length: GENRE_PILL_SKELETON_COUNT },
  (_, i) => `genre-pill-skeleton-${i}`,
);

export function GenresPageSkeleton() {
  return (
    <div className="flex flex-col gap-10 sm:gap-12" aria-label="Loading genres..." role="status">
      <span className="sr-only">Loading genres page</span>

      {/* 5 featured genre skeletons */}
      {FEATURED_GENRE_SKELETON_KEYS.map((key) => (
        <div key={key} className="flex flex-col gap-3">
          {/* Genre heading */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-5 w-1 rounded-full bg-muted animate-pulse" />
              <div className="h-5 w-24 rounded-md bg-muted animate-pulse sm:w-32" />
            </div>
            <div className="h-4 w-14 rounded-md bg-muted animate-pulse" />
          </div>

          {/* Book row */}
          <div className="flex gap-3 overflow-hidden sm:gap-4">
            {GENRE_BOOK_SKELETON_KEYS.map((key) => (
              <div
                key={key}
                className={cn(
                  'shrink-0',
                  'w-[calc((100%-12px)/2.4)] sm:w-[calc((100%-48px)/3.5)] md:w-[calc((100%-60px)/4.5)] lg:w-[calc((100%-80px)/5.5)] xl:w-[calc((100%-100px)/6)]',
                )}
              >
                <div className="aspect-2/3 w-full animate-pulse rounded-lg bg-muted" />
                <div className="flex flex-col gap-1.5 px-0.5 pt-2.5">
                  <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-3/5 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-2/5 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* All genres skeleton */}
      <div className="mt-4 rounded-xl bg-card p-6 sm:p-8">
        <div className="mx-auto mb-6 flex flex-col items-center gap-2">
          <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
          <div className="h-6 w-40 animate-pulse rounded-md bg-muted" />
          <div className="h-4 w-56 animate-pulse rounded-md bg-muted" />
        </div>
        <div className="flex flex-wrap justify-center gap-2.5">
          {GENRE_PILL_SKELETON_KEYS.map((key) => (
            <div
              key={key}
              className="h-8 animate-pulse rounded-full bg-muted"
              style={{ width: `${60 + ((GENRE_PILL_SKELETON_KEYS.indexOf(key) * 17) % 40)}px` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
