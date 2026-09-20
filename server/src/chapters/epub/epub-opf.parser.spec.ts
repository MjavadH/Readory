import { BadRequestException } from '@nestjs/common';
import yazl from 'yazl';
import { EpubArchiveReader } from './epub-archive.reader';
import { EpubOpfParser } from './epub-opf.parser';

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

function buildOpf(opts: {
  items: Array<{ id: string; href: string; mediaType: string; properties?: string }>;
  spine: Array<{ idref: string; linear?: string }>;
}) {
  const items = opts.items
    .map(
      (i) =>
        `<item id="${i.id}" href="${i.href}" media-type="${i.mediaType}"${
          i.properties ? ` properties="${i.properties}"` : ''
        }/>`,
    )
    .join('\n');
  const spine = opts.spine
    .map((s) => `<itemref idref="${s.idref}"${s.linear ? ` linear="${s.linear}"` : ''}/>`)
    .join('\n');

  return `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata>
    <dc:title xmlns:dc="http://purl.org/dc/elements/1.1/">Test Book</dc:title>
    <dc:language xmlns:dc="http://purl.org/dc/elements/1.1/">en</dc:language>
  </metadata>
  <manifest>
    ${items}
  </manifest>
  <spine>
    ${spine}
  </spine>
</package>`;
}

async function buildBasicEpub() {
  const opf = buildOpf({
    items: [
      { id: 'ch1', href: 'chapter1.xhtml', mediaType: 'application/xhtml+xml' },
      { id: 'ch2', href: 'chapter2.xhtml', mediaType: 'application/xhtml+xml' },
      { id: 'img1', href: 'images/pic.jpg', mediaType: 'image/jpeg' },
      { id: 'nav', href: 'nav.xhtml', mediaType: 'application/xhtml+xml', properties: 'nav' },
    ],
    spine: [{ idref: 'ch1' }, { idref: 'ch2' }],
  });

  return buildZip({
    'META-INF/container.xml': CONTAINER_XML,
    'OEBPS/content.opf': opf,
    'OEBPS/chapter1.xhtml': '<html><body><p>Hello</p></body></html>',
    'OEBPS/chapter2.xhtml': '<html><body><p>World</p></body></html>',
    'OEBPS/nav.xhtml': '<html><body><nav/></body></html>',
    'OEBPS/images/pic.jpg': Buffer.from([0xff, 0xd8, 0xff]),
  });
}

describe('EpubOpfParser', () => {
  it('parses a well-formed EPUB into manifest + spine', async () => {
    const zip = await buildBasicEpub();
    const archive = await EpubArchiveReader.open(zip);
    try {
      const pkg = await EpubOpfParser.parse(archive);

      expect(pkg.opfDir).toBe('OEBPS');
      expect(pkg.title).toBe('Test Book');
      expect(pkg.language).toBe('en');

      expect(pkg.manifestById.get('ch1')?.path).toBe('OEBPS/chapter1.xhtml');
      expect(pkg.manifestById.get('img1')?.path).toBe('OEBPS/images/pic.jpg');
      expect(pkg.manifestById.get('nav')?.properties).toContain('nav');

      expect(pkg.spine.map((s) => s.idref)).toEqual(['ch1', 'ch2']);
      expect(pkg.spine.every((s) => s.linear)).toBe(true);
    } finally {
      archive.close();
    }
  });

  it('respects linear="no" on spine items', async () => {
    const opf = buildOpf({
      items: [
        { id: 'ch1', href: 'chapter1.xhtml', mediaType: 'application/xhtml+xml' },
        { id: 'notes', href: 'notes.xhtml', mediaType: 'application/xhtml+xml' },
      ],
      spine: [{ idref: 'ch1' }, { idref: 'notes', linear: 'no' }],
    });

    const zip = await buildZip({
      'META-INF/container.xml': CONTAINER_XML,
      'OEBPS/content.opf': opf,
      'OEBPS/chapter1.xhtml': '<html></html>',
      'OEBPS/notes.xhtml': '<html></html>',
    });

    const archive = await EpubArchiveReader.open(zip);
    try {
      const pkg = await EpubOpfParser.parse(archive);
      const notesItem = pkg.spine.find((s) => s.idref === 'notes');
      expect(notesItem?.linear).toBe(false);
    } finally {
      archive.close();
    }
  });

  it('throws when container.xml is missing', async () => {
    const zip = await buildZip({ 'OEBPS/content.opf': buildOpf({ items: [], spine: [] }) });
    const archive = await EpubArchiveReader.open(zip);
    try {
      await expect(EpubOpfParser.parse(archive)).rejects.toThrow(BadRequestException);
    } finally {
      archive.close();
    }
  });

  it('throws when the OPF referenced by container.xml does not exist in the archive', async () => {
    const zip = await buildZip({ 'META-INF/container.xml': CONTAINER_XML });
    const archive = await EpubArchiveReader.open(zip);
    try {
      await expect(EpubOpfParser.parse(archive)).rejects.toThrow(BadRequestException);
    } finally {
      archive.close();
    }
  });

  it('throws when container.xml points the OPF path outside the archive root', async () => {
    const maliciousContainer = `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="../../etc/passwd" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;

    const zip = await buildZip({ 'META-INF/container.xml': maliciousContainer });
    const archive = await EpubArchiveReader.open(zip);
    try {
      await expect(EpubOpfParser.parse(archive)).rejects.toThrow(BadRequestException);
    } finally {
      archive.close();
    }
  });

  it('drops manifest items whose href resolves outside the archive root instead of following them', async () => {
    const opf = buildOpf({
      items: [
        { id: 'ch1', href: 'chapter1.xhtml', mediaType: 'application/xhtml+xml' },
        { id: 'evil', href: '../../etc/passwd', mediaType: 'text/plain' },
      ],
      spine: [{ idref: 'ch1' }],
    });

    const zip = await buildZip({
      'META-INF/container.xml': CONTAINER_XML,
      'OEBPS/content.opf': opf,
      'OEBPS/chapter1.xhtml': '<html></html>',
    });

    const archive = await EpubArchiveReader.open(zip);
    try {
      const pkg = await EpubOpfParser.parse(archive);
      expect(pkg.manifestById.has('evil')).toBe(false);
      expect(pkg.manifestById.has('ch1')).toBe(true);
    } finally {
      archive.close();
    }
  });

  it('drops manifest items referencing files that do not exist in the archive', async () => {
    const opf = buildOpf({
      items: [
        { id: 'ch1', href: 'chapter1.xhtml', mediaType: 'application/xhtml+xml' },
        { id: 'ghost', href: 'ghost.xhtml', mediaType: 'application/xhtml+xml' },
      ],
      spine: [{ idref: 'ch1' }],
    });

    const zip = await buildZip({
      'META-INF/container.xml': CONTAINER_XML,
      'OEBPS/content.opf': opf,
      'OEBPS/chapter1.xhtml': '<html></html>',
    });

    const archive = await EpubArchiveReader.open(zip);
    try {
      const pkg = await EpubOpfParser.parse(archive);
      expect(pkg.manifestById.has('ghost')).toBe(false);
    } finally {
      archive.close();
    }
  });

  it('throws when manifest has no items', async () => {
    const opf = buildOpf({ items: [], spine: [] });
    const zip = await buildZip({
      'META-INF/container.xml': CONTAINER_XML,
      'OEBPS/content.opf': opf,
    });

    const archive = await EpubArchiveReader.open(zip);
    try {
      await expect(EpubOpfParser.parse(archive)).rejects.toThrow(BadRequestException);
    } finally {
      archive.close();
    }
  });

  it('throws when spine has no valid itemref entries', async () => {
    const opf = buildOpf({
      items: [{ id: 'ch1', href: 'chapter1.xhtml', mediaType: 'application/xhtml+xml' }],
      spine: [{ idref: 'nonexistent' }],
    });

    const zip = await buildZip({
      'META-INF/container.xml': CONTAINER_XML,
      'OEBPS/content.opf': opf,
      'OEBPS/chapter1.xhtml': '<html></html>',
    });

    const archive = await EpubArchiveReader.open(zip);
    try {
      await expect(EpubOpfParser.parse(archive)).rejects.toThrow(BadRequestException);
    } finally {
      archive.close();
    }
  });

  it('does not attempt to resolve external entities in malicious XML (XXE)', async () => {
    const xxeContainer = `<?xml version="1.0"?>
<!DOCTYPE container [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="&xxe;" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;

    const zip = await buildZip({ 'META-INF/container.xml': xxeContainer });
    const archive = await EpubArchiveReader.open(zip);
    try {
      // Whatever happens, the parser must never actually read /etc/passwd or
      // succeed in resolving it as a valid OPF path — it should safely fail.
      await expect(EpubOpfParser.parse(archive)).rejects.toThrow(BadRequestException);
    } finally {
      archive.close();
    }
  });
});
