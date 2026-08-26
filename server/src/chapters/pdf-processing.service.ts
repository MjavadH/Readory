import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ChapterContentType } from '@prisma/client';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import { PrismaService } from '../prisma/prisma.service';
import { ReaderService } from '../reader/reader.service';
import { StorageService } from '../storage/storage.service';

export const PDF_UPLOAD_MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_PDF_PAGES = 1000;
const PDF_QUEUE_NAME = 'pdf';

type BullQueue = {
  add: (name: string, data: PdfJobData, options?: any) => Promise<any>;
  getJob: (jobId: string) => Promise<{ remove: () => Promise<void> } | null | undefined>;
  close: () => Promise<void>;
};
type BullWorker = { close: () => Promise<void> };
type PdfJobData = {
  bookId: number;
  chapterId: number;
  chapterIndex: number;
  pdfKey: string;
  contentPath: string;
  pageCount: number;
};
type ImagePage = { key: string; w: number; h: number };

@Injectable()
export class PdfProcessingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PdfProcessingService.name);
  private queue?: BullQueue;
  private worker?: BullWorker;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly readerService: ReaderService,
  ) {}

  private chapterBasePrefix(bookId: number, chapterIndex: number): string {
    return `b${bookId}/c${chapterIndex}`;
  }

  private chapterVersionPrefix(bookId: number, chapterIndex: number): string {
    return `${this.chapterBasePrefix(bookId, chapterIndex)}/v${Date.now()}-${randomUUID()}`;
  }

  async onModuleInit() {
    const bullmq = await import('bullmq');
    const connection = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      maxRetriesPerRequest: null,
    };
    const configuredConcurrency = Number(process.env.PDF_PROCESSING_CONCURRENCY || 2);

    const concurrency = Math.min(Math.max(configuredConcurrency, 1), 4);
    this.queue = new bullmq.Queue(PDF_QUEUE_NAME, { connection });
    this.worker = new bullmq.Worker(PDF_QUEUE_NAME, (job) => this.process(job), {
      connection,
      concurrency: concurrency,
    });
    this.logger.log('PDF worker initialized');
  }

  async onModuleDestroy() {
    await Promise.all([this.worker?.close(), this.queue?.close()]);
  }

  async uploadAndReplace(bookId: number, chapterIndex: number, file: Express.Multer.File) {
    if (!file?.buffer) {
      throw new BadRequestException('PDF file is required');
    }

    if (file.buffer.length > PDF_UPLOAD_MAX_FILE_BYTES) {
      throw new BadRequestException('PDF file too large');
    }

    const pdfBuffer = file.buffer;

    const pageCount = await this.validatePdf(pdfBuffer, file.originalname);

    const chapter = await this.prisma.chapter.findFirst({
      where: {
        bookId,
        index: chapterIndex,
      },
      select: {
        id: true,
        contentPath: true,
        contentType: true,
        pdfKey: true,
      },
    });

    if (!chapter) {
      throw new NotFoundException('Chapter not found');
    }

    if (chapter.contentType === null && chapter.pdfKey !== null) {
      throw new BadRequestException('A PDF is already being processed for this chapter');
    }

    const contentPath = this.chapterVersionPrefix(bookId, chapterIndex);

    const pdfKey = `${contentPath}/source.pdf`;

    await this.storage.putObject({
      key: pdfKey,
      body: pdfBuffer,
      contentType: 'application/pdf',
      cacheControl: 'private, no-store',
    });

    await this.prisma.chapter.update({
      where: {
        id: chapter.id,
      },
      data: {
        contentPath: null,
        contentType: null,
        pageCount: 0,
        contentVersion: {
          increment: 1,
        },
        pdfKey,
        pdfPageCount: pageCount,
        pdfUploadedAt: new Date(),
      },
    });

    await this.enqueue({
      bookId,
      chapterId: chapter.id,
      chapterIndex,
      pdfKey,
      contentPath,
      pageCount,
    });

    return {
      ok: true,
      pageCount,
    };
  }

  private async enqueue(data: PdfJobData) {
    if (!this.queue) {
      throw new Error('PDF queue is not initialized');
    }

    await this.queue.add('convert', data, {
      jobId: `chapter-${data.chapterId}`,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
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

  private async process(job: any) {
    const data: PdfJobData = job.data;
    this.logger.log(`PDF processing started: chapter=${data.chapterId}, key=${data.pdfKey}`);
    const tempDir = await mkdtemp(join(tmpdir(), `readory-pdf-${data.chapterId}-`));
    const pdfPath = join(tempDir, 'source.pdf');
    try {
      const pdf = await this.storage.getObjectBuffer(data.pdfKey);
      this.logger.log(`PDF downloaded: ${pdf.length} bytes`);
      const actualPageCount = await this.validatePdf(pdf);
      if (actualPageCount !== data.pageCount) throw new Error('PDF page count changed');
      await writeFile(pdfPath, pdf);
      const currentChapter = await this.prisma.chapter.findUnique({
        where: {
          id: data.chapterId,
        },
        select: {
          pdfKey: true,
        },
      });

      if (currentChapter?.pdfKey !== data.pdfKey) {
        this.logger.warn(`Skipping outdated PDF job for chapter ${data.chapterId}`);

        return;
      }

      this.logger.log(`Starting rasterization: pages=${actualPageCount}`);

      const { pdf: renderPdfToImages } = await import('pdf-to-img');
      const document = await renderPdfToImages(pdfPath, { scale: 2 });

      const pages: ImagePage[] = [];
      let pageNumber = 1;

      for await (const pageBuffer of document) {
        this.logger.log(`Rendering page ${pageNumber}/${actualPageCount}`);

        const { data: webpBuffer, info } = await sharp(pageBuffer)
          .resize({ width: 1400, withoutEnlargement: true })
          .webp({
            quality: 85,
            effort: 4,
          })
          .toBuffer({
            resolveWithObject: true,
          });

        const key = `${data.contentPath}/pages/page-${pageNumber}.webp`;

        await this.storage.putBuffer(key, webpBuffer, 'image/webp');

        await job.updateProgress({
          current: pageNumber,
          total: actualPageCount,
        });

        pages.push({
          key,
          w: info.width,
          h: info.height,
        });

        pageNumber += 1;
      }

      await this.storage.putJson(
        `${data.contentPath}/manifest.json`,
        this.readerService.buildManifest('images', pages),
      );

      await this.prisma.chapter.update({
        where: {
          id: data.chapterId,
        },
        data: {
          contentType: ChapterContentType.images,
          contentPath: data.contentPath,
          pageCount: pages.length,
          pdfKey: null,
        },
      });
      await this.storage.deleteKeys([data.pdfKey]);
      await this.readerService.clearChapterManifestCache(data.chapterId);
    } catch (error) {
      this.logger.error(
        `PDF processing failed for chapter=${data.chapterId}`,
        error instanceof Error ? error.stack : String(error),
      );
      await this.prisma.chapter.update({
        where: {
          id: data.chapterId,
        },
        data: {
          pdfKey: null,
          contentType: null,
        },
      });
      throw error;
    } finally {
      await rm(tempDir, { recursive: true, force: true }).catch((e) =>
        this.logger.warn(`Failed to clean temp PDF directory: ${String(e)}`),
      );
    }
  }
}
