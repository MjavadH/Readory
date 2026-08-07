-- AlterTable
ALTER TABLE "DomainOutboxEvent" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Notification" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "NotificationBroadcast" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "showFavorites" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "showMemberSince" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showRecentRatings" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "showRecentlyReading" BOOLEAN NOT NULL DEFAULT false;
