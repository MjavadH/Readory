import { BadRequestException } from '@nestjs/common';
import yazl from 'yazl';
import { EPUB_ARCHIVE_LIMITS, EpubArchiveReader } from './epub-archive.reader';

/** Builds an in-memory zip buffer from a map of path -> content for test fixtures. */
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

describe('EpubArchiveReader', () => {
  it('reads normal entries and lists safe paths', async () => {
    const zip = await buildZip({
      'META-INF/container.xml': '<container/>',
      'OEBPS/chapter1.xhtml': '<html></html>',
    });

    const archive = await EpubArchiveReader.open(zip);
    try {
      expect(archive.has('META-INF/container.xml')).toBe(true);
      expect(archive.has('OEBPS/chapter1.xhtml')).toBe(true);

      const content = await archive.readEntry('OEBPS/chapter1.xhtml');
      expect(content.toString('utf8')).toBe('<html></html>');
    } finally {
      archive.close();
    }
  });

  it('rejects zip-slip path traversal entries at open time', async () => {
    const zip = await buildZip({
      '../../etc/passwd': 'pwned',
      'OEBPS/chapter1.xhtml': '<html></html>',
    });

    await expect(EpubArchiveReader.open(zip)).rejects.toThrow(BadRequestException);
  });

  it('rejects absolute path entries', async () => {
    const zip = await buildZip({
      '/etc/passwd': 'pwned',
    });

    await expect(EpubArchiveReader.open(zip)).rejects.toThrow(BadRequestException);
  });

  it('rejects archives exceeding the max entry count', async () => {
    const files: Record<string, string> = {};
    for (let i = 0; i < EPUB_ARCHIVE_LIMITS.MAX_ENTRIES + 1; i += 1) {
      files[`f${i}.txt`] = 'x';
    }
    const zip = await buildZip(files);

    await expect(EpubArchiveReader.open(zip)).rejects.toThrow(BadRequestException);
  });

  it('rejects a single entry exceeding the max uncompressed size', async () => {
    // A large, highly-compressible buffer to simulate an oversized entry.
    const huge = Buffer.alloc(EPUB_ARCHIVE_LIMITS.MAX_ENTRY_UNCOMPRESSED_BYTES + 1, 'a');
    const zip = await buildZip({ 'big.txt': huge });

    await expect(EpubArchiveReader.open(zip)).rejects.toThrow(BadRequestException);
  });

  it('rejects entries with a suspicious compression ratio (zip-bomb heuristic)', async () => {
    // Highly repetitive content compresses far beyond MAX_COMPRESSION_RATIO.
    const bombContent = Buffer.alloc(5 * 1024 * 1024, 0); // all zeros compress extremely well
    const zip = await buildZip({ 'bomb.txt': bombContent });

    await expect(EpubArchiveReader.open(zip)).rejects.toThrow(BadRequestException);
  });

  it('throws when reading a path that was never in the validated entry list', async () => {
    const zip = await buildZip({ 'OEBPS/chapter1.xhtml': '<html></html>' });
    const archive = await EpubArchiveReader.open(zip);
    try {
      await expect(archive.readEntry('OEBPS/does-not-exist.xhtml')).rejects.toThrow(
        BadRequestException,
      );
    } finally {
      archive.close();
    }
  });

  describe('resolveRelativePath', () => {
    it('resolves a simple relative href against a base directory', () => {
      expect(EpubArchiveReader.resolveRelativePath('OEBPS', 'chapter1.xhtml')).toBe(
        'OEBPS/chapter1.xhtml',
      );
    });

    it('resolves nested relative paths', () => {
      expect(EpubArchiveReader.resolveRelativePath('OEBPS', 'images/cover.jpg')).toBe(
        'OEBPS/images/cover.jpg',
      );
    });

    it('resolves parent-relative paths within the archive', () => {
      expect(EpubArchiveReader.resolveRelativePath('OEBPS/text', '../images/cover.jpg')).toBe(
        'OEBPS/images/cover.jpg',
      );
    });

    it('strips fragments and query strings from hrefs', () => {
      expect(EpubArchiveReader.resolveRelativePath('OEBPS', 'chapter1.xhtml#section2')).toBe(
        'OEBPS/chapter1.xhtml',
      );
    });

    it('throws when a relative path attempts to escape the archive root', () => {
      expect(() => EpubArchiveReader.resolveRelativePath('', '../../etc/passwd')).toThrow(
        BadRequestException,
      );
    });
  });
});
