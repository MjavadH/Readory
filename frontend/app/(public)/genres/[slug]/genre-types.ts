import type { BookBrowserApi, BookGenre } from '@/lib/types';

/**
 * The /public/genres/[slug]/browse endpoint returns the usual paginated items,
 * plus the genre being browsed and the full genre list.
 */
export interface GenreBrowserApi extends BookBrowserApi {
  genre?: BookGenre;
  allGenres?: BookGenre[];
}
