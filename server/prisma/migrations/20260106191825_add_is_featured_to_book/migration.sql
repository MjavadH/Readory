-- DropIndex
DROP INDEX "Book_isPublished_idx";

-- AlterTable
ALTER TABLE "Book" ADD COLUMN     "isFeatured" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Book_isPublished_isFeatured_idx" ON "Book"("isPublished", "isFeatured");
