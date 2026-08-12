export const RATE_LIMITS = {
  auth: {
    loginEmail: { limit: 5, ttlSeconds: 15 * 60, lockSeconds: 30 * 60 },
    loginIp: { limit: 40, ttlSeconds: 15 * 60, lockSeconds: 30 * 60 },
    registerIp: { limit: 5, ttlSeconds: 60 * 60 },
    registerEmail: { limit: 3, ttlSeconds: 60 * 60 },
    verifyEmail: { limit: 10, ttlSeconds: 15 * 60 },
    forgotPassword: { limit: 5, ttlSeconds: 60 * 60 },
    resetPassword: { limit: 5, ttlSeconds: 15 * 60 },
  },
  payment: {
    cooldownSeconds: 30,
    hourly: { limit: 10, ttlSeconds: 60 * 60 },
    daily: { limit: 25, ttlSeconds: 24 * 60 * 60 },
    pending: { limit: 3, ttlSeconds: 60 * 60 },
  },
  userProfile: { limit: 6, ttlSeconds: 60 * 60 },
  writeAction: { limit: 30, ttlSeconds: 60 },
  upload: { limit: 20, ttlSeconds: 60 * 60 },
} as const;
