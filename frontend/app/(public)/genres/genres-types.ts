import type { IconKey } from '@readory/shared';
import type { BookType } from '@/lib/types';

export interface GenresPageBook {
  id: number;
  title: string;
  coverImage: string;
  contributors: string | null;
  type: BookType;
  ratingAvg: number | null;
  ratingCount: number;
  slug: string;
}

export interface ApiFeaturedGenre {
  id: number;
  name: string;
  slug: string;
  iconKey: IconKey;
  books: GenresPageBook[];
}

export interface GenresPageResponse {
  featured: ApiFeaturedGenre[];
  allGenres: Array<{ id: number; name: string; slug: string; iconKey: IconKey }>;
}
