/**
 * A minimal, serializable DOM-like tree produced by the EPUB XHTML sanitizer.
 * This is intentionally small — only what's needed to rebuild safe HTML pages
 * and to let the splitter (next step) walk block-level structure.
 */
export type EpubNode = EpubElementNode | EpubTextNode;

export type EpubElementNode = {
  type: 'element';
  tag: string;
  /** Already-sanitized, allow-listed attributes only. */
  attribs: Record<string, string>;
  children: EpubNode[];
};

export type EpubTextNode = {
  type: 'text';
  text: string;
};

export function isElement(node: EpubNode): node is EpubElementNode {
  return node.type === 'element';
}

export function isText(node: EpubNode): node is EpubTextNode {
  return node.type === 'text';
}

/** A single image reference discovered while sanitizing a section, queued for extraction/upload. */
export type DiscoveredImageRef = {
  /** The original href as it appeared in the XHTML (resolved to an archive-relative path). */
  archivePath: string;
  /** Stable placeholder id injected into the sanitized tree's element attrib, replaced post-upload. */
  placeholderId: string;
};

export type SanitizedSection = {
  /** Root-level sanitized nodes (i.e. contents of <body>), in document order. */
  nodes: EpubNode[];
  images: DiscoveredImageRef[];
};
