import { PrismaService } from '../prisma/prisma.service.js';

export type LibraryGroup = {
  bookId: number | null;
  _count: { _all: number };
  _max: { purchasedAt: Date | null };
};

export type EnrichedLibraryItem = {
  book: {
    id: number;
    title: string;
    author: string | null;
    coverImage: string | null;
    updatedAt: Date;
    type: { slug: string } | null;
  };
  purchasedChapters: number;
  totalChapters: number;
  purchasedPercent: number;
  lastPurchasedAt: Date | null;
};

/**
 * Enriches access-record groups with book details and chapter counts.
 * Shared between getUserLibrary and getRecentLibrary in DashboardService.
 */
export async function enrichLibraryGroups(
  prisma: PrismaService,
  groups: LibraryGroup[],
): Promise<EnrichedLibraryItem[]> {
  const bookIds = groups
    .map((g) => g.bookId)
    .filter((id): id is number => typeof id === 'number');

  if (bookIds.length === 0) return [];

  const [books, chapterCounts] = await Promise.all([
    prisma.book.findMany({
      where: { id: { in: bookIds } },
      select: {
        id: true,
        title: true,
        author: true,
        coverImage: true,
        updatedAt: true,
        type: { select: { slug: true } },
      },
    }),
    prisma.chapter.groupBy({
      by: ['bookId'],
      where: { bookId: { in: bookIds } },
      _count: { _all: true },
    }),
  ]);

  const byBookId = new Map<number, (typeof books)[number]>();
  for (const b of books) byBookId.set(b.id, b);

  const chaptersByBookId = new Map<number, number>();
  for (const row of chapterCounts)
    chaptersByBookId.set(row.bookId, row._count._all);

  return groups
    .map((g) => {
      const bookId = g.bookId as number;
      const book = byBookId.get(bookId);
      if (!book) return null;

      const purchasedChapters = g._count._all;
      const totalChapters = chaptersByBookId.get(bookId) ?? 0;
      const purchasedPercent =
        totalChapters <= 0
          ? 0
          : Math.min(
              100,
              Math.round((purchasedChapters / totalChapters) * 100),
            );

      return {
        book: {
          id: book.id,
          title: book.title,
          author: book.author,
          coverImage: book.coverImage,
          updatedAt: book.updatedAt,
          type: book.type,
        },
        purchasedChapters,
        totalChapters,
        purchasedPercent,
        lastPurchasedAt: g._max.purchasedAt,
      };
    })
    .filter((item): item is EnrichedLibraryItem => item !== null);
}
