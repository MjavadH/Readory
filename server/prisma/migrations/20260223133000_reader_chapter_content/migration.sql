-- CreateEnum
CREATE TYPE "ChapterContentType" AS ENUM ('images', 'text');

-- AlterTable
ALTER TABLE "Chapter" ADD COLUMN "contentType" "ChapterContentType";
ALTER TABLE "Chapter" ADD COLUMN "pageCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Chapter" ADD COLUMN "contentVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ReadingProgress" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "bookId" INTEGER NOT NULL,
    "chapterId" INTEGER NOT NULL,
    "lastPage" INTEGER NOT NULL DEFAULT 1,
    "percent" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReadingProgress_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "ReadingProgress_userId_chapterId_key" ON "ReadingProgress"("userId", "chapterId");
CREATE INDEX "ReadingProgress_userId_bookId_idx" ON "ReadingProgress"("userId", "bookId");

-- AddForeignKey
ALTER TABLE "ReadingProgress" ADD CONSTRAINT "ReadingProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReadingProgress" ADD CONSTRAINT "ReadingProgress_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReadingProgress" ADD CONSTRAINT "ReadingProgress_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
