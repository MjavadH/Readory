import { BadRequestException } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import { EpubArchiveReader } from './epub-archive.reader';

const CONTAINER_PATH = 'META-INF/container.xml';

export type EpubManifestItem = {
  id: string;
  /** Path inside the archive, resolved relative to the OPF directory. */
  path: string;
  mediaType: string;
  /** Raw `properties` attribute (e.g. "nav", "cover-image"), space-separated. */
  properties: string[];
};

export type EpubSpineItem = {
  idref: string;
  /** Defaults to true per the OPF spec when `linear` is omitted. */
  linear: boolean;
};

export type EpubPackageDocument = {
  /** Directory (inside the archive) containing the OPF file; hrefs are relative to this. */
  opfDir: string;
  manifestById: Map<string, EpubManifestItem>;
  spine: EpubSpineItem[];
  title: string | null;
  language: string | null;
};

/**
 * XML parser configuration hardened against XXE and entity-expansion attacks:
 * - fast-xml-parser does not resolve external entities or DTDs by design
 *   (it has no DTD-processing subsystem), but we still disable anything
 *   that could interpret embedded doctype declarations.
 * - processEntities is limited to the built-in XML entities only.
 */
function createSafeXmlParser(): XMLParser {
  return new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    allowBooleanAttributes: true,
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: true,
    processEntities: true, // only standard XML entities (&amp; etc.) — no DTD support exists in this parser
    htmlEntities: false,
    stopNodes: [], // never treat any node as raw/unparsed passthrough
  });
}

function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

export class EpubOpfParser {
  /**
   * Locates and parses the OPF package document referenced by container.xml,
   * returning a normalized manifest + spine. Only ever reads two archive
   * entries by design: container.xml and the single OPF file it points to.
   */
  static async parse(archive: EpubArchiveReader): Promise<EpubPackageDocument> {
    const opfPath = await this.resolveOpfPath(archive);
    const opfBuffer = await archive.readEntry(opfPath);
    const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/')) : '';

    const parser = createSafeXmlParser();
    let parsed: any;
    try {
      parsed = parser.parse(opfBuffer.toString('utf8'));
    } catch {
      throw new BadRequestException('Invalid EPUB: malformed OPF package document');
    }

    const pkg = parsed?.package;
    if (!pkg) {
      throw new BadRequestException('Invalid EPUB: missing <package> root in OPF');
    }

    const manifestById = this.parseManifest(pkg, archive, opfDir);
    const spine = this.parseSpine(pkg, manifestById);
    const { title, language } = this.parseMetadata(pkg);

    return { opfDir, manifestById, spine, title, language };
  }

  private static async resolveOpfPath(archive: EpubArchiveReader): Promise<string> {
    if (!archive.has(CONTAINER_PATH)) {
      throw new BadRequestException('Invalid EPUB: missing META-INF/container.xml');
    }

    const containerBuffer = await archive.readEntry(CONTAINER_PATH);
    const parser = createSafeXmlParser();

    let parsed: any;
    try {
      parsed = parser.parse(containerBuffer.toString('utf8'));
    } catch {
      throw new BadRequestException('Invalid EPUB: malformed container.xml');
    }

    const rootfiles = toArray(parsed?.container?.rootfiles?.rootfile);
    const opfEntry = rootfiles.find(
      (rf: any) => rf?.['@_media-type'] === 'application/oebps-package+xml',
    );
    const fullPath: string | undefined = opfEntry?.['@_full-path'];

    if (!fullPath) {
      throw new BadRequestException('Invalid EPUB: no OPF rootfile declared in container.xml');
    }

    const normalized = EpubArchiveReader.resolveRelativePath('', fullPath);

    if (!archive.has(normalized)) {
      throw new BadRequestException('Invalid EPUB: declared OPF file not found in archive');
    }

    return normalized;
  }

  private static parseManifest(
    pkg: any,
    archive: EpubArchiveReader,
    opfDir: string,
  ): Map<string, EpubManifestItem> {
    const items = toArray(pkg?.manifest?.item);
    if (items.length === 0) {
      throw new BadRequestException('Invalid EPUB: manifest has no items');
    }

    const manifestById = new Map<string, EpubManifestItem>();

    for (const raw of items) {
      const id: string | undefined = raw?.['@_id'];
      const href: string | undefined = raw?.['@_href'];
      const mediaType: string | undefined = raw?.['@_media-type'];

      if (!id || !href || !mediaType) {
        // Skip malformed manifest entries rather than failing the whole book;
        // they simply won't be reachable via id lookup.
        continue;
      }

      let resolvedPath: string;
      try {
        resolvedPath = EpubArchiveReader.resolveRelativePath(opfDir, href);
      } catch {
        continue; // path escapes archive root; drop the entry, never follow it
      }

      // Enforce allow-list: the manifest may only reference files that actually
      // exist in the archive. Anything else is ignored (never fetched).
      if (!archive.has(resolvedPath)) {
        continue;
      }

      const propertiesRaw: string = raw?.['@_properties'] ?? '';
      const properties = propertiesRaw.split(/\s+/).filter(Boolean);

      manifestById.set(id, {
        id,
        path: resolvedPath,
        mediaType,
        properties,
      });
    }

    return manifestById;
  }

  private static parseSpine(
    pkg: any,
    manifestById: Map<string, EpubManifestItem>,
  ): EpubSpineItem[] {
    const itemrefs = toArray(pkg?.spine?.itemref);
    if (itemrefs.length === 0) {
      throw new BadRequestException('Invalid EPUB: spine has no itemref entries');
    }

    const spine: EpubSpineItem[] = [];

    for (const raw of itemrefs) {
      const idref: string | undefined = raw?.['@_idref'];
      if (!idref || !manifestById.has(idref)) {
        // A spine entry pointing at a nonexistent/unreachable manifest item
        // is dropped rather than failing the whole book.
        continue;
      }

      const linearAttr: string | undefined = raw?.['@_linear'];
      const linear = linearAttr !== 'no';

      spine.push({ idref, linear });
    }

    if (spine.length === 0) {
      throw new BadRequestException('Invalid EPUB: no readable spine entries after validation');
    }

    return spine;
  }

  private static parseMetadata(pkg: any): { title: string | null; language: string | null } {
    const metadata = pkg?.metadata ?? {};
    const titleRaw = toArray(metadata['dc:title'])[0];
    const langRaw = toArray(metadata['dc:language'])[0];

    const title = typeof titleRaw === 'string' ? titleRaw : (titleRaw?.['#text'] ?? null);
    const language = typeof langRaw === 'string' ? langRaw : (langRaw?.['#text'] ?? null);

    return { title: title ?? null, language: language ?? null };
  }
}
