-- AlterTable
ALTER TABLE "Book" ADD COLUMN     "overallScore" DECIMAL(8,4) NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Book_popularityScore_idx" ON "Book"("popularityScore");

-- CreateIndex
CREATE INDEX "Book_overallScore_idx" ON "Book"("overallScore");
