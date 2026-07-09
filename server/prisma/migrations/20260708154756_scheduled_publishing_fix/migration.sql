-- RenameIndex
ALTER INDEX "ScheduledPublication_due_idx" RENAME TO "ScheduledPublication_status_publishAt_idx";

-- RenameIndex
ALTER INDEX "ScheduledPublication_target_idx" RENAME TO "ScheduledPublication_targetType_targetId_idx";
