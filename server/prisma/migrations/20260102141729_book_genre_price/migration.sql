/*
  Warnings:

  - A unique constraint covering the columns `[userId,chapterId]` on the table `AccessRecord` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[bookId,index]` on the table `Chapter` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "AccessKind" AS ENUM ('BOOK', 'CHAPTER');

-- AlterTable
ALTER TABLE "AccessRecord" ADD COLUMN     "bookId" INTEGER,
ADD COLUMN     "kind" "AccessKind" NOT NULL DEFAULT 'CHAPTER';

-- AlterTable
ALTER TABLE "Book" ADD COLUMN     "price" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Genre" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Genre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookGenre" (
    "bookId" INTEGER NOT NULL,
    "genreId" INTEGER NOT NULL,

    CONSTRAINT "BookGenre_pkey" PRIMARY KEY ("bookId","genreId")
);

-- CreateTable
CREATE TABLE "BookAccess" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "bookId" INTEGER NOT NULL,
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Genre_name_key" ON "Genre"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Genre_slug_key" ON "Genre"("slug");

-- CreateIndex
CREATE INDEX "BookGenre_genreId_idx" ON "BookGenre"("genreId");

-- CreateIndex
CREATE INDEX "BookAccess_userId_purchasedAt_idx" ON "BookAccess"("userId", "purchasedAt");

-- CreateIndex
CREATE INDEX "BookAccess_bookId_idx" ON "BookAccess"("bookId");

-- CreateIndex
CREATE UNIQUE INDEX "BookAccess_userId_bookId_key" ON "BookAccess"("userId", "bookId");

-- CreateIndex
CREATE INDEX "AccessRecord_userId_purchasedAt_idx" ON "AccessRecord"("userId", "purchasedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AccessRecord_userId_chapterId_key" ON "AccessRecord"("userId", "chapterId");

-- CreateIndex
CREATE INDEX "Book_isPublished_idx" ON "Book"("isPublished");

-- CreateIndex
CREATE INDEX "Book_createdAt_idx" ON "Book"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Chapter_bookId_index_key" ON "Chapter"("bookId", "index");

-- AddForeignKey
ALTER TABLE "Book" ADD CONSTRAINT "Book_coverImage_fkey" FOREIGN KEY ("coverImage") REFERENCES "Media"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookGenre" ADD CONSTRAINT "BookGenre_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookGenre" ADD CONSTRAINT "BookGenre_genreId_fkey" FOREIGN KEY ("genreId") REFERENCES "Genre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessRecord" ADD CONSTRAINT "AccessRecord_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookAccess" ADD CONSTRAINT "BookAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookAccess" ADD CONSTRAINT "BookAccess_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;
