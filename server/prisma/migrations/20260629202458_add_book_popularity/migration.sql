-- AlterTable
ALTER TABLE "Book" ADD COLUMN     "favoriteCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "popularityScore" DECIMAL(8,4) NOT NULL DEFAULT 0;
