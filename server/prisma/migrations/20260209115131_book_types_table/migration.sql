-- DropIndex
DROP INDEX "Book_typeId_idx";

-- AlterTable
ALTER TABLE "BookType" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "BookType_isActive_sortOrder_idx" ON "BookType"("isActive", "sortOrder");
