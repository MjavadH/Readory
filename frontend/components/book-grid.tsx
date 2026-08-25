import { motion } from 'framer-motion';
import { BookCard, BookCardSkeleton } from '@/components/book-card';
import type { BookCardData } from '@/lib/types';
import { cn } from '@/lib/utils';

interface BookGridProps {
  books: BookCardData[];
  /** Number of initial images to load with priority */
  priorityCount?: number;
  className?: string;
}

export function BookGrid({ books, priorityCount = 4, className }: BookGridProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-x-3 gap-y-5',
        'sm:grid-cols-3',
        'md:grid-cols-3',
        'lg:grid-cols-6',
        'xl:grid-cols-6',
        className,
      )}
    >
      {books.map((book, index) => (
        <motion.div
          key={book.slug ?? book.id}
          layout
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
        >
          <BookCard key={book.slug ?? book.id} book={book} priority={index < priorityCount} />
        </motion.div>
      ))}
    </div>
  );
}

interface BookGridSkeletonProps {
  count?: number;
  className?: string;
}

export function BookGridSkeleton({ count = 12, className }: BookGridSkeletonProps) {
  const SKELETON_KEYS = Array.from({ length: count }, (_, i) => `skeleton-${i}`);
  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-x-3 gap-y-5',
        'sm:grid-cols-3',
        'md:grid-cols-3',
        'lg:grid-cols-6',
        'xl:grid-cols-6',
        className,
      )}
    >
      {SKELETON_KEYS.map((key) => (
        <BookCardSkeleton key={key} />
      ))}
    </div>
  );
}
