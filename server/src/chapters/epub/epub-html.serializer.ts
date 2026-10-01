import { EpubElementNode, EpubNode, isElement, isText } from './epub-ast.types';

const VOID_TAGS = new Set(['br', 'hr', 'img']);

function escapeHtmlText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttributeValue(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Serializes a sanitized AST (see EpubXhtmlSanitizer) into a safe HTML
 * string. `resolveImageSrc` maps the placeholder id injected during
 * sanitization to the final, uploaded asset URL/key — this indirection lets
 * sanitization happen before image upload keys are known.
 */
export function serializeEpubNodes(
  nodes: EpubNode[],
  resolveImageSrc: (placeholderId: string) => string,
): string {
  return nodes.map((node) => serializeNode(node, resolveImageSrc)).join('');
}

function serializeNode(node: EpubNode, resolveImageSrc: (placeholderId: string) => string): string {
  if (isText(node)) {
    return escapeHtmlText(node.text);
  }

  if (isElement(node)) {
    return serializeElement(node, resolveImageSrc);
  }

  return '';
}

function serializeElement(
  node: EpubElementNode,
  resolveImageSrc: (placeholderId: string) => string,
): string {
  const attribs = { ...node.attribs };

  if (node.tag === 'img') {
    const placeholderId = attribs['data-epub-src-placeholder'];
    delete attribs['data-epub-src-placeholder'];
    if (placeholderId) {
      attribs.src = resolveImageSrc(placeholderId);
    }
    attribs.loading = 'lazy';
  }

  const attrString = Object.entries(attribs)
    .map(([name, value]) => ` ${name}="${escapeAttributeValue(value)}"`)
    .join('');

  if (VOID_TAGS.has(node.tag)) {
    return `<${node.tag}${attrString} />`;
  }

  const inner = node.children.map((child) => serializeNode(child, resolveImageSrc)).join('');
  return `<${node.tag}${attrString}>${inner}</${node.tag}>`;
}
