-- Scheduled publishing workflow with UTC publication times and retry metadata.
CREATE TYPE "ScheduledPublicationStatus" AS ENUM ('Pending', 'Processing', 'Published', 'Canceled', 'FAILED');
CREATE TYPE "ScheduledTargetType" AS ENUM ('BOOK', 'Chapter', 'BLOG_POST');

CREATE TABLE "ScheduledPublication" (
    "id" SERIAL NOT NULL,
    "targetType" "ScheduledTargetType" NOT NULL,
    "targetId" INTEGER NOT NULL,
    "publishAt" TIMESTAMP(3) NOT NULL,
    "status" "ScheduledPublicationStatus" NOT NULL DEFAULT 'Pending',
    "statusChangedAt" TIMESTAMP(3),
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "lastAttemptAt" TIMESTAMP(3),
    "error" TEXT,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ScheduledPublication_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ScheduledPublication_pending_target_key" ON "ScheduledPublication"("targetType", "targetId") WHERE "status" IN ('Pending', 'Processing');
CREATE INDEX "ScheduledPublication_due_idx" ON "ScheduledPublication"("status", "publishAt");
CREATE INDEX "ScheduledPublication_target_idx" ON "ScheduledPublication"("targetType", "targetId");

ALTER TABLE "Book" ADD COLUMN "publishStatus" TEXT NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "Chapter" ADD COLUMN "publishStatus" TEXT NOT NULL DEFAULT 'DRAFT';

UPDATE "Book" SET "publishStatus" = CASE WHEN "isPublished" = true THEN 'PUBLISHED' ELSE 'DRAFT' END;
UPDATE "Chapter" SET "publishStatus" = 'PUBLISHED' WHERE "contentPath" IS NOT NULL;

DROP INDEX IF EXISTS "Book_isPublished_isFeatured_idx";
DROP INDEX IF EXISTS "Book_isPublished_idx";
ALTER TABLE "Book" DROP COLUMN "isPublished";
CREATE INDEX "Book_publishStatus_isFeatured_idx" ON "Book"("publishStatus", "isFeatured");
