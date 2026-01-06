-- CreateEnum
CREATE TYPE "BookType" AS ENUM ('MANGA', 'MANHWA', 'COMIC', 'NOVEL', 'LIGHT_NOVEL');

-- AlterTable
ALTER TABLE "Book" ADD COLUMN     "type" "BookType" NOT NULL DEFAULT 'MANGA';
