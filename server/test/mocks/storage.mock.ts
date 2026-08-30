import type { StorageService } from '../../src/storage/storage.service';

/**
 * Mocked StorageService (S3-compatible object storage).
 *
 * Stubbed at the service boundary rather than at the AWS SDK client, so tests
 * of consumers (avatars, chapter content, media) never touch the network and
 * never depend on S3 command-object internals.
 */
export type MockStorageService = {
  putObject: jest.Mock;
  putJson: jest.Mock<Promise<void>, [string, unknown]>;
  putBuffer: jest.Mock<Promise<void>, [string, Buffer, string]>;
  getObjectBuffer: jest.Mock<Promise<Buffer>, [string]>;
  getObjectStream: jest.Mock;
  headObject: jest.Mock;
  listPrefix: jest.Mock<Promise<string[]>, [string]>;
  deletePrefix: jest.Mock<Promise<number>, [string]>;
  deleteKeys: jest.Mock<Promise<number>, [string[]]>;
  getPublicUrl: jest.Mock<string, [string]>;
  getBucketName: jest.Mock<string, []>;
};

const TEST_BUCKET = 'test-bucket';

export function createMockStorageService(): MockStorageService {
  return {
    putObject: jest.fn().mockResolvedValue(undefined),
    putJson: jest.fn().mockResolvedValue(undefined),
    putBuffer: jest.fn().mockResolvedValue(undefined),
    getObjectBuffer: jest.fn().mockResolvedValue(Buffer.alloc(0)),
    getObjectStream: jest.fn(),
    headObject: jest.fn().mockResolvedValue({ ContentLength: 0 }),
    listPrefix: jest.fn().mockResolvedValue([]),
    deletePrefix: jest.fn().mockResolvedValue(0),
    deleteKeys: jest.fn().mockResolvedValue(0),
    // Deterministic URL shape so assertions read clearly.
    getPublicUrl: jest.fn((key: string) => `https://cdn.test/${key}`),
    getBucketName: jest.fn(() => TEST_BUCKET),
  };
}

export function asStorageService(mock: MockStorageService): StorageService {
  return mock as unknown as StorageService;
}
