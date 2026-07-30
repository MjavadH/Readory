CREATE TYPE "CollectionType" AS ENUM ('SYSTEM', 'USER', 'FAVORITES');
CREATE TYPE "CollectionVisibility" AS ENUM ('PUBLIC', 'PRIVATE', 'UNLISTED');

CREATE TABLE "Collection" (
    "id" SERIAL NOT NULL,
    "ownerId" INTEGER,
    "type" "CollectionType" NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "visibility" "CollectionVisibility" NOT NULL DEFAULT 'PRIVATE',
    "allowIndexing" BOOLEAN NOT NULL DEFAULT false,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "bookCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CollectionItem" (
    "id" SERIAL NOT NULL,
    "collectionId" INTEGER NOT NULL,
    "bookId" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "note" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CollectionItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Collection_ownerId_slug_key" ON "Collection"("ownerId", "slug");
CREATE UNIQUE INDEX "Collection_ownerId_favorites_key" ON "Collection"("ownerId") WHERE "type" = 'FAVORITES';
CREATE INDEX "Collection_type_featured_createdAt_idx" ON "Collection"("type", "featured", "createdAt");
CREATE INDEX "Collection_ownerId_createdAt_idx" ON "Collection"("ownerId", "createdAt");
CREATE INDEX "Collection_visibility_allowIndexing_idx" ON "Collection"("visibility", "allowIndexing");
CREATE UNIQUE INDEX "CollectionItem_collectionId_bookId_key" ON "CollectionItem"("collectionId", "bookId");
CREATE UNIQUE INDEX "CollectionItem_collectionId_position_key" ON "CollectionItem"("collectionId", "position");
CREATE INDEX "CollectionItem_bookId_idx" ON "CollectionItem"("bookId");

ALTER TABLE "Collection" ADD CONSTRAINT "Collection_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "Collection" ("ownerId", "type", "title", "slug", "visibility", "locked", "bookCount", "createdAt", "updatedAt")
SELECT u."id", 'FAVORITES', 'Favorites', 'favorites', 'PRIVATE', true, COUNT(f."id"), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User" u
LEFT JOIN "FavoriteBook" f ON f."userId" = u."id"
GROUP BY u."id";

INSERT INTO "CollectionItem" ("collectionId", "bookId", "position", "addedAt")
SELECT c."id", f."bookId", ROW_NUMBER() OVER (PARTITION BY f."userId" ORDER BY f."createdAt" DESC, f."id" DESC), f."createdAt"
FROM "FavoriteBook" f
JOIN "Collection" c ON c."ownerId" = f."userId" AND c."type" = 'FAVORITES';

DROP TABLE "FavoriteBook";
