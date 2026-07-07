import { generateAuditDiff } from './audit-diff.util';

describe('generateAuditDiff', () => {
  it('handles nested objects, arrays, nullable values, booleans, enums, and dates while ignoring timestamps', () => {
    const before = {
      title: 'Old Title',
      status: 'DRAFT',
      isPublished: false,
      deletedReason: null,
      updatedAt: '2026-01-01T00:00:00.000Z',
      genres: [{ id: 1, name: 'Fantasy' }],
      metadata: { publishedAt: null },
    };
    const after = {
      title: 'New Title',
      status: 'PUBLISHED',
      isPublished: true,
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
        'isPublished',
        'deletedReason',
        'genres',
        'metadata',
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
});
