import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PDFDocument } from 'pdf-lib';
import { PdfProcessingService } from './pdf-processing.service';

jest.mock('pdf-to-img', () => ({
  pdf: jest.fn(),
}));

async function buildSimplePdf(pageCount = 1): Promise<Buffer> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i += 1) {
    doc.addPage([200, 200]);
  }
  const bytes = await doc.save();
  return Buffer.from(bytes);
}

describe('PdfProcessingService', () => {
  let prisma: any;
  let storage: any;
  let readerService: any;
  let service: PdfProcessingService;
  let storedObjects: Map<string, Buffer>;

  beforeEach(() => {
    jest.clearAllMocks();
    storedObjects = new Map();

    prisma = {
      chapter: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    storage = {
      putObject: jest.fn(async ({ key, body }: any) => {
        storedObjects.set(key, Buffer.isBuffer(body) ? body : Buffer.from(body));
      }),
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

    service = new PdfProcessingService(prisma, storage, readerService);
  });

  function fakeJob(data: any) {
    return { data, updateProgress: jest.fn(async () => {}) };
  }

  describe('uploadAndReplace', () => {
    it('throws when no file is provided', async () => {
      await expect(service.uploadAndReplace(1, 1, undefined as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws when the PDF is invalid', async () => {
      await expect(
        service.uploadAndReplace(1, 1, {
          buffer: Buffer.from('not a pdf'),
          originalname: 'bad.pdf',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when the chapter does not exist', async () => {
      const pdf = await buildSimplePdf(2);
      prisma.chapter.findFirst.mockResolvedValue(null);

      await expect(
        service.uploadAndReplace(1, 1, { buffer: pdf, originalname: 'b.pdf' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects an upload while another conversion is in-flight', async () => {
      const pdf = await buildSimplePdf(1);
      prisma.chapter.findFirst.mockResolvedValue({ id: 5, contentStatus: 'PROCESSING' });

      await expect(
        service.uploadAndReplace(1, 1, { buffer: pdf, originalname: 'b.pdf' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows a new upload when the chapter already has READY content (replaces it)', async () => {
      const pdf = await buildSimplePdf(1);
      prisma.chapter.findFirst.mockResolvedValue({ id: 5, contentStatus: 'READY' });
      prisma.chapter.update.mockResolvedValue({});
      (service as any).queue = { add: jest.fn(async () => ({})) };

      await expect(
        service.uploadAndReplace(1, 1, { buffer: pdf, originalname: 'b.pdf' } as any),
      ).resolves.toMatchObject({ ok: true, pageCount: 1 });
    });

    it('stores the source PDF and flips the chapter to PROCESSING without touching existing content fields', async () => {
      const pdf = await buildSimplePdf(3);
      prisma.chapter.findFirst.mockResolvedValue({ id: 5, contentStatus: 'EMPTY' });
      prisma.chapter.update.mockResolvedValue({});
      (service as any).queue = { add: jest.fn(async () => ({})) };

      const result = await service.uploadAndReplace(1, 1, {
        buffer: pdf,
        originalname: 'b.pdf',
      } as any);

      expect(result).toEqual({ ok: true, pageCount: 3 });
      expect(prisma.chapter.update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: {
          contentStatus: 'PROCESSING',
          contentKey: expect.stringMatching(/\/source\.pdf$/),
          contentSourcePageCount: 3,
          contentUploadedAt: expect.any(Date),
        },
      });
    });

    it('uses a jobId unique per upload (not per chapter) so re-uploads are never silently swallowed by BullMQ', async () => {
      // Regression test: BullMQ silently no-ops queue.add() when a job
      // with the same jobId already completed/failed. A jobId keyed only
      // on chapterId meant every re-upload after the first successful run
      // was dropped: contentStatus flipped to PROCESSING, but no job was
      // ever actually queued, leaving the chapter stuck forever.
      const pdfA = await buildSimplePdf(1);
      const pdfB = await buildSimplePdf(1);

      prisma.chapter.findFirst.mockResolvedValue({ id: 5, contentStatus: 'EMPTY' });
      prisma.chapter.update.mockResolvedValue({});
      const fakeQueue = { add: jest.fn(async () => ({})) };
      (service as any).queue = fakeQueue;

      await service.uploadAndReplace(1, 1, { buffer: pdfA, originalname: 'a.pdf' } as any);
      await service.uploadAndReplace(1, 1, { buffer: pdfB, originalname: 'b.pdf' } as any);

      expect(fakeQueue.add).toHaveBeenCalledTimes(2);
      const [, firstOptions] = fakeQueue.add.mock.calls[0];
      const [, secondOptions] = fakeQueue.add.mock.calls[1];

      expect(firstOptions.jobId).not.toEqual(secondOptions.jobId);
      expect(firstOptions.jobId).toContain('chapter-pdf-5-');
      expect(firstOptions.removeOnComplete).toBe(true);
      expect(firstOptions.removeOnFail).toBe(true);
    });
  });

  describe('process (worker job)', () => {
    async function mockRasterizer(pageBuffers: Buffer[]) {
      const { pdf: renderPdfToImages } = await import('pdf-to-img');
      (renderPdfToImages as jest.Mock).mockResolvedValue({
        [Symbol.asyncIterator]: async function* () {
          for (const buf of pageBuffers) yield buf;
        },
      });
    }

    // A tiny valid PNG (sharp can decode this without a real rendered page).
    const FAKE_PAGE_PNG = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    );

    it('processes a valid PDF into image pages and marks the chapter READY', async () => {
      const pdf = await buildSimplePdf(2);
      const contentPath = 'b1/c1/vTEST';
      const pdfKey = `${contentPath}/source.pdf`;
      storedObjects.set(pdfKey, pdf);
      prisma.chapter.findUnique.mockResolvedValue({ contentKey: pdfKey });

      await mockRasterizer([FAKE_PAGE_PNG, FAKE_PAGE_PNG]);

      const job = fakeJob({
        bookId: 1,
        chapterId: 5,
        chapterIndex: 1,
        pdfKey,
        contentPath,
        pageCount: 2,
      });

      await (service as any).process(job);

      expect(prisma.chapter.update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: {
          contentStatus: 'READY',
          contentType: 'images',
          contentPath,
          pageCount: 2,
          contentVersion: { increment: 1 },
          contentKey: null,
          contentSourcePageCount: null,
          contentUploadedAt: null,
        },
      });
      expect(storage.deleteKeys).toHaveBeenCalledWith([pdfKey]);
      expect(readerService.clearChapterManifestCache).toHaveBeenCalledWith(5);
    });

    it('skips processing when a newer upload has superseded this job', async () => {
      const pdf = await buildSimplePdf(1);
      const contentPath = 'b1/c1/vOLD';
      const pdfKey = `${contentPath}/source.pdf`;
      storedObjects.set(pdfKey, pdf);

      prisma.chapter.findUnique.mockResolvedValue({ contentKey: 'b1/c1/vNEW/source.pdf' });

      const job = fakeJob({
        bookId: 1,
        chapterId: 5,
        chapterIndex: 1,
        pdfKey,
        contentPath,
        pageCount: 1,
      });

      await (service as any).process(job);

      expect(prisma.chapter.update).not.toHaveBeenCalled();
      expect(storage.putJson).not.toHaveBeenCalled();
    });

    it('rejects when the re-downloaded PDF page count no longer matches (tampered/changed source)', async () => {
      const pdf = await buildSimplePdf(1); // actually 1 page
      const contentPath = 'b1/c1/vMISMATCH';
      const pdfKey = `${contentPath}/source.pdf`;
      storedObjects.set(pdfKey, pdf);
      prisma.chapter.findUnique.mockResolvedValue({ contentKey: pdfKey });

      const job = fakeJob({
        bookId: 1,
        chapterId: 5,
        chapterIndex: 1,
        pdfKey,
        contentPath,
        pageCount: 99, // claims 99 pages, does not match
      });

      await expect((service as any).process(job)).rejects.toThrow('PDF page count changed');

      expect(prisma.chapter.update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: {
          contentStatus: 'FAILED',
          contentKey: null,
          contentSourcePageCount: null,
          contentUploadedAt: null,
        },
      });
    });

    it('marks the chapter FAILED but leaves any previous READY content untouched', async () => {
      const contentPath = 'b1/c1/vBAD';
      const pdfKey = `${contentPath}/source.pdf`;
      storedObjects.set(pdfKey, Buffer.from('not a real pdf'));
      prisma.chapter.findUnique.mockResolvedValue({ contentKey: pdfKey });

      const job = fakeJob({
        bookId: 1,
        chapterId: 5,
        chapterIndex: 1,
        pdfKey,
        contentPath,
        pageCount: 1,
      });

      await expect((service as any).process(job)).rejects.toThrow();

      const updateCall = prisma.chapter.update.mock.calls.find(
        ([args]: any) => args.data.contentStatus === 'FAILED',
      );
      expect(updateCall).toBeDefined();
      expect(updateCall[0].data).toEqual({
        contentStatus: 'FAILED',
        contentKey: null,
        contentSourcePageCount: null,
        contentUploadedAt: null,
      });
      expect(updateCall[0].data).not.toHaveProperty('contentType');
      expect(updateCall[0].data).not.toHaveProperty('contentPath');
      expect(updateCall[0].data).not.toHaveProperty('pageCount');
    });
  });
});
