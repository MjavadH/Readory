/*
  Warnings:

  - Made the column `chapterId` on table `AccessRecord` required. This step will fail if there are existing NULL values in that column.
  - Made the column `bookId` on table `AccessRecord` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "AccessRecord" DROP CONSTRAINT "AccessRecord_bookId_fkey";

-- DropForeignKey
ALTER TABLE "AccessRecord" DROP CONSTRAINT "AccessRecord_chapterId_fkey";

-- AlterTable
ALTER TABLE "AccessRecord" ALTER COLUMN "chapterId" SET NOT NULL,
ALTER COLUMN "bookId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "AccessRecord_userId_bookId_idx" ON "AccessRecord"("userId", "bookId");

-- AddForeignKey
ALTER TABLE "AccessRecord" ADD CONSTRAINT "AccessRecord_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessRecord" ADD CONSTRAINT "AccessRecord_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
