-- DropIndex
DROP INDEX "SearchOutboxEvent_status_availableAt_idx";

-- CreateIndex
CREATE INDEX "SearchOutboxEvent_status_availableAt_id_idx" ON "SearchOutboxEvent"("status", "availableAt", "id");

-- CreateIndex
CREATE INDEX "SearchOutboxEvent_status_lockedAt_idx" ON "SearchOutboxEvent"("status", "lockedAt");
