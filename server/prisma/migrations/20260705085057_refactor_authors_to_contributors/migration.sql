/*
  Warnings:

  - You are about to drop the column `translators` on the `Book` table. All the data in the column will be lost.
  - You are about to drop the `Author` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `BookAuthor` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "ContributorGender" AS ENUM ('MALE', 'FEMALE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ContributorRole" AS ENUM ('AUTHOR', 'TRANSLATOR', 'ILLUSTRATOR', 'EDITOR', 'CLEANER', 'TYPESETTER', 'RAW_PROVIDER', 'SUPERVISOR');

-- DropForeignKey
ALTER TABLE "BookAuthor" DROP CONSTRAINT "BookAuthor_authorId_fkey";

-- DropForeignKey
ALTER TABLE "BookAuthor" DROP CONSTRAINT "BookAuthor_bookId_fkey";

-- AlterTable
ALTER TABLE "Book" DROP COLUMN "translators";

-- DropTable
DROP TABLE "Author";

-- DropTable
DROP TABLE "BookAuthor";

-- DropEnum
DROP TYPE "AuthorGender";

-- DropEnum
DROP TYPE "AuthorRole";

-- CreateTable
CREATE TABLE "Contributor" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "originalName" TEXT,
    "slug" TEXT NOT NULL,
    "biography" TEXT,
    "gender" "ContributorGender" NOT NULL DEFAULT 'UNKNOWN',
    "bookCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contributor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookContributor" (
    "bookId" INTEGER NOT NULL,
    "contributorId" INTEGER NOT NULL,
    "role" "ContributorRole" NOT NULL DEFAULT 'AUTHOR',

    CONSTRAINT "BookContributor_pkey" PRIMARY KEY ("bookId","contributorId","role")
);

-- CreateIndex
CREATE UNIQUE INDEX "Contributor_slug_key" ON "Contributor"("slug");

-- CreateIndex
CREATE INDEX "BookContributor_contributorId_idx" ON "BookContributor"("contributorId");

-- CreateIndex
CREATE INDEX "BookContributor_bookId_idx" ON "BookContributor"("bookId");

-- AddForeignKey
ALTER TABLE "BookContributor" ADD CONSTRAINT "BookContributor_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookContributor" ADD CONSTRAINT "BookContributor_contributorId_fkey" FOREIGN KEY ("contributorId") REFERENCES "Contributor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
