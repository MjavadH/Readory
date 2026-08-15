/*
  Warnings:

  - You are about to drop the column `overallScore` on the `Book` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Book_overallScore_idx";

-- AlterTable
ALTER TABLE "Book" DROP COLUMN "overallScore",
ADD COLUMN     "trendScore" DECIMAL(8,4) NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "AccessRecord_bookId_purchasedAt_idx" ON "AccessRecord"("bookId", "purchasedAt");

-- CreateIndex
CREATE INDEX "Book_trendScore_idx" ON "Book"("trendScore");
