import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import {
  asCacheManager,
  asPrismaService,
  asPublicService,
  createMockCacheManager,
  createMockPrismaService,
  createMockPublicService,
  type MockCacheManager,
  type MockPrismaService,
  type MockPublicService,
  uniqueConstraintError,
} from '../../test/mocks';
import { CacheManager } from '../cache/cache.manager';
import { PrismaService } from '../prisma/prisma.service';
import { PublicService } from '../public/public.service';
import { GenresService } from './genres.service';

const CACHE_KEY_ALL = 'genres:all';
const CACHE_KEY_ALL_ADMIN = 'genres:all:admin';
const CACHE_KEY_FEATURED = 'genres:featured';
const CACHE_TTL_SECONDS = 7200;

describe('GenresService', () => {
  let service: GenresService;
  let prisma: MockPrismaService;
  let cache: MockCacheManager;
  let publicService: MockPublicService;

  beforeEach(async () => {
    prisma = createMockPrismaService();
    cache = createMockCacheManager();
    publicService = createMockPublicService();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        GenresService,
        { provide: PrismaService, useValue: asPrismaService(prisma) },
        { provide: CacheManager, useValue: asCacheManager(cache) },
        { provide: PublicService, useValue: asPublicService(publicService) },
      ],
    }).compile();

    service = moduleRef.get(GenresService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('listAll', () => {
    it('returns the parsed cached payload without querying the database', async () => {
      // Arrange
      const cached = [{ id: 1, name: 'Fantasy', slug: 'fantasy', iconKey: 'fantasy' }];
      cache.getString.mockResolvedValue(JSON.stringify(cached));

      // Act
      const result = await service.listAll();

      // Assert
      expect(result).toEqual(cached);
      expect(cache.getString).toHaveBeenCalledWith(CACHE_KEY_ALL);
      expect(prisma.genre.findMany).not.toHaveBeenCalled();
      expect(cache.setString).not.toHaveBeenCalled();
    });

    it('queries alphabetically and warms the cache on a miss', async () => {
      // Arrange
      const rows = [
        { id: 2, name: 'Action', slug: 'action', iconKey: 'action' },
        { id: 1, name: 'Fantasy', slug: 'fantasy', iconKey: null },
      ];
      cache.getString.mockResolvedValue(null);
      prisma.genre.findMany.mockResolvedValue(rows);

      // Act
      const result = await service.listAll();

      // Assert
      expect(result).toBe(rows);
      expect(prisma.genre.findMany).toHaveBeenCalledWith({
        orderBy: { name: 'asc' },
        select: { id: true, name: true, slug: true, iconKey: true },
      });
      expect(cache.setString).toHaveBeenCalledWith(
        CACHE_KEY_ALL,
        JSON.stringify(rows),
        CACHE_TTL_SECONDS,
      );
    });

    it('treats an empty cached string as a miss rather than an empty list', async () => {
      // Arrange — Redis returning '' must not be mistaken for a cached [].
      cache.getString.mockResolvedValue('');
      prisma.genre.findMany.mockResolvedValue([]);

      // Act
      const result = await service.listAll();

      // Assert
      expect(result).toEqual([]);
      expect(prisma.genre.findMany).toHaveBeenCalledTimes(1);
    });
  });

  describe('adminListAll', () => {
    it('includes the book count and uses the admin-scoped cache key', async () => {
      // Arrange
      const rows = [{ id: 1, name: 'Fantasy', slug: 'fantasy', _count: { books: 12 } }];
      cache.getString.mockResolvedValue(null);
      prisma.genre.findMany.mockResolvedValue(rows);

      // Act
      const result = await service.adminListAll();

      // Assert
      expect(result).toBe(rows);
      expect(cache.getString).toHaveBeenCalledWith(CACHE_KEY_ALL_ADMIN);
      expect(prisma.genre.findMany).toHaveBeenCalledWith({
        orderBy: { name: 'asc' },
        include: { _count: { select: { books: true } } },
      });
      expect(cache.setString).toHaveBeenCalledWith(
        CACHE_KEY_ALL_ADMIN,
        JSON.stringify(rows),
        CACHE_TTL_SECONDS,
      );
    });

    it('does not read the public cache key', async () => {
      // Arrange
      cache.getString.mockResolvedValue(JSON.stringify([]));

      // Act
      await service.adminListAll();

      // Assert — leaking the public payload into admin would hide book counts.
      expect(cache.getString).not.toHaveBeenCalledWith(CACHE_KEY_ALL);
    });
  });

  describe('listFeatured', () => {
    it('filters to featured genres ordered by featuredOrder then name', async () => {
      // Arrange
      const rows = [{ name: 'Fantasy', slug: 'fantasy', iconKey: 'fantasy' }];
      cache.getString.mockResolvedValue(null);
      prisma.genre.findMany.mockResolvedValue(rows);

      // Act
      const result = await service.listFeatured();

      // Assert
      expect(result).toBe(rows);
      expect(prisma.genre.findMany).toHaveBeenCalledWith({
        where: { isFeatured: true },
        orderBy: [{ featuredOrder: 'asc' }, { name: 'asc' }],
        select: { name: true, slug: true, iconKey: true },
      });
      expect(cache.setString).toHaveBeenCalledWith(
        CACHE_KEY_FEATURED,
        JSON.stringify(rows),
        CACHE_TTL_SECONDS,
      );
    });

    it('short-circuits on a cache hit', async () => {
      // Arrange
      cache.getString.mockResolvedValue('[{"name":"Horror","slug":"horror","iconKey":null}]');

      // Act
      const result = await service.listFeatured();

      // Assert
      expect(result).toEqual([{ name: 'Horror', slug: 'horror', iconKey: null }]);
      expect(prisma.genre.findMany).not.toHaveBeenCalled();
    });
  });

  describe('findBySlug', () => {
    it('projects the genre and keeps only published books', async () => {
      // Arrange
      const published = { id: 10, title: 'Published', publishStatus: 'PUBLISHED' };
      const draft = { id: 11, title: 'Draft', publishStatus: 'DRAFT' };
      const archived = { id: 12, title: 'Archived', publishStatus: 'ARCHIVED' };
      prisma.genre.findUnique.mockResolvedValue({
        id: 1,
        name: 'Fantasy',
        slug: 'fantasy',
        iconKey: 'fantasy',
        isFeatured: true,
        books: [{ book: published }, { book: draft }, { book: archived }],
      });

      // Act
      const result = await service.findBySlug('fantasy');

      // Assert
      expect(result).toEqual({
        id: 1,
        name: 'Fantasy',
        slug: 'fantasy',
        books: [published],
      });
      // The projection must not leak internal fields such as isFeatured.
      expect(result).not.toHaveProperty('isFeatured');
      expect(prisma.genre.findUnique).toHaveBeenCalledWith({
        where: { slug: 'fantasy' },
        include: { books: { include: { book: true } } },
      });
    });

    it('returns an empty book list when the genre has no published books', async () => {
      // Arrange
      prisma.genre.findUnique.mockResolvedValue({
        id: 3,
        name: 'Empty',
        slug: 'empty',
        books: [{ book: { id: 1, publishStatus: 'DRAFT' } }],
      });

      // Act
      const result = await service.findBySlug('empty');

      // Assert
      expect(result.books).toEqual([]);
    });

    it('throws NotFoundException for an unknown slug', async () => {
      // Arrange
      prisma.genre.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findBySlug('missing')).rejects.toThrow(
        new NotFoundException('Genre not found'),
      );
    });
  });

  describe('create', () => {
    it('slugifies the name, applies defaults and invalidates every cache', async () => {
      // Arrange
      prisma.genre.findUnique.mockResolvedValue(null);
      const created = { id: 5, name: 'Science Fiction', slug: 'science-fiction' };
      prisma.genre.create.mockResolvedValue(created);

      // Act
      const result = await service.create({ name: 'Science Fiction' });

      // Assert
      expect(result).toBe(created);
      expect(prisma.genre.create).toHaveBeenCalledWith({
        data: {
          name: 'Science Fiction',
          slug: 'science-fiction',
          iconKey: null,
          isFeatured: false,
          featuredOrder: 0,
        },
      });
      expect(cache.del).toHaveBeenCalledWith(CACHE_KEY_ALL);
      expect(cache.del).toHaveBeenCalledWith(CACHE_KEY_ALL_ADMIN);
      expect(cache.del).toHaveBeenCalledWith(CACHE_KEY_FEATURED);
      expect(publicService.clearHomeCache).toHaveBeenCalledTimes(1);
      expect(publicService.clearGenresPageCache).toHaveBeenCalledTimes(1);
    });

    it('prefers an explicitly supplied slug over the derived one', async () => {
      // Arrange
      prisma.genre.findUnique.mockResolvedValue(null);
      prisma.genre.create.mockResolvedValue({ id: 6 });

      // Act
      await service.create({ name: 'Science Fiction', slug: 'sci-fi' });

      // Assert
      expect(prisma.genre.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ slug: 'sci-fi' }) }),
      );
    });

    it('persists the supplied icon, featured flag and order verbatim', async () => {
      // Arrange
      prisma.genre.findUnique.mockResolvedValue(null);
      prisma.genre.create.mockResolvedValue({ id: 7 });

      // Act
      await service.create({
        name: 'Horror',
        iconKey: 'horror',
        isFeatured: true,
        featuredOrder: 3,
      });

      // Assert
      expect(prisma.genre.create).toHaveBeenCalledWith({
        data: {
          name: 'Horror',
          slug: 'horror',
          iconKey: 'horror',
          isFeatured: true,
          featuredOrder: 3,
        },
      });
    });

    it('suffixes the slug when the base is already taken', async () => {
      // Arrange — 'fantasy' taken, 'fantasy-2' taken, 'fantasy-3' free.
      prisma.genre.findUnique
        .mockResolvedValueOnce({ id: 1 })
        .mockResolvedValueOnce({ id: 2 })
        .mockResolvedValueOnce(null);
      prisma.genre.create.mockResolvedValue({ id: 8 });

      // Act
      await service.create({ name: 'Fantasy' });

      // Assert
      expect(prisma.genre.findUnique).toHaveBeenNthCalledWith(1, {
        where: { slug: 'fantasy' },
        select: { id: true },
      });
      expect(prisma.genre.findUnique).toHaveBeenNthCalledWith(2, {
        where: { slug: 'fantasy-2' },
        select: { id: true },
      });
      expect(prisma.genre.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ slug: 'fantasy-3' }) }),
      );
    });

    it('gives up with a ConflictException after exhausting slug attempts', async () => {
      // Arrange — every candidate collides.
      prisma.genre.findUnique.mockResolvedValue({ id: 99 });

      // Act & Assert
      await expect(service.create({ name: 'Fantasy' })).rejects.toThrow(
        new ConflictException('Unable to generate unique slug'),
      );
      expect(prisma.genre.create).not.toHaveBeenCalled();
    });

    it('translates a P2002 write race into a ConflictException', async () => {
      // Arrange — the pre-check passed but a concurrent insert won the race.
      prisma.genre.findUnique.mockResolvedValue(null);
      prisma.genre.create.mockRejectedValue(uniqueConstraintError(['name']));

      // Act & Assert
      await expect(service.create({ name: 'Fantasy' })).rejects.toThrow(
        new ConflictException('Genre already exists'),
      );
      expect(publicService.clearHomeCache).not.toHaveBeenCalled();
    });

    it('rethrows non-unique database errors untranslated', async () => {
      // Arrange
      prisma.genre.findUnique.mockResolvedValue(null);
      const failure = new Error('connection reset');
      prisma.genre.create.mockRejectedValue(failure);

      // Act & Assert
      await expect(service.create({ name: 'Fantasy' })).rejects.toBe(failure);
      expect(cache.del).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    const existing = { id: 4, name: 'Fantasy', slug: 'fantasy', iconKey: 'fantasy' };

    it('keeps the existing slug when neither name nor slug changes', async () => {
      // Arrange
      prisma.genre.findUnique.mockResolvedValue(existing);
      prisma.genre.update.mockResolvedValue({ ...existing, isFeatured: true });

      // Act
      await service.update(4, { isFeatured: true });

      // Assert — no slug uniqueness probe should be issued.
      expect(prisma.genre.findUnique).toHaveBeenCalledTimes(1);
      expect(prisma.genre.update).toHaveBeenCalledWith({
        where: { id: 4 },
        data: {
          name: undefined,
          slug: 'fantasy',
          iconKey: undefined,
          featuredOrder: undefined,
          isFeatured: true,
        },
      });
    });

    it('recomputes the slug when the name actually changes', async () => {
      // Arrange
      prisma.genre.findUnique.mockResolvedValueOnce(existing).mockResolvedValueOnce(null);
      prisma.genre.update.mockResolvedValue({ id: 4 });

      // Act
      await service.update(4, { name: 'Dark Fantasy' });

      // Assert
      expect(prisma.genre.findUnique).toHaveBeenNthCalledWith(2, {
        where: { slug: 'dark-fantasy' },
        select: { id: true },
      });
      expect(prisma.genre.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: 'Dark Fantasy', slug: 'dark-fantasy' }),
        }),
      );
    });

    it('does not recompute the slug when the name is submitted unchanged', async () => {
      // Arrange
      prisma.genre.findUnique.mockResolvedValue(existing);
      prisma.genre.update.mockResolvedValue({ id: 4 });

      // Act
      await service.update(4, { name: 'Fantasy' });

      // Assert
      expect(prisma.genre.findUnique).toHaveBeenCalledTimes(1);
      expect(prisma.genre.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ slug: 'fantasy' }) }),
      );
    });

    it('tolerates the uniqueness probe matching the row being updated', async () => {
      // Arrange — the slug is owned by this very genre, so it is not a conflict.
      prisma.genre.findUnique.mockResolvedValueOnce(existing).mockResolvedValueOnce({ id: 4 });
      prisma.genre.update.mockResolvedValue({ id: 4 });

      // Act
      await service.update(4, { slug: 'fantasy' });

      // Assert
      expect(prisma.genre.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ slug: 'fantasy' }) }),
      );
    });

    it('suffixes the slug when another genre already owns it', async () => {
      // Arrange
      prisma.genre.findUnique
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce({ id: 77 })
        .mockResolvedValueOnce(null);
      prisma.genre.update.mockResolvedValue({ id: 4 });

      // Act
      await service.update(4, { slug: 'horror' });

      // Assert
      expect(prisma.genre.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ slug: 'horror-2' }) }),
      );
    });

    it.each([
      ['clears the icon when explicitly null', null, null],
      ['sets a new icon', 'horror' as const, 'horror'],
    ])('%s', async (_label, iconKey, expected) => {
      // Arrange
      prisma.genre.findUnique.mockResolvedValue(existing);
      prisma.genre.update.mockResolvedValue({ id: 4 });

      // Act
      await service.update(4, { iconKey });

      // Assert — `null` must reach Prisma; only `undefined` means "leave alone".
      expect(prisma.genre.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ iconKey: expected }) }),
      );
    });

    it('invalidates all genre caches and both public caches on success', async () => {
      // Arrange
      prisma.genre.findUnique.mockResolvedValue(existing);
      prisma.genre.update.mockResolvedValue({ id: 4 });

      // Act
      await service.update(4, { featuredOrder: 2 });

      // Assert
      expect(cache.del.mock.calls.map(([key]) => key)).toEqual([
        CACHE_KEY_ALL,
        CACHE_KEY_ALL_ADMIN,
        CACHE_KEY_FEATURED,
      ]);
      expect(publicService.clearHomeCache).toHaveBeenCalledTimes(1);
      expect(publicService.clearGenresPageCache).toHaveBeenCalledTimes(1);
    });

    it('throws NotFoundException for an unknown id without writing', async () => {
      // Arrange
      prisma.genre.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.update(999, { name: 'Nope' })).rejects.toThrow(
        new NotFoundException('Genre not found'),
      );
      expect(prisma.genre.update).not.toHaveBeenCalled();
      expect(cache.del).not.toHaveBeenCalled();
    });

    it('translates a P2002 write race into a ConflictException', async () => {
      // Arrange
      prisma.genre.findUnique.mockResolvedValue(existing);
      prisma.genre.update.mockRejectedValue(uniqueConstraintError(['slug']));

      // Act & Assert
      await expect(service.update(4, { featuredOrder: 1 })).rejects.toThrow(
        new ConflictException('Genre name or slug already exists'),
      );
      expect(publicService.clearGenresPageCache).not.toHaveBeenCalled();
    });

    it('rethrows unrelated database errors', async () => {
      // Arrange
      prisma.genre.findUnique.mockResolvedValue(existing);
      const failure = new Error('deadlock detected');
      prisma.genre.update.mockRejectedValue(failure);

      // Act & Assert
      await expect(service.update(4, { featuredOrder: 1 })).rejects.toBe(failure);
    });
  });

  describe('delete', () => {
    it('deletes the genre, invalidates caches and reports the outcome', async () => {
      // Arrange
      prisma.genre.findUnique.mockResolvedValue({ id: 9, name: 'Obsolete', slug: 'obsolete' });
      prisma.genre.delete.mockResolvedValue({ id: 9 });

      // Act
      const result = await service.delete(9);

      // Assert
      expect(result).toEqual({ id: 9, deleted: true });
      expect(prisma.genre.delete).toHaveBeenCalledWith({ where: { id: 9 } });
      expect(cache.del).toHaveBeenCalledTimes(3);
      expect(publicService.clearHomeCache).toHaveBeenCalledTimes(1);
      expect(publicService.clearGenresPageCache).toHaveBeenCalledTimes(1);
    });

    it('throws NotFoundException without deleting when the genre is absent', async () => {
      // Arrange
      prisma.genre.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.delete(9)).rejects.toThrow(new NotFoundException('Genre not found'));
      expect(prisma.genre.delete).not.toHaveBeenCalled();
      expect(cache.del).not.toHaveBeenCalled();
    });

    it('does not invalidate caches when the delete itself fails', async () => {
      // Arrange
      prisma.genre.findUnique.mockResolvedValue({ id: 9 });
      const failure = new Error('foreign key violation');
      prisma.genre.delete.mockRejectedValue(failure);

      // Act & Assert
      await expect(service.delete(9)).rejects.toBe(failure);
      expect(cache.del).not.toHaveBeenCalled();
      expect(publicService.clearHomeCache).not.toHaveBeenCalled();
    });
  });
});
