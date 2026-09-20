import { paginateSection } from './epub-section-pager';
import { EpubXhtmlSanitizer } from './epub-xhtml.sanitizer';

describe('paginateSection', () => {
  it('produces a single page for short content with resolved image src', () => {
    const { nodes } = EpubXhtmlSanitizer.sanitize(
      '<html><body><p>Hello</p><img src="images/pic.jpg"/></body></html>',
      'OEBPS',
      'OEBPS/ch1.xhtml',
    );

    const result = paginateSection(nodes, (id) => `https://cdn.example/${id}.webp`);

    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].html).toContain('<p');
    expect(result.pages[0].html).toMatch(/src="https:\/\/cdn\.example\/img-[^"]+\.webp"/);
    expect(result.pages[0].hasImages).toBe(true);
  });

  it('injects a stable data-unit-id derived from content, not position', () => {
    const { nodes } = EpubXhtmlSanitizer.sanitize(
      '<html><body><p>Same text</p></body></html>',
      'OEBPS',
      'OEBPS/ch1.xhtml',
    );

    const resultA = paginateSection(nodes, (id) => `/a/${id}`);
    const resultB = paginateSection(nodes, (id) => `/a/${id}`);

    const idA = resultA.pages[0].html.match(/data-unit-id="([^"]+)"/)?.[1];
    const idB = resultB.pages[0].html.match(/data-unit-id="([^"]+)"/)?.[1];

    expect(idA).toBeDefined();
    expect(idA).toBe(idB); // same content -> same id, run to run
  });

  it('produces different unit ids for different paragraph content', () => {
    const a = EpubXhtmlSanitizer.sanitize(
      '<html><body><p>Alpha</p></body></html>',
      'OEBPS',
      'OEBPS/a.xhtml',
    );
    const b = EpubXhtmlSanitizer.sanitize(
      '<html><body><p>Beta</p></body></html>',
      'OEBPS',
      'OEBPS/a.xhtml',
    );

    const pagedA = paginateSection(a.nodes, (id) => id);
    const pagedB = paginateSection(b.nodes, (id) => id);

    const idA = pagedA.pages[0].html.match(/data-unit-id="([^"]+)"/)?.[1];
    const idB = pagedB.pages[0].html.match(/data-unit-id="([^"]+)"/)?.[1];

    expect(idA).not.toBe(idB);
  });

  it('splits a long section into multiple pages and preserves per-page unit counts', () => {
    const paragraphs = Array.from({ length: 121 }, (_, i) => `<p>Paragraph ${i}</p>`).join('');
    const { nodes } = EpubXhtmlSanitizer.sanitize(
      `<html><body>${paragraphs}</body></html>`,
      'OEBPS',
      'OEBPS/ch1.xhtml',
    );

    const result = paginateSection(nodes, (id) => id, {
      maxUnitsPerPage: 100,
      splitThreshold: 20,
    });

    expect(result.pages).toHaveLength(2);
    expect(result.pages[0].unitCount).toBe(100);
    expect(result.pages[1].unitCount).toBe(21);
  });

  it('keeps a 101-paragraph section as a single page under default threshold rules', () => {
    const paragraphs = Array.from({ length: 101 }, (_, i) => `<p>Paragraph ${i}</p>`).join('');
    const { nodes } = EpubXhtmlSanitizer.sanitize(
      `<html><body>${paragraphs}</body></html>`,
      'OEBPS',
      'OEBPS/ch1.xhtml',
    );

    const result = paginateSection(nodes, (id) => id, {
      maxUnitsPerPage: 100,
      splitThreshold: 20,
    });

    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].unitCount).toBe(101);
  });

  it('never breaks a figure across a page boundary', () => {
    const before = Array.from({ length: 99 }, (_, i) => `<p>P${i}</p>`).join('');
    const html = `<html><body>${before}<figure><img src="x.jpg"/><figcaption>Cap</figcaption></figure><p>after</p></body></html>`;
    const { nodes } = EpubXhtmlSanitizer.sanitize(html, 'OEBPS', 'OEBPS/ch1.xhtml');

    const result = paginateSection(nodes, (id) => id, {
      maxUnitsPerPage: 100,
      splitThreshold: 0,
    });

    // 99 paragraphs + 1 figure = 100 (fits exactly in page 1); "after" paragraph
    // pushes to page 2. The figure's img+figcaption must appear together.
    const page1HasFigure = result.pages[0].html.includes('<figcaption>Cap</figcaption>');
    const page2HasFigure = result.pages[1]?.html.includes('<figcaption>Cap</figcaption>') ?? false;

    expect(page1HasFigure !== page2HasFigure).toBe(true); // exactly one page has the whole figure
    if (page1HasFigure) {
      expect(result.pages[0].html).toContain('<img');
      expect(result.pages[0].html).toContain('<figcaption>Cap</figcaption>');
    }
  });
});
