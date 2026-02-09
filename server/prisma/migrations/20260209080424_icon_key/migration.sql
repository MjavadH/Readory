-- AlterTable
ALTER TABLE "BookType" ADD COLUMN     "iconKey" TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Genre" ADD COLUMN     "iconKey" TEXT;
