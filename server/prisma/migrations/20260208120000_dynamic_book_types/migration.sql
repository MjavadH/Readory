-- Rename old enum temporarily to avoid name conflict
ALTER TYPE "BookType" RENAME TO "BookType_old";

-- Create BookType table
CREATE TABLE "BookType" (
    "id" SERIAL PRIMARY KEY,
    "name" TEXT NOT NULL UNIQUE,
    "slug" TEXT NOT NULL UNIQUE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed initial types from enum values
INSERT INTO "BookType" ("name", "slug") VALUES
  ('Manga', 'manga'),
  ('Manhwa', 'manhwa'),
  ('Comic', 'comic'),
  ('Novel', 'novel'),
  ('Light Novel', 'light-novel');

-- Add typeId to Book and backfill
ALTER TABLE "Book" ADD COLUMN "typeId" INTEGER;

UPDATE "Book"
SET "typeId" = bt."id"
FROM "BookType" bt
WHERE bt."slug" = lower(replace("Book"."type"::text, '_', '-'));

-- Enforce not-null after backfill
ALTER TABLE "Book" ALTER COLUMN "typeId" SET NOT NULL;

-- Add foreign key
ALTER TABLE "Book"
ADD CONSTRAINT "Book_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "BookType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Book_typeId_idx" ON "Book"("typeId");

-- Drop old enum column and type
ALTER TABLE "Book" DROP COLUMN "type";
DROP TYPE "BookType_old";
