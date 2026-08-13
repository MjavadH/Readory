import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ChapterContentType } from '@prisma/client';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { ReaderService } from '../reader/reader.service';
import { StorageService } from '../storage/storage.service';

export const PDF_UPLOAD_MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_PDF_PAGES = 1000;
const PDF_QUEUE_NAME = 'pdf';

type BullQueue = {
  add: (name: string, data: PdfJobData, options?: any) => Promise<any>;
  getJob: (jobId: string) => Promise<{ remove: () => Promise<void> } | null>;
  close: () => Promise<void>;
};
type BullWorker = { close: () => Promise<void> };
type PdfJobData = { chapterId: number; pdfKey: string; contentVersion: number; pageCount: number };
type ImagePage = { key: string; w: number; h: number };

@Injectable()
export class PdfProcessingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PdfProcessingService.name);
  private queue?: BullQueue;
  private worker?: BullWorker;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly readerService: ReaderService,
  ) {}

  async onModuleInit() {
    const bullmq = await import('bullmq');
    const connection = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      maxRetriesPerRequest: null,
    };
    this.queue = new bullmq.Queue(PDF_QUEUE_NAME, { connection });
    this.worker = new bullmq.Worker(
      PDF_QUEUE_NAME,
      (job: { data: PdfJobData }) => this.process(job.data),
      {
        connection,
        concurrency: Number(process.env.PDF_PROCESSING_CONCURRENCY || 2),
      },
    );
    this.cleanupTimer = setInterval(() => void this.cleanupOldContent(), 24 * 60 * 60 * 1000);
    this.cleanupTimer.unref();
  }

  async onModuleDestroy() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    await Promise.all([this.worker?.close(), this.queue?.close()]);
  }

  async uploadAndReplace(chapterId: number, fileBuffer: Buffer, originalName: string) {
    if (!fileBuffer || !Buffer.isBuffer(fileBuffer))
      throw new BadRequestException('PDF file is required');
    if (fileBuffer.length > PDF_UPLOAD_MAX_FILE_BYTES)
      throw new BadRequestException('PDF file too large');

    const pageCount = await this.validatePdf(fileBuffer, originalName);
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      select: { id: true, pdfKey: true },
    });
    if (!chapter) throw new NotFoundException('Chapter not found');

    const pdfKey = `chapters/${chapterId}/source/${Date.now()}.pdf`;
    await this.storage.putObject({
      key: pdfKey,
      body: fileBuffer,
      contentType: 'application/pdf',
      cacheControl: 'private, no-store',
    });

    const updated = await this.prisma.chapter.update({
      where: { id: chapterId },
      data: {
        contentVersion: { increment: 1 },
        contentPath: null,
        contentType: null,
        pageCount: 0,
        pdfKey,
        pdfPageCount: pageCount,
        pdfUploadedAt: new Date(),
      },
      select: { contentVersion: true },
    });

    if (chapter.pdfKey && chapter.pdfKey !== pdfKey) {
      await this.storage
        .deleteKeys([chapter.pdfKey])
        .catch((e) =>
          this.logger.warn(`Failed to cleanup replaced PDF ${chapter.pdfKey}: ${String(e)}`),
        );
    }

    await this.enqueue({ chapterId, pdfKey, contentVersion: updated.contentVersion, pageCount });
    await this.readerService.clearChapterManifestCache(chapterId);
    return { ok: true, chapterId, pageCount, contentVersion: updated.contentVersion };
  }

  private async enqueue(data: PdfJobData) {
    if (!this.queue) throw new Error('PDF queue is not initialized');
    const jobId = `chapter-${data.chapterId}`;
    const existing = await this.queue.getJob(jobId);
    await existing?.remove().catch(() => undefined);
    await this.queue.add('convert', data, {
      jobId,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: true,
    });
  }

  private async validatePdf(buffer: Buffer, originalName = 'PDF') {
    let document: PDFDocument;
    try {
      document = await PDFDocument.load(buffer, { ignoreEncryption: false });
    } catch {
      throw new BadRequestException(`Invalid PDF: ${originalName}`);
    }
    const pageCount = document.getPageCount();
    if (pageCount < 1) throw new BadRequestException('PDF has no pages');
    if (pageCount > MAX_PDF_PAGES)
      throw new BadRequestException(`PDF page limit exceeded; max ${MAX_PDF_PAGES}`);
    return pageCount;
  }

  private async process(job: PdfJobData) {
    const tempDir = await mkdtemp(
      join(tmpdir(), `readory-pdf-${job.chapterId}-${job.contentVersion}-`),
    );
    const pdfPath = join(tempDir, 'source.pdf');
    try {
      const pdf = await this.storage.getObjectBuffer(job.pdfKey);
      const actualPageCount = await this.validatePdf(pdf);
      if (actualPageCount !== job.pageCount) throw new Error('PDF page count changed');
      await writeFile(pdfPath, pdf);

      const { fromPath } = await import('pdf2pic');
      const converter = fromPath(pdfPath, {
        density: 200,
        width: 1400,
        savePath: tempDir,
        format: 'png',
      });
      const pages: ImagePage[] = [];

      for (let pageNumber = 1; pageNumber <= actualPageCount; pageNumber += 1) {
        // Rasterize one page at a time so large PDFs do not accumulate rendered pages in memory.
        const result = await converter(pageNumber, { responseType: 'buffer' });
        if (!result.buffer) throw new Error(`Failed to rasterize PDF page ${pageNumber}`);
        const { data, info } = await sharp(result.buffer)
          .webp({ quality: 85, effort: 4 })
          .toBuffer({ resolveWithObject: true });
        const key = `chapters/${job.chapterId}/v${job.contentVersion}/page-${pageNumber}.webp`;
        await this.storage.putBuffer(key, data, 'image/webp');
        pages.push({ key, w: info.width, h: info.height });
      }

      const chapter = await this.prisma.chapter.findUnique({
        where: { id: job.chapterId },
        select: { contentVersion: true },
      });
      if (!chapter || chapter.contentVersion !== job.contentVersion) {
        await this.storage
          .deletePrefix(`chapters/${job.chapterId}/v${job.contentVersion}`)
          .catch(() => 0);
        await this.storage.deleteKeys([job.pdfKey]).catch(() => 0);
        await this.enqueueCurrentChapterJob(job.chapterId);
        return;
      }

      const contentPath = `chapters/${job.chapterId}/v${job.contentVersion}`;
      await this.storage.putJson(
        `${contentPath}/manifest.json`,
        this.readerService.buildManifest('images', pages),
      );
      await this.prisma.chapter.updateMany({
        where: { id: job.chapterId, contentVersion: job.contentVersion },
        data: {
          contentType: ChapterContentType.images,
          contentPath,
          pageCount: pages.length,
          pdfKey: null,
        },
      });
      await this.storage.deleteKeys([job.pdfKey]);
      await this.readerService.clearChapterManifestCache(job.chapterId);
    } finally {
      await rm(tempDir, { recursive: true, force: true }).catch((e) =>
        this.logger.warn(`Failed to clean temp PDF directory: ${String(e)}`),
      );
    }
  }

  private async enqueueCurrentChapterJob(chapterId: number) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      select: { pdfKey: true, pdfPageCount: true, contentVersion: true, contentType: true },
    });
    if (!chapter?.pdfKey || !chapter.pdfPageCount || chapter.contentType !== null) return;
    await this.enqueue({
      chapterId,
      pdfKey: chapter.pdfKey,
      contentVersion: chapter.contentVersion,
      pageCount: chapter.pdfPageCount,
    });
  }

  async cleanupOldContent() {
    const chapters = await this.prisma.chapter.findMany({
      select: { id: true, contentVersion: true },
    });
    await Promise.all(
      chapters.map(async (chapter) => {
        for (let version = 0; version < chapter.contentVersion; version += 1) {
          await this.storage
            .deletePrefix(`chapters/${chapter.id}/v${version}`)
            .catch((e) =>
              this.logger.warn(
                `Failed to cleanup chapter ${chapter.id} version ${version}: ${String(e)}`,
              ),
            );
        }
      }),
    );
  }
}
