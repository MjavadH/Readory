import { Readable } from 'node:stream';
import { BadRequestException } from '@nestjs/common';
import yauzl from 'yauzl';

/**
 * Hard limits applied while reading an uploaded .epub archive.
 * These exist purely for safety (zip-bomb / resource-exhaustion protection)
 * and are intentionally generous for legitimate light-novel-sized EPUBs.
 */
export const EPUB_ARCHIVE_LIMITS = {
  /** Max number of entries allowed in the zip, regardless of type. */
  MAX_ENTRIES: 5000,
  /** Max uncompressed size of any single entry (bytes). Covers XHTML and image entries. */
  MAX_ENTRY_UNCOMPRESSED_BYTES: 20 * 1024 * 1024, // 20MB
  /** Max total uncompressed size across all entries combined (bytes). */
  MAX_TOTAL_UNCOMPRESSED_BYTES: 300 * 1024 * 1024, // 300MB
  /**
   * Reject entries whose declared compression ratio looks like a bomb
   * (uncompressed / compressed). Legitimate text/image data rarely exceeds ~40x;
   * this is a defense-in-depth check in addition to the absolute size caps above.
   */
  MAX_COMPRESSION_RATIO: 100,
} as const;

export type EpubArchiveEntry = {
  /** Normalized, safety-checked path inside the archive (forward slashes, no leading slash). */
  path: string;
  uncompressedSize: number;
};

/**
 * A safety-hardened, read-only view over an EPUB (zip) archive buffer.
 *
 * Guarantees:
 * - No entry path can escape the archive root (zip-slip).
 * - No entry can be absolute or contain a null byte.
 * - Aggregate and per-entry uncompressed size are bounded (zip-bomb).
 * - Only entries explicitly requested by a caller are ever inflated into memory;
 *   listing the archive does not decompress anything.
 */
export class EpubArchiveReader {
  private constructor(
    private readonly zipfile: yauzl.ZipFile,
    private readonly entriesByPath: Map<string, yauzl.Entry>,
  ) {}

  static async open(buffer: Buffer): Promise<EpubArchiveReader> {
    const zipfile = await new Promise<yauzl.ZipFile>((resolve, reject) => {
      yauzl.fromBuffer(
        buffer,
        // strictFileNames is intentionally left off: it makes yauzl throw on
        // backslashes instead of letting us normalize/reject them ourselves
        // with a clear BadRequestException below.
        { lazyEntries: true, validateEntrySizes: true },
        (err, zf) => {
          if (err || !zf) return reject(new BadRequestException('Invalid EPUB (not a valid zip)'));
          resolve(zf);
        },
      );
    });

    const entriesByPath = new Map<string, yauzl.Entry>();
    let totalUncompressed = 0;
    let count = 0;

    await new Promise<void>((resolve, reject) => {
      zipfile.on('entry', (entry: yauzl.Entry) => {
        try {
          count += 1;
          if (count > EPUB_ARCHIVE_LIMITS.MAX_ENTRIES) {
            throw new BadRequestException('EPUB has too many archive entries');
          }

          // Directory entries (trailing slash) carry no content; skip safely.
          const isDirectory = /\/$/.test(entry.fileName);

          const safePath = EpubArchiveReader.validateAndNormalizePath(entry.fileName);

          if (!isDirectory) {
            const size = entry.uncompressedSize;

            if (size > EPUB_ARCHIVE_LIMITS.MAX_ENTRY_UNCOMPRESSED_BYTES) {
              throw new BadRequestException(`EPUB entry too large: ${safePath}`);
            }

            const compressed = Math.max(entry.compressedSize, 1);
            const ratio = size / compressed;
            if (ratio > EPUB_ARCHIVE_LIMITS.MAX_COMPRESSION_RATIO) {
              throw new BadRequestException(`EPUB entry failed safety check: ${safePath}`);
            }

            totalUncompressed += size;
            if (totalUncompressed > EPUB_ARCHIVE_LIMITS.MAX_TOTAL_UNCOMPRESSED_BYTES) {
              throw new BadRequestException('EPUB exceeds total uncompressed size limit');
            }

            entriesByPath.set(safePath, entry);
          }

          zipfile.readEntry();
        } catch (err) {
          zipfile.close();
          reject(err);
        }
      });

      zipfile.on('end', () => resolve());
      zipfile.on('error', (err) => reject(new BadRequestException(`Invalid EPUB: ${String(err)}`)));

      zipfile.readEntry();
    });

    return new EpubArchiveReader(zipfile, entriesByPath);
  }

  /**
   * Validates a raw zip entry path and returns a normalized, safe relative path.
   * Throws if the path could escape the archive root or contains disallowed characters.
   */
  private static validateAndNormalizePath(rawPath: string): string {
    if (!rawPath || rawPath.includes('\0')) {
      throw new BadRequestException('Invalid EPUB entry path');
    }

    // Normalize backslashes (defensive; zip spec mandates forward slashes but be safe).
    const normalized = rawPath.replace(/\\/g, '/');

    if (normalized.startsWith('/') || /^[a-zA-Z]:/.test(normalized)) {
      throw new BadRequestException('Invalid EPUB entry path (absolute path)');
    }

    const segments = normalized.split('/');
    if (segments.some((seg) => seg === '..')) {
      throw new BadRequestException('Invalid EPUB entry path (path traversal)');
    }
    if (segments.some((seg) => seg === '.')) {
      // harmless but pointless; strip below
    }

    const cleaned = segments.filter((seg) => seg !== '.' && seg.length > 0).join('/');
    if (!cleaned) {
      throw new BadRequestException('Invalid EPUB entry path (empty)');
    }

    return cleaned;
  }

  /** True if the given normalized path exists in the archive. */
  has(path: string): boolean {
    return this.entriesByPath.has(EpubArchiveReader.normalizeLookupPath(path));
  }

  /** List all safe, normalized entry paths (does not decompress anything). */
  listPaths(): EpubArchiveEntry[] {
    return [...this.entriesByPath.entries()].map(([path, entry]) => ({
      path,
      uncompressedSize: entry.uncompressedSize,
    }));
  }

  /**
   * Reads and fully inflates a single entry by its normalized path.
   * Only paths that were present in the original entry listing (and thus
   * already passed size/ratio validation) can be read — this is the
   * allow-list enforcement point for OPF-driven access.
   */
  async readEntry(path: string): Promise<Buffer> {
    const lookupPath = EpubArchiveReader.normalizeLookupPath(path);
    const entry = this.entriesByPath.get(lookupPath);
    if (!entry) {
      throw new BadRequestException(`EPUB entry not found: ${path}`);
    }

    const stream = await new Promise<Readable>((resolve, reject) => {
      this.zipfile.openReadStream(entry, (err, s) => {
        if (err || !s) return reject(new BadRequestException(`Failed to read EPUB entry: ${path}`));
        resolve(s);
      });
    });

    const chunks: Buffer[] = [];
    let total = 0;

    for await (const chunk of stream) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += buf.length;
      // Defense in depth: re-check during streaming in case declared size lied.
      if (total > EPUB_ARCHIVE_LIMITS.MAX_ENTRY_UNCOMPRESSED_BYTES) {
        stream.destroy();
        throw new BadRequestException(`EPUB entry exceeded size limit while reading: ${path}`);
      }
      chunks.push(buf);
    }

    return Buffer.concat(chunks);
  }

  /** Resolves a relative reference (e.g. from OPF href) against a base directory inside the archive. */
  static resolveRelativePath(baseDir: string, relativeHref: string): string {
    // Strip any URL fragment/query that might be present in an href.
    const withoutFragment = relativeHref.split('#')[0].split('?')[0];
    const decoded = safeDecodeURIComponent(withoutFragment);

    const baseSegments = baseDir.split('/').filter(Boolean);
    const relSegments = decoded.replace(/\\/g, '/').split('/');

    const stack = [...baseSegments];
    for (const seg of relSegments) {
      if (seg === '' || seg === '.') continue;
      if (seg === '..') {
        if (stack.length === 0) {
          throw new BadRequestException('Invalid EPUB relative path (escapes root)');
        }
        stack.pop();
        continue;
      }
      stack.push(seg);
    }

    return stack.join('/');
  }

  private static normalizeLookupPath(path: string): string {
    return path.replace(/\\/g, '/').replace(/^\/+/, '');
  }

  close(): void {
    try {
      this.zipfile.close();
    } catch {
      // already closed; ignore
    }
  }
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
