import { PublicationStatus } from '@readory/shared';
import { generateAuditDiff } from './audit-diff.util';

describe('generateAuditDiff', () => {
  it('handles nested objects, arrays, nullable values, booleans, enums, and dates while ignoring timestamps', () => {
    const before = {
      title: 'Old Title',
      status: 'DRAFT',
      publishStatus: PublicationStatus.DRAFT,
      deletedReason: null,
      updatedAt: '2026-01-01T00:00:00.000Z',
      genres: [{ id: 1, name: 'Fantasy' }],
      metadata: { publishedAt: null },
    };
    const after = {
      title: 'New Title',
      status: 'PUBLISHED',
      publishStatus: PublicationStatus.PUBLISHED,
      deletedReason: 'duplicate',
      updatedAt: '2026-01-02T00:00:00.000Z',
      genres: [
        { id: 1, name: 'Fantasy' },
        { id: 2, name: 'Horror' },
      ],
      metadata: { publishedAt: new Date('2026-02-01T00:00:00.000Z') },
    };

    const diff = generateAuditDiff(before, after);
    const paths = diff.map((entry) => entry.path);

    expect(paths).toEqual(
      expect.arrayContaining([
        'title',
        'status',
        'publishStatus',
        'deletedReason',
        'genres',
        'metadata.publishedAt',
      ]),
    );
    expect(paths).not.toContain('updatedAt');
    expect(diff.find((entry) => entry.path === 'genres')?.children).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'added',
          after: { id: 2, name: 'Horror' },
        }),
      ]),
    );
  });

  it('shows array additions and removals instead of replacing the whole array', () => {
    const diff = generateAuditDiff(['Fantasy', 'Sci-Fi'], ['Fantasy', 'Adventure']);

    expect(diff).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'removed', before: 'Sci-Fi' }),
        expect.objectContaining({ type: 'added', after: 'Adventure' }),
      ]),
    );
  });

  it('only shows modified nested object fields', () => {
    const diff = generateAuditDiff(
      { metadata: { title: 'Same', flags: { featured: false } } },
      { metadata: { title: 'Same', flags: { featured: true } } },
    );

    expect(diff).toEqual([
      expect.objectContaining({
        path: 'metadata.flags.featured',
        before: false,
        after: true,
      }),
    ]);
  });
});
