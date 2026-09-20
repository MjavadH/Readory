import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ChapterContentStatus, ChapterContentType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ReaderService } from '../../reader/reader.service';
import { StorageService } from '../../storage/storage.service';
import { EpubArchiveReader } from './epub-archive.reader';
import { DiscoveredImageRef } from './epub-ast.types';
import { processAndUploadEpubImage } from './epub-image.processor';
import { buildEpubManifest, EpubManifestPage } from './epub-manifest.types';

import { paginateSection } from './epub-section-pager';
import { extractTableOfContents } from './epub-toc.extractor';
import { EpubValidationService } from './epub-validation.service';
import { EpubXhtmlSanitizer } from './epub-xhtml.sanitizer';

export { EPUB_UPLOAD_MAX_FILE_BYTES } from './epub-validation.service';

const MAX_EPUB_PAGES = 2000;
const EPUB_QUEUE_NAME = 'epub';

type BullQueue = {
  add: (name: string, data: EpubJobData, options?: any) => Promise<any>;
  close: () => Promise<void>;
};
type BullWorker = { close: () => Promise<void> };
type EpubJobData = {
  bookId: number;
  chapterId: number;
  chapterIndex: number;
  epubKey: string;
  contentPath: string;
};

@Injectable()
export class EpubProcessingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EpubProcessingService.name);
  private queue?: BullQueue;
  private worker?: BullWorker;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly readerService: ReaderService,
    private readonly validationService: EpubValidationService,
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
    const configuredConcurrency = Number(process.env.EPUB_PROCESSING_CONCURRENCY || 2);
    const concurrency = Math.min(Math.max(configuredConcurrency, 1), 4);

    this.queue = new bullmq.Queue(EPUB_QUEUE_NAME, { connection });
    this.worker = new bullmq.Worker(EPUB_QUEUE_NAME, (job) => this.process(job), {
      connection,
      concurrency,
    });
    this.logger.log('EPUB worker initialized');
  }

  async onModuleDestroy() {
    await Promise.all([this.worker?.close(), this.queue?.close()]);
  }

  async uploadAndReplace(bookId: number, chapterIndex: number, file: Express.Multer.File) {
    if (!file?.buffer) {
      throw new BadRequestException('EPUB file is required');
    }

    // Fail fast: parse+validate structure before touching the DB or S3 at all.
    const validation = await this.validationService.validateUpload(file.buffer, file.originalname);
    validation.archive.close(); // we only needed this for validation; re-open during processing

    const chapter = await this.prisma.chapter.findFirst({
      where: { bookId, index: chapterIndex },
      select: { id: true, contentStatus: true },
    });

    if (!chapter) {
      throw new NotFoundException('Chapter not found');
    }

    if (chapter.contentStatus === ChapterContentStatus.PROCESSING) {
      throw new BadRequestException('Another file is already being processed for this chapter');
    }

    const contentPath = this.chapterVersionPrefix(bookId, chapterIndex);
    const epubKey = `${contentPath}/source.epub`;

    await this.storage.putObject({
      key: epubKey,
      body: file.buffer,
      contentType: 'application/epub+zip',
      cacheControl: 'private, no-store',
    });

    await this.prisma.chapter.update({
      where: { id: chapter.id },
      data: {
        contentStatus: ChapterContentStatus.PROCESSING,
        contentKey: epubKey,
        contentUploadedAt: new Date(),
      },
    });

    await this.enqueue({ bookId, chapterId: chapter.id, chapterIndex, epubKey, contentPath });

    return { ok: true, sectionCount: validation.linearSpineCount };
  }

  private async enqueue(data: EpubJobData) {
    if (!this.queue) throw new Error('EPUB queue is not initialized');

    await this.queue.add('convert', data, {
      jobId: `chapter-epub-${data.chapterId}-${data.contentPath}`,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: true,
      removeOnFail: true,
    });
  }

  private async process(job: any) {
    const data: EpubJobData = job.data;
    this.logger.log(`EPUB processing started: chapter=${data.chapterId}, key=${data.epubKey}`);

    let archive: EpubArchiveReader | undefined;

    try {
      const epubBuffer = await this.storage.getObjectBuffer(data.epubKey);

      const currentChapter = await this.prisma.chapter.findUnique({
        where: { id: data.chapterId },
        select: { contentKey: true },
      });

      if (currentChapter?.contentKey !== data.epubKey) {
        this.logger.warn(`Skipping outdated EPUB job for chapter ${data.chapterId}`);
        return;
      }

      const validation = await this.validationService.validateUpload(epubBuffer);
      archive = validation.archive;
      const pkg = validation.pkg;

      const assetsPrefix = `${data.contentPath}/assets`;
      const contentPrefix = `${data.contentPath}/content`;

      const pages: EpubManifestPage[] = [];
      const sectionPathToFirstPageIndex = new Map<string, number>();
      let globalPageNumber = 0;

      const linearSpine = pkg.spine.filter((s) => s.linear);

      for (const spineItem of linearSpine) {
        const manifestItem = pkg.manifestById.get(spineItem.idref);
        if (!manifestItem) continue; // already filtered during OPF parsing, defensive continue

        const xhtmlBuffer = await archive.readEntry(manifestItem.path);
        const sanitized = EpubXhtmlSanitizer.sanitize(
          xhtmlBuffer.toString('utf8'),
          pkg.opfDir,
          manifestItem.path,
        );

        const uploadedImageKeyByPlaceholder = await this.uploadSectionImages(
          archive,
          assetsPrefix,
          sanitized.images,
        );

        const paged = paginateSection(sanitized.nodes, (placeholderId) => {
          const uploaded = uploadedImageKeyByPlaceholder.get(placeholderId);
          return uploaded ? uploaded.key : '';
        });

        sectionPathToFirstPageIndex.set(manifestItem.path, globalPageNumber + 1);

        for (const page of paged.pages) {
          globalPageNumber += 1;

          if (globalPageNumber > MAX_EPUB_PAGES) {
            throw new BadRequestException(`EPUB page limit exceeded; max ${MAX_EPUB_PAGES}`);
          }

          const key = `${contentPrefix}/page_${globalPageNumber}.html`;
          await this.storage.putBuffer(
            key,
            Buffer.from(page.html, 'utf8'),
            'text/html; charset=utf-8',
          );

          pages.push({
            key,
            sectionId: manifestItem.id,
            unitCount: page.unitCount,
            hasImages: page.hasImages,
          });

          await job.updateProgress({ current: globalPageNumber, section: manifestItem.path });
        }
      }

      if (pages.length === 0) {
        throw new BadRequestException('EPUB produced no readable pages');
      }

      const toc = await extractTableOfContents(archive, pkg, sectionPathToFirstPageIndex);

      const manifest = buildEpubManifest(pages, toc);
      await this.storage.putJson(`${data.contentPath}/manifest.json`, manifest);

      await this.prisma.chapter.update({
        where: { id: data.chapterId },
        data: {
          contentStatus: ChapterContentStatus.READY,
          contentType: ChapterContentType.epub,
          contentPath: data.contentPath,
          pageCount: pages.length,
          contentVersion: { increment: 1 },
          contentKey: null,
          contentUploadedAt: null,
        },
      });

      await this.storage.deleteKeys([data.epubKey]);
      await this.readerService.clearChapterManifestCache(data.chapterId);

      this.logger.log(`EPUB processing finished: chapter=${data.chapterId}, pages=${pages.length}`);
    } catch (error) {
      this.logger.error(
        `EPUB processing failed for chapter=${data.chapterId}`,
        error instanceof Error ? error.stack : String(error),
      );
      await this.prisma.chapter.update({
        where: { id: data.chapterId },
        data: {
          contentStatus: ChapterContentStatus.FAILED,
          contentKey: null,
          contentUploadedAt: null,
        },
      });
      throw error;
    } finally {
      archive?.close();
    }
  }

  /**
   * Extracts, validates, re-encodes, and uploads every image discovered in
   * one sanitized section. A single bad image is skipped (logged) rather
   * than failing the whole chapter — light novels can have dozens of
   * illustrations, and one corrupt file shouldn't block the rest.
   */
  private async uploadSectionImages(
    archive: EpubArchiveReader,
    assetsPrefix: string,
    images: DiscoveredImageRef[],
  ): Promise<Map<string, { key: string }>> {
    const result = new Map<string, { key: string }>();

    for (const image of images) {
      try {
        if (!archive.has(image.archivePath)) {
          this.logger.warn(`EPUB image reference not found in archive: ${image.archivePath}`);
          continue;
        }
        const buffer = await archive.readEntry(image.archivePath);
        const uploaded = await processAndUploadEpubImage(this.storage, assetsPrefix, buffer);
        result.set(image.placeholderId, { key: uploaded.key });
      } catch (err) {
        this.logger.warn(`Skipping unprocessable EPUB image ${image.archivePath}: ${String(err)}`);
      }
    }

    return result;
  }
}
