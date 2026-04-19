-- DropForeignKey
ALTER TABLE "AccessRecord" DROP CONSTRAINT "AccessRecord_chapterId_fkey";

-- AddForeignKey
ALTER TABLE "AccessRecord" ADD CONSTRAINT "AccessRecord_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
