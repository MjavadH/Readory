import { Logger } from '@nestjs/common';

/**
 * Global setup for the unit/integration suite.
 *
 * Goals:
 *  - Guarantee no state leaks between tests (the config already sets
 *    `clearMocks`/`restoreMocks`/`resetModules`; this adds timer + env hygiene).
 *  - Keep output readable by silencing NestJS's logger, which otherwise prints
 *    every expected error path under test as if it were a real failure.
 *  - Fail loudly on unhandled rejections instead of letting them be swallowed
 *    and reported against an unrelated later test.
 */

// Deterministic, timezone-independent date formatting across machines/CI.
process.env.TZ = 'UTC';
process.env.NODE_ENV = 'test';

// NestJS instantiates `new Logger()` inside services under test. Silencing the
// implementation (rather than the console) keeps assertions on logger calls
// possible while removing noise.
beforeAll(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'verbose').mockImplementation(() => undefined);
});

afterEach(() => {
  // Explicit per the isolation directive. `clearMocks: true` in the config
  // covers the same ground, but stating it here keeps the guarantee obvious
  // and survives future config edits.
  jest.clearAllMocks();

  // If a test installed fake timers, drop back to real ones so a later test
  // never inherits a frozen clock.
  if (jest.isMockFunction(setTimeout)) {
    jest.useRealTimers();
  }
});

const failOnUnhandledRejection = (reason: unknown) => {
  throw reason instanceof Error ? reason : new Error(`Unhandled rejection: ${String(reason)}`);
};

beforeAll(() => {
  process.on('unhandledRejection', failOnUnhandledRejection);
});

afterAll(() => {
  process.off('unhandledRejection', failOnUnhandledRejection);
});
