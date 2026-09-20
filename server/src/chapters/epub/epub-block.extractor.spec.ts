import { EpubElementNode, EpubTextNode } from './epub-ast.types';
import { extractBlockUnits } from './epub-block.extractor';

function p(text: string): EpubElementNode {
  return { type: 'element', tag: 'p', attribs: {}, children: [{ type: 'text', text }] };
}

function img(src = 'x.webp'): EpubElementNode {
  return { type: 'element', tag: 'img', attribs: { src }, children: [] };
}

function figure(): EpubElementNode {
  return {
    type: 'element',
    tag: 'figure',
    attribs: {},
    children: [img(), { type: 'element', tag: 'figcaption', attribs: {}, children: [] }],
  };
}

function text(t: string): EpubTextNode {
  return { type: 'text', text: t };
}

describe('extractBlockUnits', () => {
  it('extracts paragraphs and headings as separate text units', () => {
    const h1: EpubElementNode = { type: 'element', tag: 'h1', attribs: {}, children: [] };
    const units = extractBlockUnits([h1, p('one'), p('two')]);

    expect(units).toHaveLength(3);
    expect(units.map((u) => u.node.tag)).toEqual(['h1', 'p', 'p']);
    expect(units.every((u) => u.kind === 'text')).toBe(true);
  });

  it('treats a bare <img> as its own image unit', () => {
    const units = extractBlockUnits([p('before'), img(), p('after')]);
    expect(units).toHaveLength(3);
    expect(units[1].kind).toBe('image');
    expect(units[1].containsImage).toBe(true);
  });

  it('treats <figure> as a single unit even though it wraps an img and caption', () => {
    const units = extractBlockUnits([p('before'), figure(), p('after')]);
    expect(units).toHaveLength(3);
    expect(units[1].node.tag).toBe('figure');
    expect(units[1].containsImage).toBe(true);
    expect(units[1].node.children).toHaveLength(2); // img + figcaption kept together
  });

  it('produces the interleaved text/image/text pattern in document order', () => {
    const units = extractBlockUnits([p('t1'), img(), p('t2'), p('t3'), img(), img()]);
    expect(units.map((u) => u.kind)).toEqual([
      'text',
      'image',
      'text',
      'text',
      'image',
      'image',
    ]);
  });

  it('treats table, ul, ol, blockquote, pre as single atomic units', () => {
    const table: EpubElementNode = { type: 'element', tag: 'table', attribs: {}, children: [] };
    const ul: EpubElementNode = { type: 'element', tag: 'ul', attribs: {}, children: [] };
    const blockquote: EpubElementNode = {
      type: 'element',
      tag: 'blockquote',
      attribs: {},
      children: [],
    };
    const units = extractBlockUnits([table, ul, blockquote]);
    expect(units).toHaveLength(3);
    expect(units.map((u) => u.node.tag)).toEqual(['table', 'ul', 'blockquote']);
  });

  it('coalesces stray root-level text and inline tags into a synthetic paragraph', () => {
    const link: EpubElementNode = {
      type: 'element',
      tag: 'a',
      attribs: { href: '#x' },
      children: [text('link text')],
    };
    const units = extractBlockUnits([text('loose '), link, text(' more text')]);

    expect(units).toHaveLength(1);
    expect(units[0].node.tag).toBe('p');
    expect(units[0].kind).toBe('text');
  });

  it('drops whitespace-only stray text without creating an empty unit', () => {
    const units = extractBlockUnits([text('   \n  '), p('real content')]);
    expect(units).toHaveLength(1);
    expect(units[0].node.tag).toBe('p');
  });

  it('returns an empty array for empty input', () => {
    expect(extractBlockUnits([])).toEqual([]);
  });
});
