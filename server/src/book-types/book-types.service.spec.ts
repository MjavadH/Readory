import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { PublicationStatus } from '@readory/shared';
import {
  asPrismaService,
  createMockPrismaService,
  type MockPrismaService,
  uniqueConstraintError,
} from '../../test/mocks';
import { PrismaService } from '../prisma/prisma.service';
import { BookTypesService } from './book-types.service';

const ADMIN_SELECT = {
  id: true,
  name: true,
  slug: true,
  iconKey: true,
  isActive: true,
  sortOrder: true,
} as const;

describe('BookTypesService', () => {
  let service: BookTypesService;
  let prisma: MockPrismaService;

  beforeEach(async () => {
    prisma = createMockPrismaService();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [BookTypesService, { provide: PrismaService, useValue: asPrismaService(prisma) }],
    }).compile();

    service = moduleRef.get(BookTypesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('listAdmin', () => {
    it('returns every type, active or not, ordered by sortOrder then name', async () => {
      // Arrange
      const types = [
        { id: 1, name: 'Manga', slug: 'manga', iconKey: null, isActive: true, sortOrder: 0 },
        { id: 2, name: 'Novel', slug: 'novel', iconKey: null, isActive: false, sortOrder: 1 },
      ];
      prisma.bookType.findMany.mockResolvedValue(types);

      // Act
      const result = await service.listAdmin();

      // Assert
      expect(result).toBe(types);
      expect(prisma.bookType.findMany).toHaveBeenCalledWith({
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: ADMIN_SELECT,
      });
      // Admins must see deactivated types, so no `where` filter may be applied.
      expect(prisma.bookType.findMany.mock.calls[0][0]).not.toHaveProperty('where');
    });
  });

  describe('listPublic', () => {
    it('filters to active types and omits admin-only fields', async () => {
      // Arrange
      const types = [{ name: 'Manga', slug: 'manga', iconKey: 'manga' }];
      prisma.bookType.findMany.mockResolvedValue(types);

      // Act
      const result = await service.listPublic();

      // Assert
      expect(result).toBe(types);
      expect(prisma.bookType.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: { name: true, slug: true, iconKey: true },
      });
      // `id` and `isActive` are internal; leaking them widens the public surface.
      const select = prisma.bookType.findMany.mock.calls[0][0]?.select;
      expect(select).not.toHaveProperty('id');
      expect(select).not.toHaveProperty('isActive');
    });
  });

  describe('findByType', () => {
    const bookWith = (contributors: Array<{ role: string; contributor: { name: string } }>) => ({
      id: 10,
      title: 'Test Book',
      coverImage: 'covers/10.webp',
      type: { id: 1, name: 'Manga', slug: 'manga' },
      contributors,
    });

    it('slugifies the supplied type before lookup', async () => {
      // Arrange
      prisma.bookType.findUnique.mockResolvedValue({ id: 1, slug: 'light-novel' });
      prisma.book.findMany.mockResolvedValue([]);

      // Act
      await service.findByType('Light Novel');

      // Assert
      expect(prisma.bookType.findUnique).toHaveBeenCalledWith({ where: { slug: 'light-novel' } });
    });

    it.each([
      ['whitespace only', '   '],
      ['punctuation only', '!!!'],
    ])('throws NotFoundException when %s slugifies to nothing', async (_label, input) => {
      // Act & Assert — must fail before touching the database.
      await expect(service.findByType(input)).rejects.toThrow(
        new NotFoundException('book type not found'),
      );
      expect(prisma.bookType.findUnique).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for an unknown type without querying books', async () => {
      // Arrange
      prisma.bookType.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findByType('manga')).rejects.toThrow(
        new NotFoundException('book type not found'),
      );
      expect(prisma.book.findMany).not.toHaveBeenCalled();
    });

    it('restricts books to the type and to PUBLISHED status', async () => {
      // Arrange
      prisma.bookType.findUnique.mockResolvedValue({ id: 7 });
      prisma.book.findMany.mockResolvedValue([]);

      // Act
      await service.findByType('manga');

      // Assert — an unpublished-book leak here would be a content-visibility bug.
      expect(prisma.book.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { typeId: 7, publishStatus: PublicationStatus.PUBLISHED },
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('prefers the AUTHOR contributor when several roles are present', async () => {
      // Arrange — AUTHOR is listed after TRANSLATOR to prove ordering is ignored.
      prisma.bookType.findUnique.mockResolvedValue({ id: 1 });
      prisma.book.findMany.mockResolvedValue([
        bookWith([
          { role: 'TRANSLATOR', contributor: { name: 'Tara Translator' } },
          { role: 'AUTHOR', contributor: { name: 'Ada Author' } },
        ]),
      ]);

      // Act
      const result = await service.findByType('manga');

      // Assert
      expect(result).toEqual([
        {
          id: 10,
          title: 'Test Book',
          coverImage: 'covers/10.webp',
          type: { id: 1, name: 'Manga', slug: 'manga' },
          contributors: 'Ada Author',
        },
      ]);
    });

    it('falls back to the first contributor when no AUTHOR exists', async () => {
      // Arrange
      prisma.bookType.findUnique.mockResolvedValue({ id: 1 });
      prisma.book.findMany.mockResolvedValue([
        bookWith([
          { role: 'ILLUSTRATOR', contributor: { name: 'Ivy Illustrator' } },
          { role: 'EDITOR', contributor: { name: 'Eli Editor' } },
        ]),
      ]);

      // Act
      const result = await service.findByType('manga');

      // Assert
      expect(result[0].contributors).toBe('Ivy Illustrator');
    });

    it('reports a null contributor when the book has none', async () => {
      // Arrange
      prisma.bookType.findUnique.mockResolvedValue({ id: 1 });
      prisma.book.findMany.mockResolvedValue([bookWith([])]);

      // Act
      const result = await service.findByType('manga');

      // Assert — must be null, not undefined or a crash.
      expect(result[0].contributors).toBeNull();
    });

    it('returns an empty list when the type has no published books', async () => {
      // Arrange
      prisma.bookType.findUnique.mockResolvedValue({ id: 1 });
      prisma.book.findMany.mockResolvedValue([]);

      // Act
      const result = await service.findByType('manga');

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('create', () => {
    it('derives the slug from the name and applies defaults', async () => {
      // Arrange
      const created = {
        id: 1,
        name: 'Light Novel',
        slug: 'light-novel',
        iconKey: null,
        isActive: true,
        sortOrder: 0,
      };
      prisma.bookType.create.mockResolvedValue(created);

      // Act
      const result = await service.create({ name: 'Light Novel' });

      // Assert — new types default to active so they are usable immediately.
      expect(result).toBe(created);
      expect(prisma.bookType.create).toHaveBeenCalledWith({
        data: {
          name: 'Light Novel',
          slug: 'light-novel',
          iconKey: null,
          isActive: true,
          sortOrder: 0,
        },
        select: ADMIN_SELECT,
      });
    });

    it('trims the name and prefers an explicit slug', async () => {
      // Arrange
      prisma.bookType.create.mockResolvedValue({ id: 1 });

      // Act
      await service.create({ name: '  Manga  ', slug: '  custom-slug  ' });

      // Assert
      expect(prisma.bookType.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: 'Manga', slug: 'custom-slug' }),
        }),
      );
    });

    it('falls back to the derived slug when the supplied slug is blank', async () => {
      // Arrange
      prisma.bookType.create.mockResolvedValue({ id: 1 });

      // Act
      await service.create({ name: 'Manga', slug: '   ' });

      // Assert
      expect(prisma.bookType.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ slug: 'manga' }) }),
      );
    });

    it('persists explicit icon, active flag and sort order', async () => {
      // Arrange
      prisma.bookType.create.mockResolvedValue({ id: 1 });

      // Act
      await service.create({
        name: 'Comic',
        iconKey: 'comic',
        isActive: false,
        sortOrder: 9,
      });

      // Assert — `isActive: false` must survive; a naive `?? true` inverts it.
      expect(prisma.bookType.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ iconKey: 'comic', isActive: false, sortOrder: 9 }),
        }),
      );
    });

    it.each([
      ['name is unsluggable and slug is empty', { name: '   ', slug: '' }],
      ['name is punctuation only', { name: '???' }],
    ])('rejects with BadRequestException when %s', async (_label, dto) => {
      // Act & Assert
      await expect(service.create(dto)).rejects.toThrow(
        new BadRequestException('slug is invalid'),
      );
      expect(prisma.bookType.create).not.toHaveBeenCalled();
    });

    it('translates a P2002 collision into BadRequestException', async () => {
      // Arrange
      prisma.bookType.create.mockRejectedValue(uniqueConstraintError(['slug']));

      // Act & Assert
      await expect(service.create({ name: 'Manga' })).rejects.toThrow(
        new BadRequestException('slug already exists'),
      );
    });

    it('rethrows unrelated database errors', async () => {
      // Arrange
      const failure = new Error('connection terminated');
      prisma.bookType.create.mockRejectedValue(failure);

      // Act & Assert
      await expect(service.create({ name: 'Manga' })).rejects.toBe(failure);
    });
  });

  describe('update', () => {
    it('throws NotFoundException without writing when the type is absent', async () => {
      // Arrange
      prisma.bookType.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.update(99, { name: 'New' })).rejects.toThrow(
        new NotFoundException('book type not found'),
      );
      expect(prisma.bookType.update).not.toHaveBeenCalled();
    });

    it('builds a sparse patch containing only supplied fields', async () => {
      // Arrange
      prisma.bookType.findUnique.mockResolvedValue({ id: 1 });
      const updated = { id: 1, name: 'Updated' };
      prisma.bookType.update.mockResolvedValue(updated);

      // Act
      const result = await service.update(1, { name: '  Updated  ' });

      // Assert — omitted fields must be absent, not `undefined`, so Prisma
      // never overwrites a column the caller did not mention.
      expect(result).toBe(updated);
      expect(prisma.bookType.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { name: 'Updated' },
        select: ADMIN_SELECT,
      });
      expect(Object.keys(prisma.bookType.update.mock.calls[0][0].data)).toEqual(['name']);
    });

    it.each([
      ['a falsy sortOrder of 0', { sortOrder: 0 }, { sortOrder: 0 }],
      ['a falsy isActive of false', { isActive: false }, { isActive: false }],
      ['an explicit null iconKey', { iconKey: null }, { iconKey: null }],
    ])('includes %s in the patch', async (_label, dto, expected) => {
      // Arrange
      prisma.bookType.findUnique.mockResolvedValue({ id: 1 });
      prisma.bookType.update.mockResolvedValue({ id: 1 });

      // Act
      await service.update(1, dto);

      // Assert — the guard is `!== undefined`, so falsy values must persist.
      expect(prisma.bookType.update.mock.calls[0][0].data).toEqual(expected);
    });

    it('applies every field when all are supplied, trimming strings', async () => {
      // Arrange
      prisma.bookType.findUnique.mockResolvedValue({ id: 1 });
      prisma.bookType.update.mockResolvedValue({ id: 1 });

      // Act
      await service.update(1, {
        name: ' A ',
        slug: ' a ',
        iconKey: 'action',
        isActive: false,
        sortOrder: 5,
      });

      // Assert
      expect(prisma.bookType.update.mock.calls[0][0].data).toEqual({
        name: 'A',
        slug: 'a',
        iconKey: 'action',
        isActive: false,
        sortOrder: 5,
      });
    });

    it('issues an empty patch when the dto carries no fields', async () => {
      // Arrange
      prisma.bookType.findUnique.mockResolvedValue({ id: 1 });
      prisma.bookType.update.mockResolvedValue({ id: 1 });

      // Act
      await service.update(1, {});

      // Assert
      expect(prisma.bookType.update.mock.calls[0][0].data).toEqual({});
    });

    it('translates a P2002 collision into BadRequestException', async () => {
      // Arrange
      prisma.bookType.findUnique.mockResolvedValue({ id: 1 });
      prisma.bookType.update.mockRejectedValue(uniqueConstraintError(['slug']));

      // Act & Assert
      await expect(service.update(1, { slug: 'dup' })).rejects.toThrow(
        new BadRequestException('slug already exists'),
      );
    });

    it('rethrows unrelated database errors', async () => {
      // Arrange
      prisma.bookType.findUnique.mockResolvedValue({ id: 1 });
      const failure = new Error('deadlock detected');
      prisma.bookType.update.mockRejectedValue(failure);

      // Act & Assert
      await expect(service.update(1, { name: 'X' })).rejects.toBe(failure);
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when the type is absent', async () => {
      // Arrange
      prisma.bookType.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.remove(99)).rejects.toThrow(
        new NotFoundException('book type not found'),
      );
      expect(prisma.book.count).not.toHaveBeenCalled();
      expect(prisma.bookType.delete).not.toHaveBeenCalled();
    });

    it('deactivates rather than deletes while books still reference the type', async () => {
      // Arrange
      prisma.bookType.findUnique.mockResolvedValue({ id: 1 });
      prisma.book.count.mockResolvedValue(3);
      prisma.bookType.update.mockResolvedValue({ id: 1 });

      // Act
      const result = await service.remove(1);

      // Assert — a hard delete here would orphan or cascade-destroy books.
      expect(result).toEqual({ id: 1, deleted: false, deactivated: true });
      expect(prisma.book.count).toHaveBeenCalledWith({ where: { typeId: 1 } });
      expect(prisma.bookType.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { isActive: false },
        select: { id: true },
      });
      expect(prisma.bookType.delete).not.toHaveBeenCalled();
    });

    it('hard deletes when no books reference the type', async () => {
      // Arrange
      prisma.bookType.findUnique.mockResolvedValue({ id: 1 });
      prisma.book.count.mockResolvedValue(0);
      prisma.bookType.delete.mockResolvedValue({ id: 1 });

      // Act
      const result = await service.remove(1);

      // Assert
      expect(result).toEqual({ id: 1, deleted: true, deactivated: false });
      expect(prisma.bookType.delete).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(prisma.bookType.update).not.toHaveBeenCalled();
    });

    it('propagates a failure from the deactivation write', async () => {
      // Arrange
      prisma.bookType.findUnique.mockResolvedValue({ id: 1 });
      prisma.book.count.mockResolvedValue(2);
      const failure = new Error('write failed');
      prisma.bookType.update.mockRejectedValue(failure);

      // Act & Assert — the caller must not receive a success report.
      await expect(service.remove(1)).rejects.toBe(failure);
    });
  });
});
