-- CreateEnum
CREATE TYPE "ChapterContentStatus" AS ENUM ('EMPTY', 'PROCESSING', 'READY', 'FAILED');

-- AlterTable: add the new unified fields first (nullable / defaulted so
-- existing rows don't break), backfill them from the old fields, THEN drop
-- the old fields. Order matters — never drop before backfilling.
ALTER TABLE "Chapter" ADD COLUMN IF NOT EXISTS "contentStatus" "ChapterContentStatus" NOT NULL DEFAULT 'EMPTY';
ALTER TABLE "Chapter" ADD COLUMN IF NOT EXISTS "contentKey" TEXT;
ALTER TABLE "Chapter" ADD COLUMN IF NOT EXISTS "contentSourcePageCount" INTEGER;
ALTER TABLE "Chapter" ADD COLUMN IF NOT EXISTS "contentUploadedAt" TIMESTAMP(3);

-- Backfill contentStatus from existing state:
--   contentType set              -> READY (a processed chapter already exists)
--   contentType null + pdfKey/epubKey set -> PROCESSING (an upload was in flight)
--   otherwise                    -> EMPTY (the DEFAULT already covers this)
UPDATE "Chapter" SET "contentStatus" = 'READY' WHERE "contentType" IS NOT NULL;
UPDATE "Chapter" SET "contentStatus" = 'PROCESSING'
  WHERE "contentType" IS NULL AND ("pdfKey" IS NOT NULL OR "epubKey" IS NOT NULL);

-- Backfill the unified content-source fields from whichever of pdf/epub was set.
UPDATE "Chapter" SET "contentKey" = COALESCE("pdfKey", "epubKey") WHERE "pdfKey" IS NOT NULL OR "epubKey" IS NOT NULL;
UPDATE "Chapter" SET "contentSourcePageCount" = "pdfPageCount" WHERE "pdfPageCount" IS NOT NULL;
UPDATE "Chapter" SET "contentUploadedAt" = COALESCE("pdfUploadedAt", "epubUploadedAt")
  WHERE "pdfUploadedAt" IS NOT NULL OR "epubUploadedAt" IS NOT NULL;

-- AlterTable: drop the old pdf/epub-specific columns now that everything
-- of value has been carried over into the unified columns above.
ALTER TABLE "Chapter" DROP COLUMN IF EXISTS "pdfKey";
ALTER TABLE "Chapter" DROP COLUMN IF EXISTS "pdfPageCount";
ALTER TABLE "Chapter" DROP COLUMN IF EXISTS "pdfUploadedAt";
ALTER TABLE "Chapter" DROP COLUMN IF EXISTS "epubKey";
ALTER TABLE "Chapter" DROP COLUMN IF EXISTS "epubUploadedAt";
