import type { PublicService } from '../../src/public/public.service';

/**
 * PublicService double.
 *
 * Several admin-facing services (genres, book-types, books) depend on
 * PublicService purely to invalidate the public-facing caches it owns. Only the
 * invalidation surface is mocked here; specs that need the read methods should
 * extend the returned object rather than casting.
 */
export type MockPublicService = {
  clearHomeCache: jest.Mock<Promise<void>, []>;
  clearGenresPageCache: jest.Mock<Promise<void>, []>;
  getPublicHomeContent: jest.Mock;
  getGenresPage: jest.Mock;
  getPublicUserProfile: jest.Mock;
  getUserPersonalizedContent: jest.Mock;
};

export function createMockPublicService(): MockPublicService {
  return {
    clearHomeCache: jest.fn().mockResolvedValue(undefined),
    clearGenresPageCache: jest.fn().mockResolvedValue(undefined),
    getPublicHomeContent: jest.fn(),
    getGenresPage: jest.fn(),
    getPublicUserProfile: jest.fn(),
    getUserPersonalizedContent: jest.fn(),
  };
}

export function asPublicService(mock: MockPublicService): PublicService {
  return mock as unknown as PublicService;
}
