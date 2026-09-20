import { BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { CacheManager } from '../cache/cache.manager';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ReaderService } from './reader.service';

describe('ReaderService', () => {
  let service: ReaderService;

  const prismaMock = {
    chapter: { findFirst: jest.fn(), findUnique: jest.fn() },
    accessRecord: { findFirst: jest.fn() },
    readingProgress: { findUnique: jest.fn(), upsert: jest.fn() },
  };

  const storageMock = { getObjectBuffer: jest.fn() };
  const cacheMock = {
    buildKey: jest.fn().mockReturnValue('manifest:key'),
    getOrSet: jest.fn(async (_k: string, _opt: unknown, loader: () => Promise<unknown>) =>
      loader(),
    ),
    del: jest.fn(),
  };

  const redisMock = {
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn(),
    get: jest.fn().mockResolvedValue(null),
    zadd: jest.fn(),
    zremrangebyscore: jest.fn(),
    zcard: jest.fn().mockResolvedValue(1),
    set: jest.fn(),
  };

  let jwtService: JwtService;

  beforeEach(async () => {
    jest.clearAllMocks();
    redisMock.incr.mockResolvedValue(1);
    redisMock.get.mockResolvedValue(null);
    redisMock.zcard.mockResolvedValue(1);

    const module = await Test.createTestingModule({
      providers: [
        ReaderService,
        {
          provide: JwtService,
          useValue: new JwtService({ secret: 'test-secret' }),
        },
        { provide: PrismaService, useValue: prismaMock },
        { provide: StorageService, useValue: storageMock },
        { provide: CacheManager, useValue: cacheMock },
        { provide: 'REDIS_CLIENT', useValue: redisMock },
      ],
    }).compile();

    service = module.get(ReaderService);
    jwtService = module.get(JwtService);
  });

  it('should reject session when no access', async () => {
    prismaMock.chapter.findFirst.mockResolvedValue({
      id: 1,
      bookId: 1,
      index: 1,
      isFree: false,
      contentVersion: 0,
      pageCount: 1,
      contentType: 'images',
    });
    prismaMock.accessRecord.findFirst.mockResolvedValue(null);
    await expect(
      service.createSession(10, 1, 1, {
        headers: { 'user-agent': 'jest' },
      } as never),
    ).rejects.toBeTruthy();
  });

  it('should upsert progress with clamp', async () => {
    prismaMock.chapter.findUnique.mockResolvedValue({
      id: 1,
      bookId: 3,
      isFree: true,
      pageCount: 10,
    });
    prismaMock.readingProgress.upsert.mockResolvedValue({
      lastPage: 10,
      percent: 100,
    });
    prismaMock.accessRecord.findFirst.mockResolvedValue({ id: 99 });

    const saved = await service.saveProgress(2, 1, 100);
    expect(prismaMock.readingProgress.upsert).toHaveBeenCalled();
    expect(saved).toEqual({ lastPage: 10, percent: 100 });
  });

  describe('EPUB support', () => {
    const EPUB_MANIFEST = {
      version: 2 as const,
      format: 'epub' as const,
      pageCount: 2,
      pages: [
        { key: 'b1/c1/vABC/content/page_1.html', sectionId: 'ch1', unitCount: 10, hasImages: true },
        { key: 'b1/c1/vABC/content/page_2.html', sectionId: 'ch2', unitCount: 5, hasImages: false },
      ],
      toc: [],
    };

    async function issueToken(overrides: Partial<Record<string, unknown>> = {}) {
      return jwtService.signAsync(
        {
          userId: 42,
          chapterId: 7,
          bookId: 1,
          chapterIndex: 1,
          contentVersion: 3,
          uaHash: service['uaHash']({ headers: { 'user-agent': 'jest' } } as never),
          scope: 'reader',
          ...overrides,
        },
        { expiresIn: 120 },
      );
    }

    const req = { headers: { 'user-agent': 'jest' } } as never;

    describe('getEpubText', () => {
      it('rewrites raw storage keys in <img src> to /reader/epub-asset URLs', async () => {
        const token = await issueToken();

        prismaMock.chapter.findUnique
          .mockResolvedValueOnce({ contentVersion: 3, id: 7 }) // verifyToken lookup
          .mockResolvedValueOnce({
            contentPath: 'b1/c1/vABC',
            contentType: 'epub',
            pageCount: 2,
          }); // manifest lookup

        storageMock.getObjectBuffer
          .mockResolvedValueOnce(Buffer.from(JSON.stringify(EPUB_MANIFEST))) // manifest.json
          .mockResolvedValueOnce(
            Buffer.from('<p>Hello</p><img src="b1/c1/vABC/assets/img-1.webp" alt="x"/>'),
          ); // page html

        const html = await service.getEpubText(token, 1, req);

        expect(html).toContain('/reader/epub-asset?token=');
        expect(html).toContain(encodeURIComponent('b1/c1/vABC/assets/img-1.webp'));
        expect(html).not.toContain('src="b1/c1/vABC/assets/img-1.webp"');
      });

      it('throws when the manifest is not an epub manifest', async () => {
        const token = await issueToken();

        prismaMock.chapter.findUnique
          .mockResolvedValueOnce({ contentVersion: 3, id: 7 })
          .mockResolvedValueOnce({ contentPath: 'b1/c1/vABC', contentType: 'text', pageCount: 2 });

        storageMock.getObjectBuffer.mockResolvedValueOnce(
          Buffer.from(JSON.stringify({ version: 1, format: 'text', pageCount: 1, pages: [] })),
        );

        await expect(service.getEpubText(token, 1, req)).rejects.toThrow(BadRequestException);
      });
    });

    describe('getEpubAsset — allow-list security', () => {
      async function setupWithManifest() {
        const token = await issueToken();
        prismaMock.chapter.findUnique
          .mockResolvedValueOnce({ contentVersion: 3, id: 7 })
          .mockResolvedValueOnce({
            contentPath: 'b1/c1/vABC',
            contentType: 'epub',
            pageCount: 2,
          });
        storageMock.getObjectBuffer.mockResolvedValueOnce(
          Buffer.from(JSON.stringify(EPUB_MANIFEST)),
        );
        return token;
      }

      it("serves an asset key that legitimately falls under this chapter's assets/ prefix", async () => {
        const token = await setupWithManifest();
        storageMock.getObjectBuffer.mockResolvedValueOnce(Buffer.from('fake-image-bytes'));

        // sharp() will fail decoding fake bytes in a real environment; we
        // only assert here that the allow-list check let it through to
        // storage — the watermarking path itself mirrors the already-used
        // getPage() composite logic.
        await expect(
          service.getEpubAsset(token, 'b1/c1/vABC/assets/img-1.webp', req),
        ).rejects.toBeDefined();

        expect(storageMock.getObjectBuffer).toHaveBeenNthCalledWith(
          2,
          'b1/c1/vABC/assets/img-1.webp',
        );
      });

      it('rejects a key pointing outside the assets/ subpath (e.g. the page HTML itself)', async () => {
        const token = await setupWithManifest();

        await expect(
          service.getEpubAsset(token, 'b1/c1/vABC/content/page_1.html', req),
        ).rejects.toThrow(BadRequestException);
      });

      it('rejects a key pointing at a completely unrelated chapter/book prefix', async () => {
        const token = await setupWithManifest();

        await expect(
          service.getEpubAsset(token, 'b999/c999/vXYZ/assets/img-1.webp', req),
        ).rejects.toThrow(BadRequestException);
      });

      it('rejects a key containing path traversal sequences', async () => {
        const token = await setupWithManifest();

        await expect(
          service.getEpubAsset(token, 'b1/c1/vABC/assets/../../../etc/passwd', req),
        ).rejects.toThrow(BadRequestException);
      });

      it('rejects an absolute path key', async () => {
        const token = await setupWithManifest();

        await expect(service.getEpubAsset(token, '/etc/passwd', req)).rejects.toThrow(
          BadRequestException,
        );
      });

      it('rejects an empty key', async () => {
        const token = await setupWithManifest();

        await expect(service.getEpubAsset(token, '', req)).rejects.toThrow(BadRequestException);
      });
    });
  });
});
