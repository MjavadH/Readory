import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TextProcessingService } from './text-processing.service';

describe('TextProcessingService', () => {
  let prisma: any;
  let storage: any;
  let readerService: any;
  let service: TextProcessingService;
  let storedObjects: Map<string, Buffer>;

  beforeEach(() => {
    storedObjects = new Map();

    prisma = {
      chapter: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    storage = {
      putBuffer: jest.fn(async (key: string, buf: Buffer) => {
        storedObjects.set(key, buf);
      }),
      putJson: jest.fn(async (key: string, obj: unknown) => {
        storedObjects.set(key, Buffer.from(JSON.stringify(obj)));
      }),
      getObjectBuffer: jest.fn(async (key: string) => {
        const buf = storedObjects.get(key);
        if (!buf) throw new Error(`not found: ${key}`);
        return buf;
      }),
      deleteKeys: jest.fn(async () => 1),
    };

    readerService = {
      clearChapterManifestCache: jest.fn(async () => {}),
      buildManifest: jest.fn((format: string, pages: unknown[]) => ({
        version: 1,
        format,
        pageCount: pages.length,
        pages,
      })),
    };

    service = new TextProcessingService(prisma, storage, readerService);
  });

  function fakeJob(data: any) {
    return { data, updateProgress: jest.fn(async () => {}) };
  }

  describe('uploadAndQueue', () => {
    it('throws when no file buffer is provided', async () => {
      await expect(service.uploadAndQueue(1, 1, { originalname: 'a.md' } as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws when the file is too large', async () => {
      const big = Buffer.alloc(3 * 1024 * 1024, 'a');
      await expect(
        service.uploadAndQueue(1, 1, { buffer: big, originalname: 'a.md' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects unsupported extensions', async () => {
      await expect(
        service.uploadAndQueue(1, 1, {
          buffer: Buffer.from('hello'),
          originalname: 'a.pdf',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when the chapter does not exist', async () => {
      prisma.chapter.findFirst.mockResolvedValue(null);
      await expect(
        service.uploadAndQueue(1, 1, {
          buffer: Buffer.from('# Hello'),
          originalname: 'a.md',
        } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects an upload while another conversion is in-flight', async () => {
      prisma.chapter.findFirst.mockResolvedValue({ id: 5, contentStatus: 'PROCESSING' });
      await expect(
        service.uploadAndQueue(1, 1, {
          buffer: Buffer.from('# Hello'),
          originalname: 'a.md',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows a new upload when the chapter already has READY content (replaces it)', async () => {
      prisma.chapter.findFirst.mockResolvedValue({ id: 5, contentStatus: 'READY' });
      prisma.chapter.update.mockResolvedValue({});
      (service as any).queue = { add: jest.fn(async () => ({})) };

      await expect(
        service.uploadAndQueue(1, 1, {
          buffer: Buffer.from('# Hello'),
          originalname: 'a.md',
        } as any),
      ).resolves.toEqual({ ok: true, queued: true });
    });

    it('stores the source file and flips the chapter to PROCESSING without touching existing content fields', async () => {
      prisma.chapter.findFirst.mockResolvedValue({ id: 5, contentStatus: 'EMPTY' });
      prisma.chapter.update.mockResolvedValue({});
      (service as any).queue = { add: jest.fn(async () => ({})) };

      await service.uploadAndQueue(1, 1, {
        buffer: Buffer.from('# Hello'),
        originalname: 'a.md',
      } as any);

      expect(prisma.chapter.update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: {
          contentStatus: 'PROCESSING',
          contentKey: expect.stringMatching(/\/source\.md$/),
          contentUploadedAt: expect.any(Date),
        },
      });
    });

    it('picks the correct source extension for .txt uploads', async () => {
      prisma.chapter.findFirst.mockResolvedValue({ id: 5, contentStatus: 'EMPTY' });
      prisma.chapter.update.mockResolvedValue({});
      (service as any).queue = { add: jest.fn(async () => ({})) };

      await service.uploadAndQueue(1, 1, {
        buffer: Buffer.from('hello'),
        originalname: 'a.TXT',
      } as any);

      expect(prisma.chapter.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ contentKey: expect.stringMatching(/\/source\.txt$/) }),
        }),
      );
    });

    it('uses a jobId unique per upload (not per chapter) so re-uploads are never silently swallowed by BullMQ', async () => {
      // Regression test: BullMQ silently no-ops queue.add() when a job
      // with the same jobId already completed/failed. A jobId keyed only
      // on chapterId meant every re-upload after the first successful run
      // was dropped: contentStatus flipped to PROCESSING, but no job was
      // ever actually queued, leaving the chapter stuck forever.
      prisma.chapter.findFirst.mockResolvedValue({ id: 5, contentStatus: 'EMPTY' });
      prisma.chapter.update.mockResolvedValue({});
      const fakeQueue = { add: jest.fn(async () => ({})) };
      (service as any).queue = fakeQueue;

      await service.uploadAndQueue(1, 1, { buffer: Buffer.from('a'), originalname: 'a.md' } as any);
      await service.uploadAndQueue(1, 1, { buffer: Buffer.from('b'), originalname: 'b.md' } as any);

      expect(fakeQueue.add).toHaveBeenCalledTimes(2);
      const [, firstOptions] = fakeQueue.add.mock.calls[0];
      const [, secondOptions] = fakeQueue.add.mock.calls[1];

      expect(firstOptions.jobId).not.toEqual(secondOptions.jobId);
      expect(firstOptions.jobId).toContain('chapter-text-5-');
      expect(firstOptions.removeOnComplete).toBe(true);
      expect(firstOptions.removeOnFail).toBe(true);
    });
  });

  describe('process (worker job)', () => {
    it('splits pages on --- delimiters, renders markdown, and marks the chapter READY', async () => {
      const contentPath = 'b1/c1/vTEST';
      const sourceKey = `${contentPath}/source.md`;
      storedObjects.set(sourceKey, Buffer.from('# Page one\n\ncontent\n\n---\n\n# Page two'));
      prisma.chapter.findUnique.mockResolvedValue({ contentKey: sourceKey });

      const job = fakeJob({ bookId: 1, chapterId: 5, chapterIndex: 1, sourceKey, contentPath });
      await (service as any).process(job);

      expect(prisma.chapter.update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: {
          contentStatus: 'READY',
          contentPath,
          contentType: 'text',
          pageCount: 2,
          contentVersion: { increment: 1 },
          contentKey: null,
          contentUploadedAt: null,
        },
      });

      const manifestBuf = storedObjects.get(`${contentPath}/manifest.json`);
      const manifest = JSON.parse(manifestBuf!.toString('utf8'));
      expect(manifest.pageCount).toBe(2);

      const page1Html = storedObjects.get(manifest.pages[0].key)!.toString('utf8');
      expect(page1Html).toContain('<article>');
      expect(page1Html).toContain('Page one');

      expect(storage.deleteKeys).toHaveBeenCalledWith([sourceKey]);
      expect(readerService.clearChapterManifestCache).toHaveBeenCalledWith(5);
    });

    it('injects footnote definitions into the rendered HTML', async () => {
      const contentPath = 'b1/c1/vFN';
      const sourceKey = `${contentPath}/source.md`;
      storedObjects.set(sourceKey, Buffer.from('Some text[^1]\n\n[^1]: This is the footnote text'));
      prisma.chapter.findUnique.mockResolvedValue({ contentKey: sourceKey });

      const job = fakeJob({ bookId: 1, chapterId: 5, chapterIndex: 1, sourceKey, contentPath });
      await (service as any).process(job);

      const manifestBuf = storedObjects.get(`${contentPath}/manifest.json`);
      const manifest = JSON.parse(manifestBuf!.toString('utf8'));
      const pageHtml = storedObjects.get(manifest.pages[0].key)!.toString('utf8');

      expect(pageHtml).toContain('reader-footnote');
      expect(pageHtml).toContain('This is the footnote text');
    });

    it('sanitizes dangerous HTML embedded in the source (e.g. inline <script>)', async () => {
      const contentPath = 'b1/c1/vXSS';
      const sourceKey = `${contentPath}/source.md`;
      storedObjects.set(sourceKey, Buffer.from('Safe text\n\n<script>alert(1)</script>'));
      prisma.chapter.findUnique.mockResolvedValue({ contentKey: sourceKey });

      const job = fakeJob({ bookId: 1, chapterId: 5, chapterIndex: 1, sourceKey, contentPath });
      await (service as any).process(job);

      const manifestBuf = storedObjects.get(`${contentPath}/manifest.json`);
      const manifest = JSON.parse(manifestBuf!.toString('utf8'));
      const pageHtml = storedObjects.get(manifest.pages[0].key)!.toString('utf8');

      expect(pageHtml).not.toContain('<script>');
      expect(pageHtml).not.toContain('alert(1)');
      expect(pageHtml).toContain('Safe text');
    });

    it('rejects a source file with no readable pages', async () => {
      const contentPath = 'b1/c1/vEMPTY';
      const sourceKey = `${contentPath}/source.md`;
      storedObjects.set(sourceKey, Buffer.from('   \n\n   '));
      prisma.chapter.findUnique.mockResolvedValue({ contentKey: sourceKey });

      const job = fakeJob({ bookId: 1, chapterId: 5, chapterIndex: 1, sourceKey, contentPath });

      await expect((service as any).process(job)).rejects.toThrow(BadRequestException);
    });

    it('rejects a source file exceeding the max chapter page limit', async () => {
      const contentPath = 'b1/c1/vHUGE';
      const sourceKey = `${contentPath}/source.md`;
      const manyPages = Array.from({ length: 301 }, (_, i) => `Page ${i}`).join('\n\n---\n\n');
      storedObjects.set(sourceKey, Buffer.from(manyPages));
      prisma.chapter.findUnique.mockResolvedValue({ contentKey: sourceKey });

      const job = fakeJob({ bookId: 1, chapterId: 5, chapterIndex: 1, sourceKey, contentPath });

      await expect((service as any).process(job)).rejects.toThrow(BadRequestException);
    });

    it('skips processing when a newer upload has superseded this job', async () => {
      const contentPath = 'b1/c1/vOLD';
      const sourceKey = `${contentPath}/source.md`;
      storedObjects.set(sourceKey, Buffer.from('# Hello'));

      prisma.chapter.findUnique.mockResolvedValue({ contentKey: 'b1/c1/vNEW/source.md' });

      const job = fakeJob({ bookId: 1, chapterId: 5, chapterIndex: 1, sourceKey, contentPath });
      await (service as any).process(job);

      expect(prisma.chapter.update).not.toHaveBeenCalled();
      expect(storage.putJson).not.toHaveBeenCalled();
    });

    it('marks the chapter FAILED but leaves any previous READY content untouched', async () => {
      const contentPath = 'b1/c1/vBAD';
      const sourceKey = `${contentPath}/source.md`;
      prisma.chapter.findUnique.mockResolvedValue({ contentKey: sourceKey });

      const job = fakeJob({ bookId: 1, chapterId: 5, chapterIndex: 1, sourceKey, contentPath });

      await expect((service as any).process(job)).rejects.toThrow();

      expect(prisma.chapter.update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: {
          contentStatus: 'FAILED',
          contentKey: null,
          contentUploadedAt: null,
        },
      });
    });
  });
});
