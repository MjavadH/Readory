/*
  Warnings:

  - The `publishStatus` column on the `Book` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `publishStatus` column on the `Chapter` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "PublicationStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED');

-- AlterTable
ALTER TABLE "Book" DROP COLUMN "publishStatus",
ADD COLUMN     "publishStatus" "PublicationStatus" NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "Chapter" DROP COLUMN "publishStatus",
ADD COLUMN     "publishStatus" "PublicationStatus" NOT NULL DEFAULT 'DRAFT';

-- CreateIndex
CREATE INDEX "Book_publishStatus_isFeatured_idx" ON "Book"("publishStatus", "isFeatured");
