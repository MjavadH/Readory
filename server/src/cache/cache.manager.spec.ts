import { CacheManager } from './cache.manager';

describe('CacheManager', () => {
  it('collapses concurrent requests for the same key', async () => {
    const redis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      incr: jest.fn().mockResolvedValue(1),
    } as any;

    const manager = new CacheManager(redis);

    let loadCalls = 0;
    const loader = async () => {
      loadCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return { ok: true };
    };

    const [a, b, c] = await Promise.all([
      manager.getOrSet('k:test', { ttlSeconds: 20 }, loader),
      manager.getOrSet('k:test', { ttlSeconds: 20 }, loader),
      manager.getOrSet('k:test', { ttlSeconds: 20 }, loader),
    ]);

    expect(loadCalls).toBe(1);
    expect(a).toEqual({ ok: true });
    expect(b).toEqual({ ok: true });
    expect(c).toEqual({ ok: true });
  });
});
