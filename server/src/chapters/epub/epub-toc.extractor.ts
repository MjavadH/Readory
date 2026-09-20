import { EpubArchiveReader } from './epub-archive.reader';
import { EpubElementNode, EpubNode, isElement, isText } from './epub-ast.types';
import { EpubManifestTocEntry } from './epub-manifest.types';
import { EpubPackageDocument } from './epub-opf.parser';
import { EpubXhtmlSanitizer } from './epub-xhtml.sanitizer';

/**
 * Extracts a flat table of contents from the EPUB3 `nav` document (the
 * manifest item with `properties="nav"`), mapping each nav link's target
 * href to the spine section it points at.
 *
 * This is best-effort: EPUB2-only books (NCX-based, no nav doc) simply get
 * an empty TOC, and any parse failure here is swallowed rather than
 * failing the whole chapter — the reader still works page-by-page without
 * a table of contents.
 */
export async function extractTableOfContents(
  archive: EpubArchiveReader,
  pkg: EpubPackageDocument,
  sectionPathToFirstPageIndex: Map<string, number>,
): Promise<EpubManifestTocEntry[]> {
  try {
    const navItem = [...pkg.manifestById.values()].find((item) => item.properties.includes('nav'));
    if (!navItem) return [];

    const navBuffer = await archive.readEntry(navItem.path);
    const { nodes } = EpubXhtmlSanitizer.sanitize(
      navBuffer.toString('utf8'),
      pkg.opfDir,
      navItem.path,
    );

    const links = collectNavLinks(nodes);
    const navDir = navItem.path.includes('/')
      ? navItem.path.slice(0, navItem.path.lastIndexOf('/'))
      : pkg.opfDir;

    const entries: EpubManifestTocEntry[] = [];
    for (const link of links) {
      let resolvedPath: string;
      try {
        resolvedPath = EpubArchiveReader.resolveRelativePath(navDir, link.href);
      } catch {
        continue;
      }

      const pageIndex = sectionPathToFirstPageIndex.get(resolvedPath);
      if (pageIndex === undefined) continue;

      entries.push({ title: link.title, pageIndex });
    }

    return entries;
  } catch {
    return [];
  }
}

type NavLink = { href: string; title: string };

/** Walks the sanitized nav AST collecting every <a href="..."> with its text content. */
function collectNavLinks(nodes: EpubNode[]): NavLink[] {
  const links: NavLink[] = [];

  const walk = (node: EpubNode) => {
    if (!isElement(node)) return;

    if (node.tag === 'a' && node.attribs.href) {
      links.push({ href: node.attribs.href, title: extractText(node).trim() || node.attribs.href });
    }

    for (const child of node.children) walk(child);
  };

  for (const node of nodes) walk(node);
  return links;
}

function extractText(node: EpubElementNode): string {
  return node.children
    .map((child) => {
      if (isText(child)) return child.text;
      if (isElement(child)) return extractText(child);
      return '';
    })
    .join('');
}
