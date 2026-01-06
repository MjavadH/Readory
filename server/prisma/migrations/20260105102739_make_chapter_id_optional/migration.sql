-- DropForeignKey
ALTER TABLE "AccessRecord" DROP CONSTRAINT "AccessRecord_chapterId_fkey";

-- AlterTable
ALTER TABLE "AccessRecord" ALTER COLUMN "chapterId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "AccessRecord" ADD CONSTRAINT "AccessRecord_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
