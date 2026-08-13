import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ChapterContentType } from '@prisma/client';
import DOMPurify from 'isomorphic-dompurify';
import { parse } from 'marked';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ReaderService } from '../reader/reader.service';
import { StorageService } from '../storage/storage.service';
const TEXT_UPLOAD_MAX_FILE_BYTES = 2 * 1024 * 1024;

const TEXT_QUEUE_NAME = 'text-chapters';
const MAX_CHAPTER_PAGES = 300;

type BullQueue = {
  add: (name: string, data: TextJobData, options?: any) => Promise<any>;
  close: () => Promise<void>;
};
type BullWorker = { close: () => Promise<void> };
type TextJobData = {
  bookId: number;
  chapterId: number;
  chapterIndex: number;
  sourceKey: string;
  contentPath: string;
};

@Injectable()
export class TextProcessingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TextProcessingService.name);
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

    this.queue = new bullmq.Queue(TEXT_QUEUE_NAME, { connection });
    this.worker = new bullmq.Worker(TEXT_QUEUE_NAME, (job) => this.process(job), {
      connection,
      concurrency: 2,
    });
    this.logger.log('Text worker initialized');
  }

  async onModuleDestroy() {
    await Promise.all([this.worker?.close(), this.queue?.close()]);
  }

  private escapeHtml(input: string): string {
    return input.replace(
      /[<>&"']/g,
      (char) =>
        ({
          '<': '&lt;',
          '>': '&gt;',
          '&': '&amp;',
          '"': '&quot;',
          "'": '&#39;',
        })[char]!,
    );
  }

  private extractFootnotes(raw: string): { body: string; footnotes: Map<string, string> } {
    const footnotes = new Map<string, string>();
    const bodyLines: string[] = [];
    const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const match = line.match(/^\[\^([^\]\s]+)\]:\s*(.*)$/);

      if (!match) {
        bodyLines.push(line);
        continue;
      }

      const [, id, firstLine] = match;
      const definition = [firstLine];

      while (index + 1 < lines.length && /^(?: {4}|\t)/.test(lines[index + 1])) {
        index += 1;
        definition.push(lines[index].replace(/^(?: {4}|\t)/, ''));
      }

      footnotes.set(id, definition.join('\n').trim());
    }

    return { body: bodyLines.join('\n'), footnotes };
  }

  private splitTextPages(body: string): string[] {
    // Split only on a complete delimiter line containing exactly three dashes.
    return body
      .split(/(?:^|\n)---(?:\n|$)/g)
      .map((page) => page.trim())
      .filter((page) => page.length > 0);
  }

  private injectFootnotes(html: string, footnotes: Map<string, string>): string {
    return html.replace(/\[\^([^\]\s]+)\]/g, (ref, id: string) => {
      const definition = footnotes.get(id);
      if (!definition) return ref;

      const title = this.escapeHtml(definition);
      const label = this.escapeHtml(id);
      return `<abbr class="reader-footnote" title="${title}" aria-label="Footnote ${label}: ${title}">[${label}]</abbr>`;
    });
  }

  private processTextUpload(raw: string): string[] {
    const { body, footnotes } = this.extractFootnotes(raw);
    const pages = this.splitTextPages(body);
    if (pages.length === 0) throw new BadRequestException('Text file has no readable pages');
    if (pages.length > MAX_CHAPTER_PAGES) {
      throw new BadRequestException(`Chapter page limit exceeded; max ${MAX_CHAPTER_PAGES}`);
    }

    return pages.map((page) => {
      const renderedHtml = parse(page, { async: false }) as string;
      const htmlWithFootnotes = this.injectFootnotes(renderedHtml, footnotes);
      const sanitizedHtml = DOMPurify.sanitize(htmlWithFootnotes);
      return `<article>${sanitizedHtml}</article>`;
    });
  }

  async uploadAndQueue(bookId: number, chapterIndex: number, file: Express.Multer.File) {
    if (!file?.buffer || !Buffer.isBuffer(file.buffer)) {
      throw new BadRequestException('Text file is required');
    }
    if ((file.size ?? file.buffer.length) > TEXT_UPLOAD_MAX_FILE_BYTES) {
      throw new BadRequestException('Text file too large');
    }

    const ext = file.originalname.toLowerCase();
    if (!ext.endsWith('.md') && !ext.endsWith('.txt')) {
      throw new BadRequestException('Only .md and .txt supported in MVP');
    }

    const chapter = await this.prisma.chapter.findFirst({
      where: { bookId, index: chapterIndex },
      select: { id: true },
    });
    if (!chapter) throw new NotFoundException('Chapter not found');

    const contentPath = this.chapterVersionPrefix(bookId, chapterIndex);
    const sourceKey = `${contentPath}/source${ext.endsWith('.md') ? '.md' : '.txt'}`;

    await this.storage.putBuffer(sourceKey, file.buffer, 'text/plain; charset=utf-8');
    await this.prisma.chapter.update({
      where: { id: chapter.id },
      data: {
        contentPath: null,
        contentType: null,
        pageCount: 0,
        contentVersion: { increment: 1 },
      },
    });

    await this.enqueue({ bookId, chapterId: chapter.id, chapterIndex, sourceKey, contentPath });
    return { ok: true, queued: true };
  }

  private async enqueue(data: TextJobData) {
    if (!this.queue) throw new Error('Text queue is not initialized');
    await this.queue.add('process', data, {
      jobId: `chapter-text-${data.chapterId}`,
      attempts: 3,
      backoff: { type: 'exponential', delay: 3000 },
    });
  }

  private async process(job: any) {
    const data = job.data as TextJobData;
    this.logger.log(`Text processing started: chapter=${data.chapterId}, key=${data.sourceKey}`);

    try {
      const source = await this.storage.getObjectBuffer(data.sourceKey);
      const currentChapter = await this.prisma.chapter.findUnique({
        where: { id: data.chapterId },
        select: { contentPath: true, contentType: true },
      });
      if (currentChapter?.contentPath && currentChapter.contentPath !== data.contentPath) return;

      const htmlPages = this.processTextUpload(source.toString('utf8'));
      const pages = [] as Array<{ key: string }>;

      for (let index = 0; index < htmlPages.length; index += 1) {
        const key = `${data.contentPath}/content/page_${index + 1}.html`;
        await this.storage.putBuffer(
          key,
          Buffer.from(htmlPages[index], 'utf8'),
          'text/html; charset=utf-8',
        );
        pages.push({ key });
        await job.updateProgress({ current: index + 1, total: htmlPages.length });
      }

      await this.storage.putJson(
        `${data.contentPath}/manifest.json`,
        this.readerService.buildManifest('text', pages),
      );
      await this.prisma.chapter.update({
        where: { id: data.chapterId },
        data: {
          contentPath: data.contentPath,
          contentType: ChapterContentType.text,
          pageCount: pages.length,
        },
      });
      await this.storage.deleteKeys([data.sourceKey]);
      await this.readerService.clearChapterManifestCache(data.chapterId);
    } catch (error) {
      this.logger.error(
        `Text processing failed for chapter=${data.chapterId}`,
        error instanceof Error ? error.stack : String(error),
      );
      await this.prisma.chapter.update({
        where: { id: data.chapterId },
        data: { contentType: null, contentPath: null, pageCount: 0 },
      });
      throw error;
    }
  }
}
