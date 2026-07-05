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
    contributors: string | null;
    coverImage: string | null;
    updatedAt: Date;
    chapterCount: number;
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

  const books = await prisma.book.findMany({
    where: { id: { in: bookIds } },
    select: {
      id: true,
      title: true,
      contributors: {
        select: {
          role: true,
          contributor: { select: { name: true } },
        },
      },
      coverImage: true,
      updatedAt: true,
      chapterCount: true,
      type: { select: { slug: true } },
    },
  });

  const byBookId = new Map<number, (typeof books)[number]>();
  for (const b of books) byBookId.set(b.id, b);

  const items: EnrichedLibraryItem[] = [];
  for (const g of groups) {
    const bookId = g.bookId as number;
    const book = byBookId.get(bookId);
    if (!book) continue;

    const purchasedChapters = g._count._all;
    const totalChapters = book.chapterCount;
    const purchasedPercent =
        totalChapters <= 0
            ? 0
            : Math.min(100, Math.round((purchasedChapters / totalChapters) * 100));

    const mainContributor = book.contributors.find((a) => a.role === 'AUTHOR') || book.contributors[0];

    items.push({
      book: {
        id: book.id,
        title: book.title,
        contributors: mainContributor ? mainContributor.contributor.name : null,
        coverImage: book.coverImage,
        updatedAt: book.updatedAt,
        chapterCount: book.chapterCount,
        type: book.type as EnrichedLibraryItem['book']['type'],
      },
      purchasedChapters,
      totalChapters,
      purchasedPercent,
      lastPurchasedAt: g._max.purchasedAt,
    });
  }
  return items;
}
