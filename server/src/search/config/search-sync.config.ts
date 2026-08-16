export const searchSyncConfig = {
  workerIntervalMs: 2000,
  leaseMs: 30000,
  workerBatchSize: 10,
  workerConcurrency: 5,
  leaseHeartbeatMs: 10000,
  retryBaseMs: 1000,
  maxAttempts: 8,
} as const;
