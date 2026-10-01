import { EpubElementNode, EpubNode, isElement, isText } from './epub-ast.types';

/**
 * Tags that constitute one atomic "block-level unit" for pagination purposes.
 * A unit is never split across pages — the whole subtree rooted at one of
 * these tags moves together.
 */
const BLOCK_UNIT_TAGS = new Set([
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'figure',
  'img', // a bare <img> not wrapped in <figure> is still its own unit
  'table',
  'ul',
  'ol',
  'blockquote',
  'pre',
  'hr',
]);

export type BlockUnitKind = 'text' | 'image' | 'other';

export type BlockUnit = {
  /** The root sanitized node for this unit (kept as a whole subtree, never split). */
  node: EpubElementNode;
  kind: BlockUnitKind;
  /** True if this unit contains at least one <img>, used for manifest metadata (`hasImages`). */
  containsImage: boolean;
};

/**
 * Walks the sanitized AST's top-level children and groups them into
 * indivisible block units. Any root-level text nodes (stray text not wrapped
 * in a recognized block tag — rare after sanitization, but XHTML producers
 * vary) are coalesced into a synthetic paragraph unit so no content is
 * silently dropped.
 */
export function extractBlockUnits(nodes: EpubNode[]): BlockUnit[] {
  const units: BlockUnit[] = [];
  let pendingText: EpubNode[] = [];

  const flushPendingText = () => {
    if (pendingText.length === 0) return;
    const hasNonWhitespace = pendingText.some((n) => isText(n) && n.text.trim().length > 0);
    if (hasNonWhitespace) {
      const syntheticParagraph: EpubElementNode = {
        type: 'element',
        tag: 'p',
        attribs: {},
        children: pendingText,
      };
      units.push({ node: syntheticParagraph, kind: 'text', containsImage: false });
    }
    pendingText = [];
  };

  for (const node of nodes) {
    if (isText(node)) {
      pendingText.push(node);
      continue;
    }

    if (!isElement(node)) continue;

    if (BLOCK_UNIT_TAGS.has(node.tag)) {
      flushPendingText();
      units.push({
        node,
        kind: node.tag === 'img' || node.tag === 'figure' ? 'image' : 'text',
        containsImage: nodeContainsImage(node),
      });
      continue;
    }

    // An allowed inline tag (e.g. <a>, <strong>) appearing at root level,
    // outside any block wrapper — treat it as part of an implicit paragraph
    // rather than dropping it.
    pendingText.push(node);
  }

  flushPendingText();
  return units;
}

function nodeContainsImage(node: EpubElementNode): boolean {
  if (node.tag === 'img') return true;
  return node.children.some((child) => isElement(child) && nodeContainsImage(child));
}
