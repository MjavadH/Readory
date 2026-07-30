import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CollectionType, CollectionVisibility, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CacheManager } from '../cache/cache.manager';
import { normalizeSlug, slugify, toNumber } from '../common';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';

@Injectable()
export class CollectionsService {
  constructor(
    private prisma: PrismaService,
    private readonly cacheManager: CacheManager,
  ) {}

  private readonly CACHE_KEY_SYSTEM_COLLECTIONS = 'collections:system';
  private readonly userCollectionLimit = Number(process.env.USER_COLLECTION_LIMIT || 25);
  private readonly userCollectionBookLimit = Number(process.env.USER_COLLECTION_BOOK_LIMIT || 100);

  async ensureFavoritesCollection(userId: number) {
    const slug = 'favorites';
    const existing = await this.prisma.collection.findFirst({ where: { ownerId: userId, type: CollectionType.FAVORITES } });
    if (existing) return existing;
    return this.prisma.collection.create({
      data: {
        ownerId: userId,
        type: CollectionType.FAVORITES,
        title: 'Favorites',
        slug,
        visibility: CollectionVisibility.PRIVATE,
        locked: true,
      },
    });
  }

  async listSystem() {
    const cached = await this.cacheManager.getString(this.CACHE_KEY_SYSTEM_COLLECTIONS);
    if (cached) return JSON.parse(cached);

    const rows = await this.prisma.collection.findMany({
      where: { type: CollectionType.SYSTEM, visibility: CollectionVisibility.PUBLIC },
      orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
      select: this.collectionSelect(4),
    });
    const result = rows.map((row) => this.serializeCollection(row));
    await this.cacheManager.setString(this.CACHE_KEY_SYSTEM_COLLECTIONS, JSON.stringify(result), 120);
    return result;
  }

  async getBySlug(slug: string, viewerId?: number) {
    const collection = await this.prisma.collection.findFirst({
      where: { slug: normalizeSlug(slug) || slug, type: CollectionType.SYSTEM },
      select: this.collectionSelect(100),
    });
    if (!collection) throw new NotFoundException('collection not found');
    this.assertCanView(collection, viewerId);
    return this.serializeCollection(collection);
  }

  async getUserCollection(username: string, slug: string, viewerId?: number) {
    const user = await this.prisma.user.findUnique({
      where: { username: username.toLowerCase() },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('collection not found');

    const collection = await this.prisma.collection.findFirst({
      where: { ownerId: user.id, slug: normalizeSlug(slug) || slug, type: { in: [CollectionType.USER, CollectionType.FAVORITES] } },
      select: this.collectionSelect(100),
    });
    if (!collection) throw new NotFoundException('collection not found');
    this.assertCanView(collection, viewerId);
    return this.serializeCollection(collection);
  }

  async createUserCollection(userId: number, dto: CreateCollectionDto) {
    const count = await this.prisma.collection.count({ where: { ownerId: userId, type: CollectionType.USER } });
    if (count >= this.userCollectionLimit) throw new BadRequestException('collection limit reached');
    return this.createCollection(CollectionType.USER, userId, dto);
  }

  async createSystemCollection(dto: CreateCollectionDto) {
    return this.createCollection(CollectionType.SYSTEM, null, { ...dto, visibility: CollectionVisibility.PUBLIC, allowIndexing: true });
  }

  async update(id: number, userId: number | null, isAdmin: boolean, dto: UpdateCollectionDto) {
    const existing = await this.prisma.collection.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('collection not found');
    this.assertCanManage(existing, userId, isAdmin);

    const data: Prisma.CollectionUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.visibility !== undefined) data.visibility = dto.visibility;
    if (dto.allowIndexing !== undefined && existing.type !== CollectionType.SYSTEM) data.allowIndexing = dto.allowIndexing;
    if (dto.featured !== undefined && existing.type === CollectionType.SYSTEM) data.featured = dto.featured;
    if (dto.slug !== undefined && existing.type !== CollectionType.FAVORITES) data.slug = await this.uniqueSlug(dto.slug, existing.ownerId ?? undefined, id);

    const updated = await this.prisma.collection.update({ where: { id }, data, select: this.collectionSelect(4) });
    await this.invalidateSystemCache(existing.type);
    return this.serializeCollection(updated);
  }

  async delete(id: number, userId: number, isAdmin: boolean) {
    const existing = await this.prisma.collection.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('collection not found');
    this.assertCanManage(existing, userId, isAdmin);
    if (existing.locked || existing.type === CollectionType.FAVORITES) throw new BadRequestException('collection is locked');
    await this.prisma.collection.delete({ where: { id } });
    await this.invalidateSystemCache(existing.type);
    return { id, deleted: true };
  }

  async addBook(id: number, userId: number, isAdmin: boolean, bookId: number, note?: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const collection = await tx.collection.findUnique({ where: { id } });
      if (!collection) throw new NotFoundException('collection not found');
      this.assertCanManage(collection, userId, isAdmin);
      const book = await tx.book.findUnique({ where: { id: bookId }, select: { id: true } });
      if (!book) throw new NotFoundException('book not found');
      if (collection.type === CollectionType.USER && collection.bookCount >= this.userCollectionBookLimit) throw new BadRequestException('book limit reached');
      await this.lockCollection(tx, id);
      const existing = await tx.collectionItem.findUnique({ where: { collectionId_bookId: { collectionId: id, bookId } } });
      if (existing) throw new BadRequestException('book already exists in collection');
      const position = await this.nextItemPosition(tx, id);
      const item = await tx.collectionItem.create({ data: { collectionId: id, bookId, note, position } });
      await tx.collection.update({ where: { id }, data: { bookCount: { increment: 1 } } });
      if (collection.type === CollectionType.FAVORITES) await tx.book.update({ where: { id: bookId }, data: { favoriteCount: { increment: 1 } } });
      return item;
    });
    await this.invalidateAfterItemChange(id);
    return result;
  }

  async updateItem(id: number, itemId: number, userId: number, isAdmin: boolean, note?: string) {
    const item = await this.prisma.collectionItem.findUnique({ where: { id: itemId }, include: { collection: true } });
    if (!item || item.collectionId !== id) throw new NotFoundException('collection item not found');
    this.assertCanManage(item.collection, userId, isAdmin);
    return this.prisma.collectionItem.update({
      where: { id: itemId },
      data: { note },
    });
  }

  async removeBook(id: number, itemId: number, userId: number, isAdmin: boolean) {
    await this.prisma.$transaction(async (tx) => {
      const item = await tx.collectionItem.findUnique({ where: { id: itemId }, include: { collection: true } });
      if (!item || item.collectionId !== id) throw new NotFoundException('collection item not found');
      this.assertCanManage(item.collection, userId, isAdmin);
      await tx.collectionItem.delete({ where: { id: itemId } });
      await tx.collection.update({ where: { id }, data: { bookCount: { decrement: 1 } } });
      if (item.collection.type === CollectionType.FAVORITES) await tx.book.update({ where: { id: item.bookId }, data: { favoriteCount: { decrement: 1 } } });
    });
    await this.invalidateAfterItemChange(id);
    return { id: itemId, deleted: true };
  }

  async reorder(id: number, userId: number, isAdmin: boolean, itemIds: number[]) {
    await this.prisma.$transaction(async (tx) => {
      const collection = await tx.collection.findUnique({ where: { id } });
      if (!collection) throw new NotFoundException('collection not found');
      this.assertCanManage(collection, userId, isAdmin);
      const existing = await tx.collectionItem.findMany({ where: { collectionId: id }, select: { id: true }, orderBy: { position: 'asc' } });
      const set = new Set(itemIds);
      if (set.size !== existing.length || existing.some((item) => !set.has(item.id))) throw new BadRequestException('itemIds must include every collection item');
      for (let i = 0; i < itemIds.length; i++) await tx.collectionItem.update({ where: { id: itemIds[i] }, data: { position: -(i + 1) } });
      for (let i = 0; i < itemIds.length; i++) await tx.collectionItem.update({ where: { id: itemIds[i] }, data: { position: i + 1 } });
    });
    await this.invalidateAfterItemChange(id);
    return { reordered: true };
  }

  private async createCollection(type: CollectionType, ownerId: number | null, dto: CreateCollectionDto) {
    const slug = await this.uniqueSlug(dto.slug || dto.title, ownerId ?? undefined);
    const collection = await this.prisma.collection.create({
      data: {
        ownerId,
        type,
        title: dto.title,
        slug,
        description: dto.description,
        visibility: type === CollectionType.SYSTEM ? CollectionVisibility.PUBLIC : dto.visibility ?? CollectionVisibility.PRIVATE,
        allowIndexing: type === CollectionType.SYSTEM ? true : dto.allowIndexing ?? false,
        featured: type === CollectionType.SYSTEM ? dto.featured ?? false : false,
      },
      select: this.collectionSelect(4),
    });
    await this.invalidateSystemCache(type);
    return this.serializeCollection(collection);
  }

  private async uniqueSlug(input: string, ownerId?: number, currentId?: number) {
    const base = normalizeSlug(input) || slugify(input) || 'collection';
    let slug = base;
    let index = 2;
    while (
      await this.prisma.collection.findFirst({
        where: { ownerId: ownerId ?? null, slug, NOT: currentId ? { id: currentId } : undefined },
        select: { id: true },
      })
    ) slug = `${base}-${index++}`;
    return slug;
  }

  private collectionSelect(itemTake: number) {
    return {
      id: true, ownerId: true, type: true, title: true, slug: true, description: true, visibility: true, allowIndexing: true, featured: true, locked: true, bookCount: true, createdAt: true, updatedAt: true,
      items: { orderBy: { position: 'asc' }, take: itemTake, select: { id: true, position: true, note: true, addedAt: true, book: { select: { id: true, title: true, coverImage: true, ratingAvg: true, ratingCount: true, updatedAt: true, type: { select: { id: true, name: true, slug: true, iconKey: true, isActive: true, sortOrder: true } }, contributors: { select: { role: true, contributor: { select: { name: true } } } } } } } },
    } satisfies Prisma.CollectionSelect;
  }

  private serializeCollection(collection: any) {
    return { ...collection, indexable: collection.type === CollectionType.SYSTEM || (collection.visibility === CollectionVisibility.PUBLIC && collection.allowIndexing), items: collection.items.map((item: any) => ({ ...item, book: this.serializeBook(item.book) })) };
  }

  private serializeBook(book: any) {
    const mainContributor = book.contributors.find((a: any) => a.role === 'AUTHOR') || book.contributors[0];
    return { id: book.id, title: book.title, contributors: mainContributor ? mainContributor.contributor.name : null, coverImage: book.coverImage, ratingAvg: Number(toNumber(book.ratingAvg).toFixed(2)), ratingCount: book.ratingCount, updatedAt: book.updatedAt.toISOString(), type: book.type };
  }

  private assertCanView(collection: any, viewerId?: number) {
    if (collection.visibility === CollectionVisibility.PUBLIC || collection.visibility === CollectionVisibility.UNLISTED) return;
    if (viewerId && collection.ownerId === viewerId) return;
    throw new NotFoundException('collection not found');
  }

  private assertCanManage(collection: any, userId: number | null, isAdmin: boolean) {
    if (collection.type === CollectionType.SYSTEM && isAdmin) return;
    if (collection.ownerId && userId === collection.ownerId) return;
    throw new ForbiddenException('not allowed');
  }

  private async lockCollection(tx: Prisma.TransactionClient, collectionId: number) {
    await tx.$queryRaw`SELECT id FROM "Collection" WHERE id = ${collectionId} FOR UPDATE`;
  }

  private async nextItemPosition(tx: Prisma.TransactionClient, collectionId: number) {
    const aggregate = await tx.collectionItem.aggregate({
      where: { collectionId },
      _max: { position: true },
    });
    return (aggregate._max.position ?? 0) + 1;
  }

  private async invalidateAfterItemChange(id: number) {
    const collection = await this.prisma.collection.findUnique({ where: { id }, select: { type: true } });
    await this.invalidateSystemCache(collection?.type);
  }

  private async invalidateSystemCache(type?: CollectionType) {
    if (type === CollectionType.SYSTEM) await this.cacheManager.del(this.CACHE_KEY_SYSTEM_COLLECTIONS);
  }
}
