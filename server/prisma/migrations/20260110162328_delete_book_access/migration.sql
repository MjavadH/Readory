/*
  Warnings:

  - You are about to drop the column `kind` on the `AccessRecord` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `Book` table. All the data in the column will be lost.
  - You are about to drop the `BookAccess` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "BookAccess" DROP CONSTRAINT "BookAccess_bookId_fkey";

-- DropForeignKey
ALTER TABLE "BookAccess" DROP CONSTRAINT "BookAccess_userId_fkey";

-- AlterTable
ALTER TABLE "AccessRecord" DROP COLUMN "kind";

-- AlterTable
ALTER TABLE "Book" DROP COLUMN "price";

-- DropTable
DROP TABLE "BookAccess";

-- DropEnum
DROP TYPE "AccessKind";
