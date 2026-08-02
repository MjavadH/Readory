export const notificationConfig = {
  batchSize: Math.min(
    Math.max(Number(process.env.NOTIFICATION_BATCH_SIZE || 500), 1),
    5000,
  ),
  workerIntervalMs: Math.max(
    Number(process.env.NOTIFICATION_WORKER_INTERVAL_MS || 5000),
    1000,
  ),
  workerBatchSize: Math.min(
    Math.max(Number(process.env.NOTIFICATION_WORKER_BATCH_SIZE || 10), 1),
    100,
  ),
  workerConcurrency: Math.min(
    Math.max(Number(process.env.NOTIFICATION_WORKER_CONCURRENCY || 3), 1),
    20,
  ),
  leaseHeartbeatMs: Math.max(
    Number(process.env.NOTIFICATION_LEASE_HEARTBEAT_MS || 15000),
    5000,
  ),
  leaseMs: Math.max(Number(process.env.NOTIFICATION_LEASE_MS || 60000), 10000),
  maxAttempts: Math.min(
    Math.max(Number(process.env.NOTIFICATION_MAX_ATTEMPTS || 8), 1),
    20,
  ),
  retryBaseMs: Math.max(
    Number(process.env.NOTIFICATION_RETRY_BASE_MS || 30000),
    1000,
  ),
  retentionDays: Math.max(
    Number(process.env.NOTIFICATION_RETENTION_DAYS || 180),
    7,
  ),
  cleanupBatchSize: Math.min(
    Math.max(Number(process.env.NOTIFICATION_CLEANUP_BATCH_SIZE || 1000), 1),
    5000,
  ),
  broadcastMaxSelectedUsers: Math.min(
    Math.max(
      Number(process.env.NOTIFICATION_BROADCAST_MAX_SELECTED_USERS || 5000),
      1,
    ),
    50000,
  ),
};
