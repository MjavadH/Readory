import type { CacheManager } from '../../src/cache/cache.manager';

/**
 * Mocked CacheManager.
 *
 * The important detail is `getOrSet`: the real implementation calls the loader
 * on a cache miss and returns its value. A mock that resolved to `undefined`
 * would silently skip the loader, so every service test would assert against
 * data that was never actually produced. The default here therefore behaves
 * like a guaranteed cache miss and *invokes the loader*, which is both
 * realistic and keeps the service's own logic under test.
 *
 * Tests that specifically want a cache hit override `getOrSet` for that case.
 */
export type MockCacheManager = {
  getOrSet: jest.Mock;
  getString: jest.Mock<Promise<string | null>, [string]>;
  getDel: jest.Mock<Promise<string | null>, [string]>;
  setString: jest.Mock;
  del: jest.Mock<Promise<void>, [string]>;
  incr: jest.Mock<Promise<number>, [string]>;
  expire: jest.Mock;
  getVersion: jest.Mock<Promise<string>, [string]>;
  bumpVersion: jest.Mock<Promise<void>, [string]>;
  buildKey: jest.Mock<string, [string, ...Array<string | number | boolean>]>;
  buildHashedKey: jest.Mock<string, [string, unknown]>;
  sanitizeSegment: jest.Mock<string, [string | number | boolean]>;
};

export function createMockCacheManager(): MockCacheManager {
  return {
    // Cache-miss behaviour: run the loader and return its result.
    getOrSet: jest.fn(
      async <T>(_key: string, _options: unknown, loader: () => Promise<T>): Promise<T> => loader(),
    ),
    getString: jest.fn().mockResolvedValue(null),
    getDel: jest.fn().mockResolvedValue(null),
    setString: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(undefined),
    getVersion: jest.fn().mockResolvedValue('1'),
    bumpVersion: jest.fn().mockResolvedValue(undefined),
    // Mirror the real key-building semantics so assertions on cache keys are
    // meaningful instead of matching an opaque placeholder.
    buildKey: jest.fn((namespace, ...segments) => [namespace, ...segments].join(':')),
    buildHashedKey: jest.fn((namespace, payload) => `${namespace}:${JSON.stringify(payload)}`),
    sanitizeSegment: jest.fn((segment) => String(segment)),
  };
}

export function asCacheManager(mock: MockCacheManager): CacheManager {
  return mock as unknown as CacheManager;
}
