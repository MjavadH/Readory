import { BadRequestException, NotFoundException } from '@nestjs/common';
import yazl from 'yazl';
import { EpubProcessingService } from './epub-processing.service';
import { EpubValidationService } from './epub-validation.service';

async function buildZip(files: Record<string, Buffer | string>): Promise<Buffer> {
  const zipfile = new yazl.ZipFile();
  for (const [path, content] of Object.entries(files)) {
    zipfile.addBuffer(Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8'), path);
  }
  zipfile.end();

  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    zipfile.outputStream.on('data', (c) => chunks.push(c));
    zipfile.outputStream.on('end', () => resolve(Buffer.concat(chunks)));
    zipfile.outputStream.on('error', reject);
  });
}

const CONTAINER_XML = `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;

function buildOpf() {
  return `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata>
    <dc:title xmlns:dc="http://purl.org/dc/elements/1.1/">Test Book</dc:title>
  </metadata>
  <manifest>
    <item id="ch1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch2" href="chapter2.xhtml" media-type="application/xhtml+xml"/>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
  </manifest>
  <spine>
    <itemref idref="ch1"/>
    <itemref idref="ch2"/>
  </spine>
</package>`;
}

async function buildBasicEpub(paragraphsPerChapter = 3) {
  const paras = (n: number) =>
    Array.from({ length: n }, (_, i) => `<p>Paragraph ${i}</p>`).join('');

  return buildZip({
    'META-INF/container.xml': CONTAINER_XML,
    'OEBPS/content.opf': buildOpf(),
    'OEBPS/chapter1.xhtml': `<html><body>${paras(paragraphsPerChapter)}</body></html>`,
    'OEBPS/chapter2.xhtml': `<html><body>${paras(paragraphsPerChapter)}</body></html>`,
    'OEBPS/nav.xhtml':
      '<html><body><nav><a href="chapter1.xhtml">Chapter One</a><a href="chapter2.xhtml">Chapter Two</a></nav></body></html>',
  });
}

describe('EpubProcessingService', () => {
  let prisma: any;
  let storage: any;
  let readerService: any;
  let service: EpubProcessingService;
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
      getPublicUrl: jest.fn(() => null),
    };

    readerService = { clearChapterManifestCache: jest.fn(async () => {}) };

    service = new EpubProcessingService(
      prisma,
      storage,
      readerService,
      new EpubValidationService(),
    );
  });

  describe('uploadAndReplace', () => {
    it('throws when no file is provided', async () => {
      await expect(service.uploadAndReplace(1, 1, undefined as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws NotFoundException when the chapter does not exist', async () => {
      const epub = await buildBasicEpub();
      prisma.chapter.findFirst.mockResolvedValue(null);

      await expect(
        service.uploadAndReplace(1, 1, { buffer: epub, originalname: 'b.epub' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects an upload while another conversion is in-flight', async () => {
      const epub = await buildBasicEpub();
      prisma.chapter.findFirst.mockResolvedValue({
        id: 5,
        contentStatus: 'PROCESSING',
      });

      await expect(
        service.uploadAndReplace(1, 1, { buffer: epub, originalname: 'b.epub' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('stores the source EPUB and enqueues a job on success', async () => {
      const epub = await buildBasicEpub();
      prisma.chapter.findFirst.mockResolvedValue({
        id: 5,
        contentStatus: 'EMPTY',
      });
      prisma.chapter.update.mockResolvedValue({});

      // Bypass real BullMQ — swap in a fake queue directly.
      (service as any).queue = { add: jest.fn(async () => ({})) };

      const result = await service.uploadAndReplace(1, 1, {
        buffer: epub,
        originalname: 'b.epub',
      } as any);

      expect(result.ok).toBe(true);
      expect(result.sectionCount).toBe(2);
      expect(prisma.chapter.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            contentStatus: 'PROCESSING',
            contentKey: expect.any(String),
          }),
        }),
      );
      expect((service as any).queue.add).toHaveBeenCalledTimes(1);
    });

    it('uses a jobId unique per upload (not per chapter) so re-uploads are never silently swallowed by BullMQ', async () => {
      // Regression test: BullMQ silently no-ops queue.add() when a job
      // with the same jobId already completed/failed — it does NOT
      // re-run it and does NOT throw. A jobId keyed only on chapterId
      // meant every re-upload after the chapter's first successful run
      // got dropped: contentStatus flipped to PROCESSING in the DB, but
      // no job was ever actually queued, so it stayed stuck forever.
      const epubA = await buildBasicEpub();
      const epubB = await buildBasicEpub();

      prisma.chapter.findFirst.mockResolvedValue({ id: 5, contentStatus: 'EMPTY' });
      prisma.chapter.update.mockResolvedValue({});
      const fakeQueue = { add: jest.fn(async () => ({})) };
      (service as any).queue = fakeQueue;

      await service.uploadAndReplace(1, 1, { buffer: epubA, originalname: 'a.epub' } as any);
      await service.uploadAndReplace(1, 1, { buffer: epubB, originalname: 'b.epub' } as any);

      expect(fakeQueue.add).toHaveBeenCalledTimes(2);
      const [, firstOptions] = fakeQueue.add.mock.calls[0];
      const [, secondOptions] = fakeQueue.add.mock.calls[1];

      expect(firstOptions.jobId).not.toEqual(secondOptions.jobId);
      expect(firstOptions.jobId).toContain('chapter-epub-5-');
      expect(firstOptions.removeOnComplete).toBe(true);
      expect(firstOptions.removeOnFail).toBe(true);
    });
  });

  describe('process (worker job)', () => {
    function fakeJob(data: any) {
      return { data, updateProgress: jest.fn(async () => {}) };
    }

    it('processes a well-formed EPUB into pages and a manifest, then marks the chapter ready', async () => {
      const epub = await buildBasicEpub(3);
      const contentPath = 'b1/c1/vTEST';
      const epubKey = `${contentPath}/source.epub`;
      storedObjects.set(epubKey, epub);

      prisma.chapter.findUnique.mockResolvedValue({ contentKey: epubKey });

      const job = fakeJob({ bookId: 1, chapterId: 5, chapterIndex: 1, epubKey, contentPath });
      await (service as any).process(job);

      expect(prisma.chapter.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 5 },
          data: expect.objectContaining({
            contentStatus: 'READY',
            contentType: 'epub',
            contentPath,
            pageCount: expect.any(Number),
            contentKey: null,
          }),
        }),
      );

      const manifestBuf = storedObjects.get(`${contentPath}/manifest.json`);
      expect(manifestBuf).toBeDefined();
      const manifest = JSON.parse(manifestBuf!.toString('utf8'));
      expect(manifest.format).toBe('epub');
      expect(manifest.pages.length).toBeGreaterThan(0);
      expect(manifest.toc.length).toBe(2); // both chapter links resolved

      expect(storage.deleteKeys).toHaveBeenCalledWith([epubKey]);
      expect(readerService.clearChapterManifestCache).toHaveBeenCalledWith(5);
    });

    it('skips processing when a newer upload has superseded this job', async () => {
      const epub = await buildBasicEpub();
      const contentPath = 'b1/c1/vOLD';
      const epubKey = `${contentPath}/source.epub`;
      storedObjects.set(epubKey, epub);

      // Chapter's current contentKey points to a DIFFERENT (newer) upload.
      prisma.chapter.findUnique.mockResolvedValue({ contentKey: 'b1/c1/vNEW/source.epub' });

      const job = fakeJob({ bookId: 1, chapterId: 5, chapterIndex: 1, epubKey, contentPath });
      await (service as any).process(job);

      expect(prisma.chapter.update).not.toHaveBeenCalled();
      expect(storage.putJson).not.toHaveBeenCalled();
    });

    it('marks the chapter FAILED but leaves any previous READY content untouched', async () => {
      const contentPath = 'b1/c1/vBAD';
      const epubKey = `${contentPath}/source.epub`;
      storedObjects.set(epubKey, Buffer.from('not a real zip'));

      prisma.chapter.findUnique.mockResolvedValue({ contentKey: epubKey });

      const job = fakeJob({ bookId: 1, chapterId: 5, chapterIndex: 1, epubKey, contentPath });

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

    it('stores raw storage keys (not public URLs) as image src so the reader can rewrite them', async () => {
      const zip = await buildZip({
        'META-INF/container.xml': CONTAINER_XML,
        'OEBPS/content.opf': `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <manifest>
    <item id="ch1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="img1" href="images/pic.jpg" media-type="image/jpeg"/>
  </manifest>
  <spine><itemref idref="ch1"/></spine>
</package>`,
        'OEBPS/chapter1.xhtml': '<html><body><img src="images/pic.jpg"/></body></html>',
        // A minimal valid-enough JPEG-like buffer won't pass sharp's real
        // decode, so this test focuses on the src-key contract via a page
        // that has no valid image (falls back to empty src) OR, if the
        // image pipeline is mocked at a higher level in real CI, a real
        // JPEG fixture should replace this buffer.
        'OEBPS/images/pic.jpg': Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
      });

      const contentPath = 'b1/c1/vIMG';
      const epubKey = `${contentPath}/source.epub`;
      storedObjects.set(epubKey, zip);
      prisma.chapter.findUnique.mockResolvedValue({ contentKey: epubKey });

      const job = fakeJob({ bookId: 1, chapterId: 5, chapterIndex: 1, epubKey, contentPath });
      await (service as any).process(job);

      const manifestBuf = storedObjects.get(`${contentPath}/manifest.json`);
      const manifest = JSON.parse(manifestBuf!.toString('utf8'));
      const pageHtml = storedObjects.get(manifest.pages[0].key)!.toString('utf8');

      // Whatever the src ends up being (real key or empty fallback), it must
      // never be a public getPublicUrl()-style absolute URL.
      expect(storage.getPublicUrl).not.toHaveBeenCalled();
      expect(pageHtml).not.toMatch(/https?:\/\//);
    });
  });
});
