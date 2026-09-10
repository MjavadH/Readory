/**
 * Shared, strictly-typed test doubles for the external dependencies that the
 * unit directive requires to be isolated: Prisma ORM, Redis, BullMQ queues and
 * the cache layer.
 *
 * Import from `test/mocks` rather than re-declaring inline mocks in spec files
 * so a change to a dependency's surface is fixed in exactly one place.
 */

export {
  asCacheManager,
  createMockCacheManager,
  type MockCacheManager,
} from './cache.mock';
export { decimal } from './decimal.mock';
export {
  asPrismaService,
  createMockPrismaService,
  type MockPrismaService,
} from './prisma.mock';
export {
  foreignKeyError,
  knownRequestError,
  recordNotFoundError,
  uniqueConstraintError,
} from './prisma-errors.mock';
export {
  asPublicService,
  createMockPublicService,
  type MockPublicService,
} from './public.mock';
export { asQueue, createMockJob, createMockQueue, type MockQueue } from './queue.mock';
export { asRedis, createMockRedis, type MockRedis, type MockRedisPipeline } from './redis.mock';
export {
  asStorageService,
  createMockStorageService,
  type MockStorageService,
} from './storage.mock';
