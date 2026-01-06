/*
  Warnings:

  - You are about to drop the column `originalName` on the `Media` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[filename]` on the table `Media` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[storageKey]` on the table `Media` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `storageKey` to the `Media` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Media" DROP COLUMN "originalName",
ADD COLUMN     "storageKey" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Media_filename_key" ON "Media"("filename");

-- CreateIndex
CREATE UNIQUE INDEX "Media_storageKey_key" ON "Media"("storageKey");
