import { createHash } from 'node:crypto';
import { EpubNode, isElement } from './epub-ast.types';
import { extractBlockUnits } from './epub-block.extractor';
import { serializeEpubNodes } from './epub-html.serializer';
import { DEFAULT_SPLIT_CONFIG, SplitConfig, splitIntoPages } from './epub-page.splitter';

export type PagedSectionPage = {
  /** Final sanitized HTML for this page, with images resolved via resolveImageSrc. */
  html: string;
  unitCount: number;
  hasImages: boolean;
};

export type PagedSection = {
  pages: PagedSectionPage[];
};

/**
 * Takes a sanitized section's root nodes and produces final, paginated HTML
 * pages ready for storage. Each block unit gets a stable `data-unit-id`
 * derived from a hash of its own serialized content (not its position),
 * so that user-side notes/marks anchored to a unit remain valid across
 * reprocessing even if page boundaries shift.
 */
export function paginateSection(
  nodes: EpubNode[],
  resolveImageSrc: (placeholderId: string) => string,
  config: SplitConfig = DEFAULT_SPLIT_CONFIG,
): PagedSection {
  const units = extractBlockUnits(nodes);
  const pages = splitIntoPages(units, config);

  const pagedPages: PagedSectionPage[] = pages.map((page) => {
    const annotatedNodes = page.units.map((unit) => withStableUnitId(unit.node, resolveImageSrc));
    const html = serializeEpubNodes(annotatedNodes, resolveImageSrc);

    return {
      html,
      unitCount: page.units.length,
      hasImages: page.hasImages,
    };
  });

  return { pages: pagedPages };
}

/**
 * Returns a copy of the unit's root node with a `data-unit-id` attribute
 * set to a stable hash of its own sanitized content. The hash is computed
 * from the unit's serialized HTML using a placeholder-invariant resolver
 * (image placeholders, not final asset keys) so the id doesn't change if
 * the same book is reprocessed and assets happen to land at different keys.
 */
function withStableUnitId(
  node: EpubNode,
  _resolveImageSrc: (placeholderId: string) => string,
): EpubNode {
  if (!isElement(node)) return node;

  // Hash based on placeholder ids (stable per-source-image-reference),
  // not on final resolved asset URLs, so the id is a pure function of
  // the sanitized source content.
  const contentForHash = serializeEpubNodes([node], (placeholderId) => placeholderId);
  const hash = createHash('sha256').update(contentForHash).digest('hex').slice(0, 16);

  return {
    ...node,
    attribs: { ...node.attribs, 'data-unit-id': `u-${hash}` },
  };
}
