import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Collection, CollectionType, CollectionVisibility, Prisma } from '@prisma/client';
import { CacheManager } from '../cache/cache.manager';
import { PrismaService } from '../prisma/prisma.service';
import {
  CACHE_KEYS,
  CACHE_TTL_SECONDS,
  FAVORITES_SLUG,
  loadCollectionLimits,
  MY_COLLECTIONS_HARD_CAP,
  PAGINATION,
  USER_COLLECTIONS_LOCK_NAMESPACE,
} from './collections.constants';
import {
  CARD_SELECT,
  DETAIL_META_SELECT,
  detailSelect,
  MANAGE_SELECT,
  OWNED_CARD_SELECT,
} from './collections.selects';
import { toCard, toDetail, toMeta, toOwnedCard } from './collections.serializer';
import type {
  Actor,
  AddedItem,
  CollectionCard,
  CollectionDetail,
  CollectionMeta,
  CursorPage,
  MyCollectionCard,
  OwnedCollectionCard,
  UserCollectionDetail,
} from './collections.types';
import { blankToNull, clampLimit, isPrismaError, toPage, toSlug } from './collections.utils';
import { AddCollectionItemDto, UpdateCollectionItemDto } from './dto/collection-items.dto';
import { CursorPageQueryDto } from './dto/collection-query.dto';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { CreateSystemCollectionDto } from './dto/create-system-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';

type Db = Prisma.TransactionClient;

/** The minimum needed to decide which caches a change affects. */
type CacheScope = Pick<Collection, 'type' | 'ownerId' | 'visibility'>;

/** Row returned by `lockCollection` (raw SQL, so enums arrive as their string values). */
interface LockedCollection extends CacheScope {
  id: number;
  bookCount: number;
  maxPosition: number;
}

const NOT_FOUND = 'collection not found';
const FAVORITES_IMMUTABLE = 'favorites collection can only have books added or removed';

@Injectable()
export class CollectionsService {
  private readonly limits = loadCollectionLimits();

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheManager,
  ) {}

  async ensureFavoritesCollection(userId: number, db: Db = this.prisma): Promise<Collection> {
    const where = { ownerId: userId, type: CollectionType.FAVORITES } as const;

    const existing = await db.collection.findFirst({ where });
    if (existing) return existing;

    await db.collection.createMany({
      data: [
        {
          ownerId: userId,
          type: CollectionType.FAVORITES,
          title: 'Favorites',
          slug: FAVORITES_SLUG,
          visibility: CollectionVisibility.PRIVATE,
          locked: true,
        },
      ],
      skipDuplicates: true,
    });
    return db.collection.findFirstOrThrow({ where });
  }

  /** Public, viewer-independent and therefore cached. */
  async listSystem(query: CursorPageQueryDto): Promise<CursorPage<CollectionCard>> {
    const limit = clampLimit(query.limit, PAGINATION.list);
    const { cursor } = query;

    return this.cached(CACHE_KEYS.systemList, [cursor ?? 'first', limit], async () => {
      const rows = await this.prisma.collection.findMany({
        where: { type: CollectionType.SYSTEM, visibility: CollectionVisibility.PUBLIC },
        orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        take: limit + 1,
        select: CARD_SELECT,
      });
      return toPage(rows, limit, toCard);
    });
  }

  async listAdmin(query: CursorPageQueryDto): Promise<CursorPage<OwnedCollectionCard>> {
    const limit = clampLimit(query.limit, PAGINATION.list);
    const { cursor } = query;

    const rows = await this.prisma.collection.findMany({
      where: { type: CollectionType.SYSTEM },
      orderBy: [{ featured: 'desc' }, { updatedAt: 'desc' }, { id: 'desc' }],
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: limit + 1,
      select: OWNED_CARD_SELECT,
    });
    return toPage(rows, limit, toOwnedCard);
  }

  /**
   * A user owns a bounded number of collections, so this is one unpaginated query.
   * With `bookId`, a second lightweight query (ids only, run in parallel) tells the
   * "add to collection" dialog which collections already contain the book and
   * which item to delete to remove it.
   */
  async listMine(userId: number, bookId?: number): Promise<{ items: MyCollectionCard[] }> {
    const [rows, containing] = await Promise.all([
      this.prisma.collection.findMany({
        where: { ownerId: userId, type: CollectionType.USER },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        take: MY_COLLECTIONS_HARD_CAP,
        select: OWNED_CARD_SELECT,
      }),
      bookId === undefined
        ? Promise.resolve<Array<{ id: number; collectionId: number }>>([])
        : this.prisma.collectionItem.findMany({
            where: { bookId, collection: { ownerId: userId, type: CollectionType.USER } },
            select: { id: true, collectionId: true },
          }),
    ]);

    if (bookId === undefined) return { items: rows.map(toOwnedCard) };

    const itemByCollection = new Map(
      containing.map((item) => [item.collectionId, item.id] as const),
    );
    return {
      items: rows.map((row) => ({
        ...toOwnedCard(row),
        containsBook: itemByCollection.has(row.id),
        itemId: itemByCollection.get(row.id) ?? null,
      })),
    };
  }

  /**
   * Public system collection. PRIVATE ones are 404 here (admins preview them via
   * `getAdminById`), which makes the response viewer-independent and cacheable.
   */
  async getSystemBySlug(rawSlug: string, query: CursorPageQueryDto): Promise<CollectionDetail> {
    const slug = toSlug(rawSlug);
    const limit = clampLimit(query.limit, PAGINATION.items);
    const { cursor } = query;

    return this.cached(CACHE_KEYS.systemDetail, [slug, cursor ?? 'first', limit], async () => {
      const row = await this.prisma.collection.findFirst({
        where: {
          ownerId: null,
          slug,
          type: CollectionType.SYSTEM,
          visibility: { not: CollectionVisibility.PRIVATE },
        },
        select: detailSelect(cursor, limit + 1),
      });
      if (!row) throw new NotFoundException(NOT_FOUND);
      return toDetail(row, limit);
    });
  }

  async getAdminById(id: number, query: CursorPageQueryDto): Promise<CollectionDetail> {
    const limit = clampLimit(query.limit, PAGINATION.items);

    const row = await this.prisma.collection.findFirst({
      where: { id, type: CollectionType.SYSTEM },
      select: detailSelect(query.cursor, limit + 1),
    });
    if (!row) throw new NotFoundException(NOT_FOUND);
    return toDetail(row, limit);
  }

  async getUserCollection(
    username: string,
    rawSlug: string,
    viewerId: number | undefined,
    query: CursorPageQueryDto,
  ): Promise<UserCollectionDetail> {
    const limit = clampLimit(query.limit, PAGINATION.items);

    const visibleToViewer: Prisma.CollectionWhereInput = viewerId
      ? { OR: [{ visibility: { not: CollectionVisibility.PRIVATE } }, { ownerId: viewerId }] }
      : { visibility: { not: CollectionVisibility.PRIVATE } };

    const row = await this.prisma.collection.findFirst({
      where: {
        slug: toSlug(rawSlug),
        type: { in: [CollectionType.USER, CollectionType.FAVORITES] },
        owner: { username: username.toLowerCase() },
        ...visibleToViewer,
      },
      select: { ...detailSelect(query.cursor, limit + 1), ownerId: true },
    });
    if (!row) throw new NotFoundException(NOT_FOUND);

    return { ...toDetail(row, limit), isOwner: viewerId !== undefined && row.ownerId === viewerId };
  }

  async createUserCollection(userId: number, dto: CreateCollectionDto): Promise<CollectionMeta> {
    const created = await this.prisma.$transaction(async (tx) => {
      // Serialize creations per user so the limit cannot be exceeded by concurrent requests.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${USER_COLLECTIONS_LOCK_NAMESPACE}::int, ${userId}::int)`;

      const count = await tx.collection.count({
        where: { ownerId: userId, type: CollectionType.USER },
      });
      if (count >= this.limits.userCollections) {
        throw new BadRequestException('collection limit reached');
      }

      const slug = await this.resolveSlug(tx, userId, dto.slug);
      return tx.collection.create({
        data: {
          ownerId: userId,
          type: CollectionType.USER,
          title: dto.title,
          slug,
          description: blankToNull(dto.description),
          visibility: dto.visibility ?? CollectionVisibility.PRIVATE,
          allowIndexing: false, // user collections are never indexed
        },
        select: DETAIL_META_SELECT,
      });
    });

    await this.invalidate({
      type: CollectionType.USER,
      ownerId: userId,
      visibility: created.visibility,
    });
    return toMeta(created);
  }

  async createSystemCollection(dto: CreateSystemCollectionDto): Promise<CollectionMeta> {
    try {
      const slug = await this.resolveSlug(this.prisma, null, dto.slug);
      const created = await this.prisma.collection.create({
        data: {
          ownerId: null,
          type: CollectionType.SYSTEM,
          title: dto.title,
          slug,
          description: blankToNull(dto.description),
          visibility: dto.visibility ?? CollectionVisibility.PUBLIC,
          allowIndexing: true, // system collections are always indexed
          featured: dto.featured ?? false,
        },
        select: DETAIL_META_SELECT,
      });
      await this.invalidate({
        type: CollectionType.SYSTEM,
        ownerId: null,
        visibility: created.visibility,
      });
      return toMeta(created);
    } catch (error) {
      throw this.mapSlugError(error);
    }
  }

  async update(id: number, actor: Actor, dto: UpdateCollectionDto): Promise<CollectionMeta> {
    const existing = await this.findManageable(this.prisma, id, actor);
    if (existing.type === CollectionType.FAVORITES) {
      throw new ForbiddenException(FAVORITES_IMMUTABLE);
    }

    // Indexing is derived from the collection type and can never be set by the client.
    const data: Prisma.CollectionUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = blankToNull(dto.description);
    if (dto.visibility !== undefined) data.visibility = dto.visibility;
    if (dto.featured !== undefined && existing.type === CollectionType.SYSTEM) {
      data.featured = dto.featured;
    }

    try {
      if (dto.slug !== undefined && toSlug(dto.slug) !== existing.slug) {
        data.slug = await this.resolveSlug(this.prisma, existing.ownerId, dto.slug, id);
      }
      if (Object.keys(data).length === 0) return toMeta(existing); // nothing to write

      const updated = await this.prisma.collection.update({
        where: { id },
        data,
        select: DETAIL_META_SELECT,
      });
      await this.invalidate(
        { type: existing.type, ownerId: existing.ownerId, visibility: updated.visibility },
        existing.visibility,
      );
      return toMeta(updated);
    } catch (error) {
      throw this.mapSlugError(error);
    }
  }

  async delete(id: number, actor: Actor): Promise<{ id: number; deleted: true }> {
    const existing = await this.findManageable(this.prisma, id, actor);
    if (existing.locked || existing.type === CollectionType.FAVORITES) {
      throw new ForbiddenException('collection is locked');
    }

    await this.prisma.collection.delete({ where: { id } });
    await this.invalidate(existing);
    return { id, deleted: true };
  }

  /**
   * One row lock serves as permission read, limit check (against the locked, exact
   * count) and next-position source. Existence of the book and duplicates are
   * enforced by the FK / unique constraint instead of extra SELECTs.
   */
  async addBook(id: number, actor: Actor, dto: AddCollectionItemDto): Promise<AddedItem> {
    try {
      const { collection, item } = await this.prisma.$transaction(async (tx) => {
        const collection = await this.lockCollection(tx, id);
        this.assertCanManage(collection, actor);
        if (collection.bookCount >= this.limits.booksPerCollection[collection.type]) {
          throw new BadRequestException('book limit reached');
        }

        const isFavorites = collection.type === CollectionType.FAVORITES;
        const item = await tx.collectionItem.create({
          data: {
            collectionId: id,
            bookId: dto.bookId,
            position: collection.maxPosition + 1,
            note: isFavorites ? null : (blankToNull(dto.note) ?? null),
          },
          select: { id: true, note: true, addedAt: true },
        });
        await tx.collection.update({
          where: { id },
          data: { bookCount: { increment: 1 } },
          select: { id: true },
        });
        if (isFavorites) await this.adjustFavoriteCount(tx, dto.bookId, 1);

        return { collection, item };
      });

      await this.invalidate(collection);
      return {
        id: item.id,
        bookId: dto.bookId,
        note: item.note,
        addedAt: item.addedAt.toISOString(),
        bookCount: collection.bookCount + 1,
      };
    } catch (error) {
      throw this.mapItemError(error);
    }
  }

  async updateItem(
    id: number,
    itemId: number,
    actor: Actor,
    dto: UpdateCollectionItemDto,
  ): Promise<{ id: number; note: string | null }> {
    const collection = await this.findManageable(this.prisma, id, actor);
    if (collection.type === CollectionType.FAVORITES) {
      throw new ForbiddenException(FAVORITES_IMMUTABLE);
    }

    try {
      const item = await this.prisma.collectionItem.update({
        where: { id: itemId, collectionId: id },
        data: { note: blankToNull(dto.note) },
        select: { id: true, note: true },
      });
      await this.invalidate(collection);
      return item;
    } catch (error) {
      throw this.mapItemError(error);
    }
  }

  async removeBook(
    id: number,
    itemId: number,
    actor: Actor,
  ): Promise<{ id: number; deleted: true }> {
    try {
      const collection = await this.prisma.$transaction(async (tx) => {
        const collection = await this.findManageable(tx, id, actor);
        // `collectionId` in the filter guarantees the item belongs to this collection (P2025 otherwise).
        const removed = await tx.collectionItem.delete({
          where: { id: itemId, collectionId: id },
          select: { bookId: true },
        });
        await tx.collection.update({
          where: { id },
          data: { bookCount: { decrement: 1 } },
          select: { id: true },
        });
        if (collection.type === CollectionType.FAVORITES) {
          await this.adjustFavoriteCount(tx, removed.bookId, -1);
        }
        return collection;
      });

      await this.invalidate(collection);
      return { id: itemId, deleted: true };
    } catch (error) {
      throw this.mapItemError(error);
    }
  }

  /**
   * `itemIds` may be a subset (e.g. one page): they are redistributed, in the given
   * order, over the positions they already occupy. Two-phase update because the
   * (collectionId, position) unique constraint is checked row by row.
   */
  async reorder(id: number, actor: Actor, itemIds: number[]): Promise<{ reordered: true }> {
    const changed = await this.prisma.$transaction(async (tx) => {
      const collection = await this.lockCollection(tx, id);
      this.assertCanManage(collection, actor);
      if (collection.type === CollectionType.FAVORITES) {
        throw new ForbiddenException(FAVORITES_IMMUTABLE);
      }

      const existing = await tx.collectionItem.findMany({
        where: { collectionId: id, id: { in: itemIds } },
        select: { id: true, position: true },
        orderBy: { position: 'asc' },
      });
      if (existing.length !== itemIds.length) {
        throw new BadRequestException('Some items do not belong to this collection');
      }
      if (existing.every((item, index) => item.id === itemIds[index])) return null; // already in this order

      const positions = existing.map((item) => item.position);
      await tx.$executeRaw`
        UPDATE "CollectionItem" AS ci
        SET "position" = -r.new_pos
        FROM unnest(${itemIds}::int[], ${positions}::int[]) AS r(id, new_pos)
        WHERE ci."id" = r.id AND ci."collectionId" = ${id}
      `;
      await tx.$executeRaw`
        UPDATE "CollectionItem"
        SET "position" = -"position"
        WHERE "collectionId" = ${id} AND "position" < 0
      `;
      return collection;
    });

    if (changed) await this.invalidate(changed);
    return { reordered: true };
  }

  private async findManageable(db: Db, id: number, actor: Actor) {
    const collection = await db.collection.findUnique({ where: { id }, select: MANAGE_SELECT });
    if (!collection) throw new NotFoundException(NOT_FOUND);
    this.assertCanManage(collection, actor);
    return collection;
  }

  /** SYSTEM collections belong to admins, everything else to its owner. */
  private assertCanManage(collection: Pick<Collection, 'type' | 'ownerId'>, actor: Actor): void {
    const allowed =
      collection.type === CollectionType.SYSTEM
        ? actor.isAdmin
        : collection.ownerId !== null && collection.ownerId === actor.id;
    if (!allowed) throw new ForbiddenException('not allowed');
  }

  /** `SELECT … FOR UPDATE` that also returns everything the write paths need in one round trip. */
  private async lockCollection(tx: Db, id: number): Promise<LockedCollection> {
    const [row] = await tx.$queryRaw<LockedCollection[]>`
      SELECT c."id", c."type", c."ownerId", c."visibility", c."bookCount",
             COALESCE(
               (SELECT MAX(i."position") FROM "CollectionItem" i WHERE i."collectionId" = c."id"),
               0
             ) AS "maxPosition"
      FROM "Collection" c
      WHERE c."id" = ${id}
      FOR UPDATE OF c
    `;
    if (!row) throw new NotFoundException(NOT_FOUND);
    return row;
  }

  /**
   * Raw on purpose: `book.update()` would also bump `Book.updatedAt` (it is `@updatedAt`),
   * which touches an indexed column and pollutes "recently updated" on every favorite toggle.
   */
  private async adjustFavoriteCount(tx: Db, bookId: number, delta: 1 | -1): Promise<void> {
    await tx.$executeRaw`
      UPDATE "Book"
      SET "favoriteCount" = GREATEST("favoriteCount" + ${delta}::int, 0)
      WHERE "id" = ${bookId}
    `;
  }

  /**
   * One query to find taken slugs. System slugs are canonical URLs, so a clash is an
   * error; user slugs get a numeric suffix.
   */
  private async resolveSlug(
    db: Db,
    ownerId: number | null,
    desired: string,
    excludeId?: number,
  ): Promise<string> {
    const base = toSlug(desired);
    const taken = await db.collection.findMany({
      where: {
        ownerId,
        slug: { startsWith: base },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { slug: true },
    });
    const used = new Set(taken.map(({ slug }) => slug));
    if (!used.has(base)) return base;
    if (ownerId === null) throw new ConflictException('slug already in use');

    let index = 2;
    while (used.has(`${base}-${index}`)) index += 1;
    return `${base}-${index}`;
  }

  private mapSlugError(error: unknown): Error {
    if (isPrismaError(error, 'P2002')) return new ConflictException('slug already in use');
    return error instanceof Error ? error : new Error('unexpected error');
  }

  private mapItemError(error: unknown): Error {
    if (isPrismaError(error, 'P2002'))
      return new ConflictException('book already exists in collection');
    if (isPrismaError(error, 'P2003')) return new NotFoundException('book not found');
    if (isPrismaError(error, 'P2025')) return new NotFoundException('collection item not found');
    return error instanceof Error ? error : new Error('unexpected error');
  }

  // Cache

  /**
   * Only viewer-independent, public system data is cached. User and favorites
   * collections are never cached, so their (frequent) writes cost no invalidation.
   */
  private async cached<T>(
    namespace: string,
    parts: ReadonlyArray<string | number>,
    load: () => Promise<T>,
  ): Promise<T> {
    const version = await this.cache.getVersion(CACHE_KEYS.systemVersion);
    const key = this.cache.buildKey(namespace, version, ...parts);

    const hit = await this.cache.getString(key);
    if (hit) return JSON.parse(hit) as T;

    const value = await load();
    await this.cache.setString(key, JSON.stringify(value), CACHE_TTL_SECONDS);
    return value;
  }

  /**
   * Bumps only what a change can actually affect:
   * - system collections → the shared system list/detail version
   * - the owner's public profile → only when the collection is (or was) public, or is the favorites list
   */
  private async invalidate(
    scope: CacheScope,
    previousVisibility: CollectionVisibility = scope.visibility,
  ): Promise<void> {
    const tasks: Array<Promise<unknown>> = [];

    if (scope.type === CollectionType.SYSTEM) {
      tasks.push(this.cache.bumpVersion(CACHE_KEYS.systemVersion));
    }

    const profileVisible =
      scope.type === CollectionType.FAVORITES ||
      scope.visibility === CollectionVisibility.PUBLIC ||
      previousVisibility === CollectionVisibility.PUBLIC;
    if (scope.ownerId !== null && profileVisible) {
      tasks.push(this.cache.bumpVersion(CACHE_KEYS.publicProfileVersion(scope.ownerId)));
    }

    await Promise.all(tasks);
  }
}
