CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" TEXT,
    "actorName" TEXT,
    "actorRole" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "action" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "targetType" TEXT,
    "targetId" TEXT,
    "targetName" TEXT,
    "requestId" TEXT,
    "metadata" JSONB,
    "before" JSONB,
    "after" JSONB,
    "diff" JSONB,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX "AuditLog_targetType_idx" ON "AuditLog"("targetType");
CREATE INDEX "AuditLog_targetId_idx" ON "AuditLog"("targetId");
CREATE INDEX "AuditLog_category_idx" ON "AuditLog"("category");
CREATE INDEX "AuditLog_severity_idx" ON "AuditLog"("severity");
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");
