export interface CacheGetOrSetOptions {
  ttlSeconds: number;
  jitterSeconds?: number;
  earlyRefreshWindowSeconds?: number;
  skipCacheRead?: boolean;
}

export interface CacheObserveContext {
  operation: 'hit' | 'miss' | 'set' | 'invalidate' | 'error';
  key: string;
  elapsedMs: number;
  detail?: string;
}

export interface CacheEnvelope<T> {
  data: T;
  expiresAtMs: number;
}
