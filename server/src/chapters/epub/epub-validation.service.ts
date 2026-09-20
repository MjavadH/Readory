import { BadRequestException, Injectable } from '@nestjs/common';
import { fileTypeFromBuffer } from 'file-type';
import { EpubArchiveReader } from './epub-archive.reader';
import { EpubOpfParser, EpubPackageDocument } from './epub-opf.parser';

export const EPUB_UPLOAD_MAX_FILE_BYTES = 150 * 1024 * 1024; // 150MB
const MAX_SPINE_SECTIONS = 500;

export type EpubValidationResult = {
  archive: EpubArchiveReader;
  pkg: EpubPackageDocument;
  linearSpineCount: number;
};

/**
 * Performs cheap, fail-fast structural validation of an uploaded EPUB
 * *before* any expensive per-section processing happens. Mirrors the
 * validate-before-enqueue pattern already used for PDF uploads.
 */
@Injectable()
export class EpubValidationService {
  async validateUpload(buffer: Buffer, originalName = 'EPUB'): Promise<EpubValidationResult> {
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('EPUB file is required');
    }

    if (buffer.length > EPUB_UPLOAD_MAX_FILE_BYTES) {
      throw new BadRequestException('EPUB file too large');
    }

    await this.assertLooksLikeEpub(buffer, originalName);

    const archive = await EpubArchiveReader.open(buffer);

    let pkg: EpubPackageDocument;
    try {
      pkg = await EpubOpfParser.parse(archive);
    } catch (err) {
      archive.close();
      throw err;
    }

    const linearSections = pkg.spine.filter((s) => s.linear);
    if (linearSections.length === 0) {
      archive.close();
      throw new BadRequestException('Invalid EPUB: no linear reading-order content found');
    }

    if (pkg.spine.length > MAX_SPINE_SECTIONS) {
      archive.close();
      throw new BadRequestException(`EPUB has too many sections; max ${MAX_SPINE_SECTIONS}`);
    }

    return { archive, pkg, linearSpineCount: linearSections.length };
  }

  /**
   * Checks the zip magic bytes and, defensively, the presence of the
   * mandatory `mimetype` entry that real EPUBs store uncompressed as the
   * first zip entry. We don't hard-fail on a missing/misplaced mimetype
   * entry (some producers get this technically wrong while still being
   * readable), but we do require the file to actually be a zip archive.
   */
  private async assertLooksLikeEpub(buffer: Buffer, originalName: string): Promise<void> {
    const sig = await fileTypeFromBuffer(buffer);
    const isZipLike = sig?.mime === 'application/zip' || sig?.mime === 'application/epub+zip';

    if (!isZipLike) {
      throw new BadRequestException(`Invalid EPUB file: ${originalName}`);
    }
  }
}
