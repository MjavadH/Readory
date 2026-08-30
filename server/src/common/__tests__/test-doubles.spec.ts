import { createMockPrismaService, createMockRedis, createMockQueue, createMockCacheManager, createMockStorageService, createMockJob } from '../../../test/mocks';

describe('shared test doubles', () => {
  it('prisma $transaction supports callback and array forms', async () => {
    const prisma = createMockPrismaService();
    prisma.book.update.mockResolvedValue({ id: 1 });
    const cb = await prisma.$transaction(async (tx: typeof prisma) => tx.book.update({ where: { id: 1 }, data: {} }));
    expect(cb).toEqual({ id: 1 });
    await expect(prisma.$transaction([Promise.resolve('a'), Promise.resolve('b')])).resolves.toEqual(['a', 'b']);
  });

  it('redis pipeline is chainable and exec resolves tuples', async () => {
    const redis = createMockRedis();
    const p = redis.pipeline();
    expect(p.zadd('k', 1, 'm')).toBe(p);
    redis.__pipeline.exec.mockResolvedValue([[null, 3]]);
    await expect(p.exec()).resolves.toEqual([[null, 3]]);
  });

  it('cache getOrSet invokes the loader on miss', async () => {
    const cache = createMockCacheManager();
    const loader = jest.fn().mockResolvedValue('fresh');
    await expect(cache.getOrSet('k', {}, loader)).resolves.toBe('fresh');
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('queue and job helpers expose usable shapes', async () => {
    const q = createMockQueue();
    await expect(q.add('job', { a: 1 })).resolves.toMatchObject({ name: 'job' });
    expect(createMockJob({ bookId: 7 }).data.bookId).toBe(7);
    expect(createMockStorageService().getPublicUrl('x/y')).toBe('https://cdn.test/x/y');
  });
});
