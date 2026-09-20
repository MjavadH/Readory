import { randomUUID } from 'node:crypto';
import { Parser } from 'htmlparser2';
import { EpubArchiveReader } from './epub-archive.reader';
import type {
  DiscoveredImageRef,
  EpubElementNode,
  EpubNode,
  SanitizedSection,
} from './epub-ast.types';

/**
 * Tags that are stripped ENTIRELY, along with all of their content.
 * These are the categories explicitly called out as unsafe: script execution,
 * form submission, embedded external content, and styling that could carry
 * custom fonts or CSS-based attacks.
 */
const STRIPPED_TAGS_WITH_CONTENT = new Set([
  'script',
  'form',
  'iframe',
  'object',
  'embed',
  'style',
  'applet',
  'link', // covers <link rel="stylesheet"> and any custom @font-face sheet references
  'meta',
  'title',
  'head',
  'base',
  'noscript',
]);

/**
 * Tags whose own opening/closing markup is dropped but whose *children*
 * are preserved and re-parented into the surrounding content. Used for
 * structural/legacy wrapper tags that don't carry unsafe behavior but also
 * aren't part of our target output vocabulary.
 */
const UNWRAP_TAGS = new Set(['html', 'body', 'section', 'article', 'main', 'div', 'span']);

/**
 * The only tags allowed to survive into sanitized output, beyond the
 * unwrap/strip sets above. Anything not in either set and not here is
 * dropped (content preserved as text-only, wrapper discarded) — see
 * `DEFAULT_UNKNOWN_TAG_BEHAVIOR` below.
 */
const ALLOWED_TAGS = new Set([
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'sub',
  'sup',
  'br',
  'hr',
  'ul',
  'ol',
  'li',
  'blockquote',
  'pre',
  'code',
  'table',
  'thead',
  'tbody',
  'tr',
  'td',
  'th',
  'figure',
  'figcaption',
  'img',
  'a',
  'abbr',
]);

/** Attributes allowed per-tag. Everything else on any tag is dropped. */
const ALLOWED_ATTRIBUTES_BY_TAG: Record<string, Set<string>> = {
  img: new Set(['alt']), // data-epub-src-placeholder is set internally only, never from source attribs
  a: new Set(['href', 'id']),
  abbr: new Set(['title']),
  '*': new Set(['id', 'class']), // id/class allowed on any surviving tag, further filtered below
};

/**
 * Allow-listed semantic class names. Anything else in a `class` attribute
 * is dropped; classes are never passed through verbatim from source CSS.
 */
const ALLOWED_CLASS_NAMES = new Set([
  'italic',
  'bold',
  'center',
  'right',
  'small-caps',
  'footnote',
  'epigraph',
  'verse',
]);

const IMAGE_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function isEventHandlerAttr(name: string): boolean {
  return /^on/i.test(name);
}

function isDangerousUrl(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.startsWith('javascript:') ||
    normalized.startsWith('data:text/html') ||
    normalized.startsWith('vbscript:')
  );
}

/**
 * True if the href points outside the book itself — an absolute http(s)
 * (or protocol-relative) URL to some other site. Anything else — a bare
 * `#fragment`, a relative path to another XHTML file in the archive, or a
 * relative path with its own fragment — is an "internal" EPUB link: it
 * targets a spine section or anchor that only exists inside the source
 * archive and has no corresponding page on this site once the book has
 * been split into reader pages, so it must not survive as a clickable link.
 */
function isExternalUrl(value: string): boolean {
  const normalized = value.trim();
  return /^https?:\/\//i.test(normalized) || normalized.startsWith('//');
}

function sanitizeClassAttribute(value: string): string | null {
  const kept = value
    .split(/\s+/)
    .filter((cls) => ALLOWED_CLASS_NAMES.has(cls))
    .join(' ');
  return kept.length > 0 ? kept : null;
}

type StackFrame = {
  tag: string;
  /** true if this original tag is entirely dropped (its children are also dropped). */
  dropSubtree: boolean;
  /** true if this original tag is unwrapped (children re-parented to the nearest kept ancestor). */
  isUnwrapped: boolean;
  /** The sanitized element node children should be appended to, or null if unwrapped/dropped. */
  outputNode: EpubElementNode | null;
};

/**
 * Sanitizes and normalizes a single EPUB section's XHTML into a small,
 * serializable AST, resolving and collecting image references for
 * out-of-band extraction/upload by the caller.
 *
 * Security posture:
 * - Whole-tag strip list removes script/form/iframe/object/embed/style/etc.
 *   including their content, so nothing inside a <script> can leak through
 *   as text either.
 * - Only an explicit allow-list of tags survives; everything else is
 *   unwrapped (text kept, tag dropped) or stripped depending on category.
 * - Attributes are allow-listed per tag; event handlers and javascript:/
 *   data:text/html URLs are dropped regardless of tag.
 * - `style` attributes are dropped unconditionally — no inline CSS survives.
 * - `class` values are filtered through a fixed semantic allow-list.
 */
export class EpubXhtmlSanitizer {
  static sanitize(xhtml: string, opfDir: string, sectionArchivePath: string): SanitizedSection {
    const root: EpubElementNode = { type: 'element', tag: '__root__', attribs: {}, children: [] };
    const stack: StackFrame[] = [
      { tag: '__root__', dropSubtree: false, isUnwrapped: true, outputNode: root },
    ];
    const images: DiscoveredImageRef[] = [];

    const sectionDir = sectionArchivePath.includes('/')
      ? sectionArchivePath.slice(0, sectionArchivePath.lastIndexOf('/'))
      : opfDir;

    const parser = new Parser(
      {
        onopentag(name, attribs) {
          const tag = name.toLowerCase();
          const parent = stack[stack.length - 1];

          // Anything inside an already-dropped subtree stays dropped.
          if (parent.dropSubtree) {
            stack.push({ tag, dropSubtree: true, isUnwrapped: false, outputNode: null });
            return;
          }

          if (STRIPPED_TAGS_WITH_CONTENT.has(tag)) {
            stack.push({ tag, dropSubtree: true, isUnwrapped: false, outputNode: null });
            return;
          }

          if (UNWRAP_TAGS.has(tag) || !ALLOWED_TAGS.has(tag)) {
            // Unwrap: don't emit this tag, but keep processing children into
            // the nearest kept ancestor's output node.
            stack.push({
              tag,
              dropSubtree: false,
              isUnwrapped: true,
              outputNode: parent.outputNode,
            });
            return;
          }

          const sanitizedAttribs = sanitizeAttributes(tag, attribs);

          if (tag === 'img') {
            const rawSrc = attribs.src;
            if (rawSrc) {
              try {
                const resolved = EpubArchiveReader.resolveRelativePath(sectionDir, rawSrc);
                const placeholderId = `img-${randomUUID()}`;
                images.push({ archivePath: resolved, placeholderId });
                sanitizedAttribs['data-epub-src-placeholder'] = placeholderId;
              } catch {
                // Path escapes the archive root — drop the image reference
                // entirely rather than following it.
              }
            }
          }

          const node: EpubElementNode = {
            type: 'element',
            tag,
            attribs: sanitizedAttribs,
            children: [],
          };
          parent.outputNode?.children.push(node);
          stack.push({ tag, dropSubtree: false, isUnwrapped: false, outputNode: node });
        },

        ontext(text) {
          const parent = stack[stack.length - 1];
          if (parent.dropSubtree || !parent.outputNode) return;
          if (text.length === 0) return;
          parent.outputNode.children.push({ type: 'text', text });
        },

        onclosetag() {
          if (stack.length > 1) stack.pop();
        },
      },
      { xmlMode: true, decodeEntities: true, lowerCaseTags: true, lowerCaseAttributeNames: true },
    );

    parser.write(xhtml);
    parser.end();

    return { nodes: collapseWhitespace(root.children), images };
  }
}

function sanitizeAttributes(tag: string, attribs: Record<string, string>): Record<string, string> {
  const allowedForTag = ALLOWED_ATTRIBUTES_BY_TAG[tag] ?? new Set<string>();
  const allowedGlobal = ALLOWED_ATTRIBUTES_BY_TAG['*'];
  const result: Record<string, string> = {};

  for (const [rawName, rawValue] of Object.entries(attribs)) {
    const name = rawName.toLowerCase();

    if (isEventHandlerAttr(name)) continue;
    if (name === 'style') continue; // no inline CSS survives, ever

    const isAllowed = allowedForTag.has(name) || allowedGlobal.has(name);
    if (!isAllowed) continue;

    if (name === 'href') {
      if (isDangerousUrl(rawValue)) continue;

      if (!isExternalUrl(rawValue)) {
        // Internal EPUB link (relative path to another spine file, or a
        // bare #fragment): once this book is split into reader pages,
        // there is no page on this site that URL could resolve to, so we
        // drop the href entirely. The <a> tag survives (as a plain,
        // non-clickable span-like wrapper) so its text content and any
        // footnote-marker styling is preserved — only the dead link target
        // is removed.
        continue;
      }

      // External link: keep it, but force it to open in a new tab so
      // navigating away from the book never replaces the reader in-place.
      result.href = rawValue;
      result.target = '_blank';
      result.rel = 'noopener noreferrer';
      continue;
    }

    if (name === 'class') {
      const cleaned = sanitizeClassAttribute(rawValue);
      if (!cleaned) continue;
      result[name] = cleaned;
      continue;
    }

    result[name] = rawValue;
  }

  return result;
}

/**
 * Collapses runs of pure-whitespace text nodes that exist only as
 * inter-tag formatting artifacts from the source XHTML, without touching
 * meaningful inline whitespace inside real sentences.
 */
function collapseWhitespace(nodes: EpubNode[]): EpubNode[] {
  const result: EpubNode[] = [];

  for (const node of nodes) {
    if (node.type === 'text') {
      const collapsed = node.text.replace(/[ \t\f\v]+/g, ' ');
      if (collapsed.trim().length === 0 && collapsed.includes('\n')) {
        // Whitespace-only text between block tags (formatting indentation) — drop it.
        continue;
      }
      result.push({ type: 'text', text: collapsed });
    } else {
      result.push({ ...node, children: collapseWhitespace(node.children) });
    }
  }

  return result;
}

export { IMAGE_MEDIA_TYPES };
