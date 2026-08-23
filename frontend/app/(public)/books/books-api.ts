import { apiClient } from '@/lib/api-client';
import type { BookBrowserApi, BookGenre, PublicBookType } from '@/lib/types';

export async function getInitialBooksData(
  searchParams: Record<string, string | string[] | undefined>,
) {
  const query = new URLSearchParams(
    Object.entries(searchParams).reduce(
      (acc, [key, value]) => {
        if (typeof value === 'string') acc[key] = value;
        return acc;
      },
      {} as Record<string, string>,
    ),
  ).toString();

  const [books, genres, types] = await Promise.all([
    apiClient.get<BookBrowserApi>(`/books/browse?${query}`),
    apiClient.get<BookGenre[]>('/genres/listAll'),
    apiClient.get<PublicBookType[]>('/public/book-types'),
  ]);

  return { books, genres, types };
}
