import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BookTypesService } from './book-types.service';
import { PrismaService } from '../prisma/prisma.service';

describe('BookTypesService', () => {
  let service: BookTypesService;
  let prisma: Record<string, any>;

  beforeEach(async () => {
    prisma = {
      bookType: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      book: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookTypesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<BookTypesService>(BookTypesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('listAdmin', () => {
    it('returns all book types ordered by sortOrder then name', async () => {
      const types = [
        { id: 1, name: 'Manga', slug: 'manga', iconKey: null, isActive: true, sortOrder: 0 },
        { id: 2, name: 'Novel', slug: 'novel', iconKey: null, isActive: false, sortOrder: 1 },
      ];
      prisma.bookType.findMany.mockResolvedValue(types);

      const result = await service.listAdmin();

      expect(result).toEqual(types);
      expect(prisma.bookType.findMany).toHaveBeenCalledWith({
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: { id: true, name: true, slug: true, iconKey: true, isActive: true, sortOrder: true },
      });
    });
  });

  describe('listPublic', () => {
    it('returns only active book types', async () => {
      const types = [{ name: 'Manga', slug: 'manga', iconKey: null }];
      prisma.bookType.findMany.mockResolvedValue(types);

      const result = await service.listPublic();

      expect(result).toEqual(types);
      expect(prisma.bookType.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: { name: true, slug: true, iconKey: true },
      });
    });
  });

  describe('findByType', () => {
    it('throws NotFoundException when slug is empty', async () => {
      await expect(service.findByType('   ')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when book type not found', async () => {
      prisma.bookType.findUnique.mockResolvedValue(null);
      await expect(service.findByType('manga')).rejects.toThrow(NotFoundException);
    });

    it('returns books for found book type', async () => {
      prisma.bookType.findUnique.mockResolvedValue({ id: 1 });
      const books = [{ id: 10, title: 'Test Book', coverImage: 'img.jpg', author: 'Author', type: { id: 1, name: 'Manga', slug: 'manga' } }];
      prisma.book.findMany.mockResolvedValue(books);

      const result = await service.findByType('Manga');

      expect(prisma.bookType.findUnique).toHaveBeenCalledWith({ where: { slug: 'manga' } });
      expect(result).toEqual(books);
    });
  });

  describe('create', () => {
    it('creates a book type with auto-generated slug', async () => {
      const created = { id: 1, name: 'Light Novel', slug: 'light-novel', iconKey: null, isActive: true, sortOrder: 0 };
      prisma.bookType.create.mockResolvedValue(created);

      const result = await service.create({ name: 'Light Novel' });

      expect(result).toEqual(created);
      expect(prisma.bookType.create).toHaveBeenCalledWith({
        data: { name: 'Light Novel', slug: 'light-novel', iconKey: null, isActive: true, sortOrder: 0 },
        select: { id: true, name: true, slug: true, iconKey: true, isActive: true, sortOrder: true },
      });
    });

    it('uses provided slug when given', async () => {
      prisma.bookType.create.mockResolvedValue({ id: 1 });
      await service.create({ name: 'Manga', slug: 'custom-slug' });
      expect(prisma.bookType.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ slug: 'custom-slug' }) }),
      );
    });

    it('throws BadRequestException for invalid slug', async () => {
      await expect(service.create({ name: '   ', slug: '' })).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException on duplicate slug (P2002)', async () => {
      prisma.bookType.create.mockRejectedValue({ code: 'P2002' });
      await expect(service.create({ name: 'Manga' })).rejects.toThrow(BadRequestException);
    });

    it('rethrows unexpected errors', async () => {
      prisma.bookType.create.mockRejectedValue(new Error('DB error'));
      await expect(service.create({ name: 'Manga' })).rejects.toThrow('DB error');
    });
  });

  describe('update', () => {
    it('throws NotFoundException when book type does not exist', async () => {
      prisma.bookType.findUnique.mockResolvedValue(null);
      await expect(service.update(99, { name: 'New' })).rejects.toThrow(NotFoundException);
    });

    it('updates only provided fields', async () => {
      prisma.bookType.findUnique.mockResolvedValue({ id: 1 });
      const updated = { id: 1, name: 'Updated', slug: 'manga', iconKey: null, isActive: true, sortOrder: 0 };
      prisma.bookType.update.mockResolvedValue(updated);

      const result = await service.update(1, { name: 'Updated' });

      expect(result).toEqual(updated);
      expect(prisma.bookType.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { name: 'Updated' },
        select: { id: true, name: true, slug: true, iconKey: true, isActive: true, sortOrder: true },
      });
    });

    it('updates all fields when all provided', async () => {
      prisma.bookType.findUnique.mockResolvedValue({ id: 1 });
      prisma.bookType.update.mockResolvedValue({ id: 1 });

      await service.update(1, { name: 'A', slug: 'a', iconKey: null, isActive: false, sortOrder: 5 });

      expect(prisma.bookType.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { name: 'A', slug: 'a', iconKey: null, isActive: false, sortOrder: 5 },
        }),
      );
    });

    it('throws BadRequestException on duplicate slug (P2002)', async () => {
      prisma.bookType.findUnique.mockResolvedValue({ id: 1 });
      prisma.bookType.update.mockRejectedValue({ code: 'P2002' });
      await expect(service.update(1, { slug: 'dup' })).rejects.toThrow(BadRequestException);
    });

    it('rethrows unexpected errors', async () => {
      prisma.bookType.findUnique.mockResolvedValue({ id: 1 });
      prisma.bookType.update.mockRejectedValue(new Error('DB error'));
      await expect(service.update(1, { name: 'X' })).rejects.toThrow('DB error');
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when book type does not exist', async () => {
      prisma.bookType.findUnique.mockResolvedValue(null);
      await expect(service.remove(99)).rejects.toThrow(NotFoundException);
    });

    it('deactivates instead of deleting when books exist', async () => {
      prisma.bookType.findUnique.mockResolvedValue({ id: 1 });
      prisma.book.count.mockResolvedValue(3);
      prisma.bookType.update.mockResolvedValue({ id: 1 });

      const result = await service.remove(1);

      expect(result).toEqual({ id: 1, deleted: false, deactivated: true });
      expect(prisma.bookType.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { isActive: false },
        select: { id: true },
      });
      expect(prisma.bookType.delete).not.toHaveBeenCalled();
    });

    it('hard deletes when no books exist', async () => {
      prisma.bookType.findUnique.mockResolvedValue({ id: 1 });
      prisma.book.count.mockResolvedValue(0);
      prisma.bookType.delete.mockResolvedValue(undefined);

      const result = await service.remove(1);

      expect(result).toEqual({ id: 1, deleted: true, deactivated: false });
      expect(prisma.bookType.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });
  });
});
