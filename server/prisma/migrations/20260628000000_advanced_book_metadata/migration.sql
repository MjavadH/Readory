-- Safe additive migration for existing populated databases.
CREATE TYPE "BookStatus" AS ENUM ('UPCOMING', 'ONGOING', 'COMPLETED', 'HIATUS', 'CANCELLED');
CREATE TYPE "AgeRating" AS ENUM ('GENERAL', 'TEEN', 'MATURE', 'ADULT');

ALTER TABLE "Book"
  ADD COLUMN "originalTitle" TEXT,
  ADD COLUMN "alternativeTitles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "status" "BookStatus" NOT NULL DEFAULT 'UPCOMING',
  ADD COLUMN "publicationYear" INTEGER,
  ADD COLUMN "translators" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "lastContentUpdate" TIMESTAMP(3),
  ADD COLUMN "ageRating" "AgeRating",
  ADD COLUMN "chapterCount" INTEGER NOT NULL DEFAULT 0;

UPDATE "Book" b
SET "lastContentUpdate" = b."updatedAt",
    "chapterCount" = COALESCE(c."chapterCount", 0)
FROM (
  SELECT b2."id", COUNT(ch."id")::INTEGER AS "chapterCount"
  FROM "Book" b2
  LEFT JOIN "Chapter" ch ON ch."bookId" = b2."id"
  GROUP BY b2."id"
) c
WHERE b."id" = c."id";

CREATE INDEX "Book_lastContentUpdate_idx" ON "Book"("lastContentUpdate");
CREATE INDEX "Book_status_idx" ON "Book"("status");
CREATE INDEX "Book_publicationYear_idx" ON "Book"("publicationYear");
