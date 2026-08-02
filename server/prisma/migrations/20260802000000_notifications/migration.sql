CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE "OutboxEventStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED', 'DEAD_LETTER');
CREATE TYPE "NotificationCategory" AS ENUM ('SYSTEM', 'CONTENT', 'MARKETING', 'ADMIN');
CREATE TYPE "NotificationAudienceType" AS ENUM ('USER', 'SELECTED_USERS', 'ALL_USERS');
CREATE TYPE "NotificationBroadcastStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'PARTIALLY_FAILED', 'FAILED');

CREATE TABLE "DomainOutboxEvent" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "eventType" TEXT NOT NULL,
  "eventVersion" INTEGER NOT NULL DEFAULT 1,
  "aggregateType" TEXT NOT NULL,
  "aggregateId" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "OutboxEventStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 8,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt" TIMESTAMP(3),
  "lockedBy" TEXT,
  "processedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DomainOutboxEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DomainOutboxEvent_status_availableAt_id_idx" ON "DomainOutboxEvent"("status", "availableAt", "id");
CREATE INDEX "DomainOutboxEvent_lockedAt_idx" ON "DomainOutboxEvent"("lockedAt");
CREATE INDEX "DomainOutboxEvent_eventType_aggregateId_idx" ON "DomainOutboxEvent"("eventType", "aggregateId");

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "recipientUserId" INTEGER NOT NULL,
  "type" TEXT NOT NULL,
  "category" "NotificationCategory" NOT NULL DEFAULT 'CONTENT',
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "metadata" JSONB,
  "actionUrl" TEXT,
  "sourceType" TEXT,
  "sourceId" TEXT,
  "deduplicationKey" TEXT NOT NULL,
  "readAt" TIMESTAMP(3),
  "dismissedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Notification_recipientUserId_deduplicationKey_key" ON "Notification"("recipientUserId", "deduplicationKey");
CREATE INDEX "Notification_recipientUserId_createdAt_id_idx" ON "Notification"("recipientUserId", "createdAt", "id");
CREATE INDEX "Notification_recipientUserId_readAt_createdAt_idx" ON "Notification"("recipientUserId", "readAt", "createdAt");
CREATE INDEX "Notification_expiresAt_idx" ON "Notification"("expiresAt");
CREATE INDEX "Notification_sourceType_sourceId_idx" ON "Notification"("sourceType", "sourceId");
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "BookNotificationSubscription" (
  "userId" INTEGER NOT NULL,
  "bookId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BookNotificationSubscription_pkey" PRIMARY KEY ("userId", "bookId")
);
CREATE INDEX "BookNotificationSubscription_bookId_userId_idx" ON "BookNotificationSubscription"("bookId", "userId");
ALTER TABLE "BookNotificationSubscription" ADD CONSTRAINT "BookNotificationSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookNotificationSubscription" ADD CONSTRAINT "BookNotificationSubscription_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "NotificationPreference" (
  "userId" INTEGER NOT NULL,
  "contentEnabled" BOOLEAN NOT NULL DEFAULT true,
  "marketingEnabled" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("userId")
);
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "NotificationBroadcast" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "actionUrl" TEXT,
  "metadata" JSONB,
  "audienceType" "NotificationAudienceType" NOT NULL,
  "targetUserIds" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  "idempotencyKey" TEXT,
  "status" "NotificationBroadcastStatus" NOT NULL DEFAULT 'PENDING',
  "totalRecipients" INTEGER NOT NULL DEFAULT 0,
  "processedRecipients" INTEGER NOT NULL DEFAULT 0,
  "failedRecipients" INTEGER NOT NULL DEFAULT 0,
  "cursorUserId" INTEGER,
  "expiresAt" TIMESTAMP(3),
  "createdById" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "lastError" TEXT,
  CONSTRAINT "NotificationBroadcast_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "NotificationBroadcast_idempotencyKey_key" ON "NotificationBroadcast"("idempotencyKey");
CREATE INDEX "NotificationBroadcast_status_createdAt_idx" ON "NotificationBroadcast"("status", "createdAt");
CREATE INDEX "NotificationBroadcast_createdById_createdAt_idx" ON "NotificationBroadcast"("createdById", "createdAt");
