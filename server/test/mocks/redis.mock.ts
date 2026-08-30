import type Redis from 'ioredis';
import type { ChainableCommander } from 'ioredis';

/**
 * Mocked ioredis pipeline. The real `pipeline()` is chainable and `exec()`
 * resolves to an array of `[error, result]` tuples — reader.service.ts depends
 * on that exact shape, so the mock reproduces it rather than returning bare
 * values.
 */
export type MockRedisPipeline = {
  zadd: jest.Mock;
  expire: jest.Mock;
  zremrangebyscore: jest.Mock;
  zcard: jest.Mock;
  exec: jest.Mock<Promise<Array<[Error | null, unknown]>>, []>;
};

export type MockRedis = {
  get: jest.Mock<Promise<string | null>, [string]>;
  getdel: jest.Mock<Promise<string | null>, [string]>;
  set: jest.Mock;
  del: jest.Mock<Promise<number>, string[]>;
  incr: jest.Mock<Promise<number>, [string]>;
  expire: jest.Mock;
  ttl: jest.Mock<Promise<number>, [string]>;
  pipeline: jest.Mock<MockRedisPipeline, []>;
  quit: jest.Mock;
  /** The pipeline instance returned by `pipeline()`, exposed for assertions. */
  __pipeline: MockRedisPipeline;
};

/**
 * Creates a mocked Redis client.
 *
 * Defaults model a *cache miss* (`get` -> null) and successful writes, which is
 * the common arrangement; tests override per case. `exec()` defaults to an
 * empty array so callers that destructure results fail loudly rather than
 * silently reading `undefined` from a half-configured mock.
 */
export function createMockRedis(): MockRedis {
  const pipeline: MockRedisPipeline = {
    zadd: jest.fn(),
    expire: jest.fn(),
    zremrangebyscore: jest.fn(),
    zcard: jest.fn(),
    exec: jest.fn().mockResolvedValue([]),
  };

  // Chainability: every queued command returns the pipeline itself.
  pipeline.zadd.mockReturnValue(pipeline);
  pipeline.expire.mockReturnValue(pipeline);
  pipeline.zremrangebyscore.mockReturnValue(pipeline);
  pipeline.zcard.mockReturnValue(pipeline);

  return {
    get: jest.fn().mockResolvedValue(null),
    getdel: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    ttl: jest.fn().mockResolvedValue(-1),
    pipeline: jest.fn().mockReturnValue(pipeline),
    quit: jest.fn().mockResolvedValue('OK'),
    __pipeline: pipeline,
  };
}

/** Cast helper for the `REDIS_CLIENT` DI token. */
export function asRedis(mock: MockRedis): Redis {
  return mock as unknown as Redis;
}

/** Cast helper when a test needs the pipeline as its nominal ioredis type. */
export function asChainableCommander(pipeline: MockRedisPipeline): ChainableCommander {
  return pipeline as unknown as ChainableCommander;
}
