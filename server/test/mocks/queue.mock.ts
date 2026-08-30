import type { Job, Queue } from 'bullmq';

/**
 * Mocked BullMQ Queue covering the surface the application actually uses.
 * Kept deliberately narrow: stubbing the whole BullMQ API would hide the fact
 * that a service started depending on something new.
 */
export type MockQueue = {
  add: jest.Mock;
  addBulk: jest.Mock;
  getJob: jest.Mock;
  getJobs: jest.Mock;
  remove: jest.Mock;
  drain: jest.Mock;
  close: jest.Mock;
  getJobCounts: jest.Mock;
  getWaitingCount: jest.Mock;
  getActiveCount: jest.Mock;
};

export function createMockQueue(): MockQueue {
  return {
    // The real `add` resolves to the created Job; returning a minimal job with
    // an id lets services that log or return `job.id` behave realistically.
    add: jest.fn().mockImplementation((name: string) => Promise.resolve({ id: '1', name })),
    addBulk: jest.fn().mockResolvedValue([]),
    getJob: jest.fn().mockResolvedValue(null),
    getJobs: jest.fn().mockResolvedValue([]),
    remove: jest.fn().mockResolvedValue(1),
    drain: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    getJobCounts: jest.fn().mockResolvedValue({ waiting: 0, active: 0, failed: 0 }),
    getWaitingCount: jest.fn().mockResolvedValue(0),
    getActiveCount: jest.fn().mockResolvedValue(0),
  };
}

export function asQueue(mock: MockQueue): Queue {
  return mock as unknown as Queue;
}

/**
 * Builds a BullMQ Job for exercising processors directly.
 *
 * Processors receive a Job, so unit-testing them means constructing one. The
 * payload stays generically typed so each processor test keeps its own
 * job-data type checked.
 */
export function createMockJob<TData>(
  data: TData,
  overrides: Partial<{
    id: string;
    name: string;
    attemptsMade: number;
    updateProgress: jest.Mock;
    log: jest.Mock;
  }> = {},
): Job<TData> {
  return {
    id: overrides.id ?? '1',
    name: overrides.name ?? 'default',
    data,
    attemptsMade: overrides.attemptsMade ?? 0,
    updateProgress: overrides.updateProgress ?? jest.fn().mockResolvedValue(undefined),
    log: overrides.log ?? jest.fn().mockResolvedValue(0),
  } as unknown as Job<TData>;
}
