import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import {
  asCacheManager,
  asPrismaService,
  createMockCacheManager,
  createMockPrismaService,
  type MockCacheManager,
  type MockPrismaService,
} from '../../test/mocks';
import { CacheManager } from '../cache/cache.manager';
import { PrismaService } from '../prisma/prisma.service';
import { ContributorService } from './contributor.service';

const LIST_VERSION_KEY = 'contributor:list:version';
const CONTRIBUTOR_ID = 3;

describe('ContributorService', () => {
  let service: ContributorService;
  let prisma: MockPrismaService;
  let cacheManager: MockCacheManager;

  const contributor = (overrides: Record<string, unknown> = {}) => ({
    id: CONTRIBUTOR_ID,
    name: 'Ada Lovelace',
    originalName: 'Ada',
    slug: 'ada-lovelace',
    biography: 'Mathematician',
    gender: 'FEMALE',
    ...overrides,
  });

  beforeEach(async () => {
    prisma = createMockPrismaService();
    cacheManager = createMockCacheManager();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContributorService,
        { provide: PrismaService, useValue: asPrismaService(prisma) },
        { provide: CacheManager, useValue: asCacheManager(cacheManager) },
      ],
    }).compile();

    service = module.get(ContributorService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('persists the contributor and invalidates the list cache', async () => {
      // Arrange
      prisma.contributor.findUnique.mockResolvedValue(null);
      prisma.contributor.create.mockResolvedValue(contributor());

      // Act
      const result = await service.create({
        name: 'Ada Lovelace',
        originalName: 'Ada',
        slug: 'ada-lovelace',
        biography: 'Mathematician',
        gender: 'FEMALE',
      } as never);

      // Assert
      expect(prisma.contributor.create).toHaveBeenCalledWith({
        data: {
          name: 'Ada Lovelace',
          originalName: 'Ada',
          slug: 'ada-lovelace',
          biography: 'Mathematician',
          gender: 'FEMALE',
        },
      });
      // Cached list pages must be superseded after a write.
      expect(cacheManager.bumpVersion).toHaveBeenCalledWith(LIST_VERSION_KEY);
      expect(result).toEqual(contributor());
    });

    it('defaults gender to UNKNOWN when omitted', async () => {
      // Arrange
      prisma.contributor.findUnique.mockResolvedValue(null);
      prisma.contributor.create.mockResolvedValue(contributor());

      // Act
      await service.create({ name: 'X', slug: 'x' } as never);

      // Assert
      expect(prisma.contributor.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ gender: 'UNKNOWN' }),
      });
    });

    it('rejects a duplicate slug without writing or busting the cache', async () => {
      // Arrange
      prisma.contributor.findUnique.mockResolvedValue(contributor());

      // Act & Assert
      await expect(service.create({ name: 'Dup', slug: 'ada-lovelace' } as never)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.contributor.create).not.toHaveBeenCalled();
      expect(cacheManager.bumpVersion).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('returns a paginated payload with metadata', async () => {
      // Arrange
      prisma.contributor.findMany.mockResolvedValue([contributor()]);
      prisma.contributor.count.mockResolvedValue(45);

      // Act
      const result = await service.findAll({ page: 2, limit: 30 });

      // Assert
      expect(result).toEqual({
        data: [contributor()],
        meta: { total: 45, page: 2, lastPage: 2 },
      });
      expect(prisma.contributor.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 30, take: 30, orderBy: { createdAt: 'desc' } }),
      );
    });

    it('includes the list version in the cache key so writes invalidate reads', async () => {
      // Arrange
      cacheManager.getVersion.mockResolvedValue('7');
      prisma.contributor.findMany.mockResolvedValue([]);
      prisma.contributor.count.mockResolvedValue(0);

      // Act
      await service.findAll({ page: 1, limit: 30 });

      // Assert
      expect(cacheManager.getVersion).toHaveBeenCalledWith(LIST_VERSION_KEY);
      expect(cacheManager.buildKey).toHaveBeenCalledWith(
        'contributor',
        'list',
        '7',
        1,
        30,
        'all',
      );
    });

    it('applies a case-insensitive search across name and originalName', async () => {
      // Arrange
      prisma.contributor.findMany.mockResolvedValue([]);
      prisma.contributor.count.mockResolvedValue(0);

      // Act
      await service.findAll({ page: 1, limit: 30, q: '  Ada  ' });

      // Assert: the query is trimmed and matched against both name columns.
      expect(prisma.contributor.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { name: { contains: 'Ada', mode: 'insensitive' } },
              { originalName: { contains: 'Ada', mode: 'insensitive' } },
            ],
          },
        }),
      );
    });

    it('treats a whitespace-only query as no filter', async () => {
      // Arrange
      prisma.contributor.findMany.mockResolvedValue([]);
      prisma.contributor.count.mockResolvedValue(0);

      // Act
      await service.findAll({ page: 1, limit: 30, q: '   ' });

      // Assert
      expect(prisma.contributor.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });

    it('caps an overlong search query at 80 characters', async () => {
      // Arrange
      prisma.contributor.findMany.mockResolvedValue([]);
      prisma.contributor.count.mockResolvedValue(0);

      // Act
      await service.findAll({ page: 1, limit: 30, q: 'a'.repeat(200) });

      // Assert: guards against pathological LIKE patterns.
      const [[args]] = prisma.contributor.findMany.mock.calls;
      expect(args.where.OR[0].name.contains).toHaveLength(80);
    });

    it('clamps the limit to the 100 maximum', async () => {
      // Arrange
      prisma.contributor.findMany.mockResolvedValue([]);
      prisma.contributor.count.mockResolvedValue(0);

      // Act
      await service.findAll({ page: 1, limit: 5000 });

      // Assert
      expect(prisma.contributor.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });
  });

  describe('findOne', () => {
    it('returns the contributor from the detail cache key', async () => {
      // Arrange
      prisma.contributor.findUnique.mockResolvedValue(contributor());

      // Act
      const result = await service.findOne(CONTRIBUTOR_ID);

      // Assert
      expect(result).toEqual(contributor());
      expect(cacheManager.buildKey).toHaveBeenCalledWith('contributor', 'detail', CONTRIBUTOR_ID);
    });

    it('throws NotFoundException with the requested id', async () => {
      // Arrange
      prisma.contributor.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findOne(999)).rejects.toThrow(
        'No contributor with ID 999 was found.',
      );
    });
  });

  describe('update', () => {
    it('normalises a new slug to lowercase before persisting', async () => {
      // Arrange
      prisma.contributor.findUnique
        .mockResolvedValueOnce(contributor()) // findOne existence check
        .mockResolvedValueOnce(null); // slug availability check
      prisma.contributor.update.mockResolvedValue(contributor({ slug: 'new-slug' }));

      // Act
      await service.update(CONTRIBUTOR_ID, { slug: '  NEW-SLUG  ' } as never);

      // Assert
      expect(prisma.contributor.update).toHaveBeenCalledWith({
        where: { id: CONTRIBUTOR_ID },
        data: expect.objectContaining({ slug: 'new-slug' }),
      });
    });

    it('invalidates both the list version and the detail entry', async () => {
      // Arrange
      prisma.contributor.findUnique.mockResolvedValue(contributor());
      prisma.contributor.update.mockResolvedValue(contributor());

      // Act
      await service.update(CONTRIBUTOR_ID, { name: 'Renamed' } as never);

      // Assert
      expect(cacheManager.bumpVersion).toHaveBeenCalledWith(LIST_VERSION_KEY);
      expect(cacheManager.del).toHaveBeenCalledWith(`contributor:detail:${CONTRIBUTOR_ID}`);
    });

    it('rejects a slug already owned by a different contributor', async () => {
      // Arrange
      prisma.contributor.findUnique
        .mockResolvedValueOnce(contributor())
        .mockResolvedValueOnce(contributor({ id: 99, slug: 'taken' }));

      // Act & Assert
      await expect(service.update(CONTRIBUTOR_ID, { slug: 'taken' } as never)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.contributor.update).not.toHaveBeenCalled();
    });

    it('permits re-submitting the contributor’s own slug', async () => {
      // Arrange: the uniqueness check must exclude the record being updated.
      prisma.contributor.findUnique
        .mockResolvedValueOnce(contributor())
        .mockResolvedValueOnce(contributor({ id: CONTRIBUTOR_ID, slug: 'ada-lovelace' }));
      prisma.contributor.update.mockResolvedValue(contributor());

      // Act & Assert
      await expect(
        service.update(CONTRIBUTOR_ID, { slug: 'ada-lovelace' } as never),
      ).resolves.toEqual(contributor());
    });

    it('does not touch the slug column when no slug is supplied', async () => {
      // Arrange
      prisma.contributor.findUnique.mockResolvedValue(contributor());
      prisma.contributor.update.mockResolvedValue(contributor());

      // Act
      await service.update(CONTRIBUTOR_ID, { name: 'Renamed' } as never);

      // Assert
      const [[args]] = prisma.contributor.update.mock.calls;
      expect(args.data).not.toHaveProperty('slug');
    });

    it('propagates NotFoundException for an unknown contributor', async () => {
      // Arrange
      prisma.contributor.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.update(404, { name: 'X' } as never)).rejects.toThrow(NotFoundException);
      expect(prisma.contributor.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes the contributor and clears both cache scopes', async () => {
      // Arrange
      prisma.contributor.findUnique.mockResolvedValue(contributor());
      prisma.contributor.delete.mockResolvedValue(contributor());

      // Act
      const result = await service.remove(CONTRIBUTOR_ID);

      // Assert
      expect(prisma.contributor.delete).toHaveBeenCalledWith({ where: { id: CONTRIBUTOR_ID } });
      expect(cacheManager.bumpVersion).toHaveBeenCalledWith(LIST_VERSION_KEY);
      expect(cacheManager.del).toHaveBeenCalledWith(`contributor:detail:${CONTRIBUTOR_ID}`);
      expect(result).toEqual({ message: 'The contributor was successfully removed.' });
    });

    it('refuses to delete an unknown contributor', async () => {
      // Arrange
      prisma.contributor.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.remove(404)).rejects.toThrow(NotFoundException);
      expect(prisma.contributor.delete).not.toHaveBeenCalled();
    });
  });
});
