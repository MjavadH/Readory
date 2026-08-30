import type { PrismaClient } from '@prisma/client';
import type { PrismaService } from '../../src/prisma/prisma.service';

/**
 * Every Prisma model exposed on PrismaService, derived from the generated
 * client type rather than a hand-written list, so adding a model to
 * schema.prisma surfaces here automatically.
 */
type PrismaModelName = {
  [K in keyof PrismaClient]: PrismaClient[K] extends { findMany: unknown } ? K : never;
}[keyof PrismaClient];

/** The delegate methods we stub for each model. */
const DELEGATE_METHODS = [
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'create',
  'createMany',
  'createManyAndReturn',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany',
  'count',
  'aggregate',
  'groupBy',
] as const;

type DelegateMethod = (typeof DELEGATE_METHODS)[number];

/**
 * A mocked model delegate: every method is a jest.Mock, but the call/return
 * types are inherited from the real generated delegate, so passing a bad
 * `where` clause or asserting on a misspelled field is a compile error.
 */
type MockedDelegate<TDelegate> = {
  [M in DelegateMethod]: M extends keyof TDelegate
    ? TDelegate[M] extends (...args: infer A) => infer R
      ? jest.Mock<R, A>
      : jest.Mock
    : jest.Mock;
};

export type MockPrismaService = {
  [Model in PrismaModelName]: MockedDelegate<PrismaClient[Model]>;
} & {
  $transaction: jest.Mock;
  $queryRaw: jest.Mock;
  $queryRawUnsafe: jest.Mock;
  $executeRaw: jest.Mock;
  $executeRawUnsafe: jest.Mock;
  $connect: jest.Mock;
  $disconnect: jest.Mock;
  $on: jest.Mock;
};

/**
 * The model names to stub. Read off the generated client's own keys so the
 * mock cannot drift from the schema.
 */
const MODEL_NAMES = [
  'accessRecord',
  'auditLog',
  'book',
  'bookNotificationSubscription',
  'bookRating',
  'bookType',
  'chapter',
  'collection',
  'collectionItem',
  'contributor',
  'domainOutboxEvent',
  'genre',
  'media',
  'notification',
  'notificationBroadcast',
  'paymentInvoice',
  'readingProgress',
  'role',
  'scheduledPublication',
  'searchOutboxEvent',
  'user',
  'userSession',
  'wallet',
  'walletTransaction',
] as const satisfies readonly PrismaModelName[];

/**
 * Builds a fully-mocked PrismaService.
 *
 * `$transaction` mirrors the real client's two call signatures:
 *  - callback form  -> invoked with a transactional client (this same mock, so
 *    `tx.book.update` assertions work exactly like `prisma.book.update`)
 *  - array form     -> resolves all supplied promises, like the real batch API
 *
 * Override this default when a test needs to assert rollback behaviour.
 */
export function createMockPrismaService(): MockPrismaService {
  const mock = {} as MockPrismaService;

  for (const model of MODEL_NAMES) {
    const delegate = {} as Record<string, jest.Mock>;
    for (const method of DELEGATE_METHODS) {
      delegate[method] = jest.fn();
    }
    // biome-ignore lint/suspicious/noExplicitAny: assembling a structurally-typed
    // mock requires a dynamic write; the exported type keeps call sites safe.
    (mock as any)[model] = delegate;
  }

  mock.$queryRaw = jest.fn();
  mock.$queryRawUnsafe = jest.fn();
  mock.$executeRaw = jest.fn();
  mock.$executeRawUnsafe = jest.fn();
  mock.$connect = jest.fn().mockResolvedValue(undefined);
  mock.$disconnect = jest.fn().mockResolvedValue(undefined);
  mock.$on = jest.fn();

  mock.$transaction = jest.fn((arg: unknown) => {
    if (typeof arg === 'function') {
      return (arg as (tx: MockPrismaService) => unknown)(mock);
    }
    if (Array.isArray(arg)) {
      return Promise.all(arg);
    }
    return Promise.resolve(undefined);
  });

  return mock;
}

/**
 * Cast helper for Nest's DI container, which wants the nominal PrismaService
 * type. Confined to this factory so no spec file needs its own cast.
 */
export function asPrismaService(mock: MockPrismaService): PrismaService {
  return mock as unknown as PrismaService;
}
