/*
  Warnings:

  - The `gender` column on the `Author` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "AuthorGender" AS ENUM ('MALE', 'FEMALE', 'UNKNOWN');

-- AlterTable
ALTER TABLE "Author" DROP COLUMN "gender",
ADD COLUMN     "gender" "AuthorGender" NOT NULL DEFAULT 'UNKNOWN';
