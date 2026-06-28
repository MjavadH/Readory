ALTER TABLE "Book"
  ADD COLUMN "originalTitle" TEXT,
  ADD COLUMN "alternativeTitles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'UPCOMING',
  ADD COLUMN "ageRating" TEXT,
  ADD COLUMN "publicationYear" INTEGER,
  ADD COLUMN "translators" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "lastContentUpdate" TIMESTAMP(3),
  ADD COLUMN "chapterCount" INTEGER NOT NULL DEFAULT 0;

UPDATE "Book" b
SET
  "lastContentUpdate" = b."updatedAt",
  "chapterCount" = COALESCE(c."chapterCount", 0)
FROM (
  SELECT "bookId", COUNT(*)::INTEGER AS "chapterCount"
  FROM "Chapter"
  GROUP BY "bookId"
) c
WHERE b."id" = c."bookId";

UPDATE "Book"
SET "lastContentUpdate" = "updatedAt"
WHERE "lastContentUpdate" IS NULL;

CREATE INDEX "Book_lastContentUpdate_idx" ON "Book"("lastContentUpdate");
