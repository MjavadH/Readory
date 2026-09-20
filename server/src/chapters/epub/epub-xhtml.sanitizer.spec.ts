import { serializeEpubNodes } from './epub-html.serializer';
import { EpubXhtmlSanitizer } from './epub-xhtml.sanitizer';

function sanitizeAndSerialize(xhtml: string, opfDir = 'OEBPS', sectionPath = 'OEBPS/ch1.xhtml') {
  const result = EpubXhtmlSanitizer.sanitize(xhtml, opfDir, sectionPath);
  const html = serializeEpubNodes(result.nodes, (id) => `/assets/${id}.webp`);
  return { html, images: result.images };
}

describe('EpubXhtmlSanitizer', () => {
  it('keeps plain paragraphs and headings intact', () => {
    const { html } = sanitizeAndSerialize(
      '<html><body><h1>Title</h1><p>Hello <b>world</b></p></body></html>',
    );
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<p>Hello <b>world</b></p>');
  });

  it('strips <script> tags entirely, including their text content', () => {
    const { html } = sanitizeAndSerialize(
      '<html><body><p>Safe</p><script>alert(document.cookie)</script></body></html>',
    );
    expect(html).not.toContain('script');
    expect(html).not.toContain('alert');
    expect(html).not.toContain('document.cookie');
    expect(html).toContain('<p>Safe</p>');
  });

  it('strips <form> and its content entirely', () => {
    const { html } = sanitizeAndSerialize(
      '<html><body><form action="/steal"><input type="text"/></form><p>ok</p></body></html>',
    );
    expect(html).not.toContain('form');
    expect(html).not.toContain('input');
    expect(html).toContain('<p>ok</p>');
  });

  it('strips <iframe>, <object>, and <embed> entirely', () => {
    const { html } = sanitizeAndSerialize(
      `<html><body>
        <iframe src="https://evil.example"></iframe>
        <object data="evil.swf"></object>
        <embed src="evil.swf"/>
        <p>ok</p>
      </body></html>`,
    );
    expect(html).not.toContain('iframe');
    expect(html).not.toContain('object');
    expect(html).not.toContain('embed');
    expect(html).not.toContain('evil.example');
    expect(html).toContain('<p>ok</p>');
  });

  it('strips <style> blocks and their CSS content', () => {
    const { html } = sanitizeAndSerialize(
      '<html><head><style>body{background:url(javascript:alert(1))}</style></head><body><p>ok</p></body></html>',
    );
    expect(html).not.toContain('style');
    expect(html).not.toContain('javascript:alert');
    expect(html).toContain('<p>ok</p>');
  });

  it('strips @font-face / custom font references via <link> and <style>', () => {
    const { html } = sanitizeAndSerialize(
      `<html><head>
        <link rel="stylesheet" href="fonts.css"/>
        <style>@font-face{font-family:'Evil';src:url('evil.woff')}</style>
      </head><body><p>ok</p></body></html>`,
    );
    expect(html).not.toContain('font-face');
    expect(html).not.toContain('.woff');
    expect(html).not.toContain('link');
  });

  it('removes all event handler attributes regardless of tag', () => {
    const { html } = sanitizeAndSerialize(
      '<html><body><p onclick="steal()">click</p><img src="a.jpg" onerror="steal()"/></body></html>',
    );
    expect(html).not.toMatch(/onclick/i);
    expect(html).not.toMatch(/onerror/i);
  });

  it('strips javascript: URLs from href', () => {
    const { html } = sanitizeAndSerialize(
      '<html><body><a href="javascript:alert(1)">click</a></body></html>',
    );
    expect(html).not.toContain('javascript:');
    expect(html).toContain('<a>click</a>');
  });

  it('strips data:text/html URLs from href', () => {
    const { html } = sanitizeAndSerialize(
      '<html><body><a href="data:text/html,<script>alert(1)</script>">click</a></body></html>',
    );
    expect(html).not.toContain('data:text/html');
  });

  describe('internal vs external links', () => {
    it('drops href for a relative link to another spine file (internal EPUB link)', () => {
      const { html } = sanitizeAndSerialize(
        '<html><body><a href="chapter2.xhtml">Next chapter</a></body></html>',
      );
      expect(html).not.toMatch(/href=/);
      expect(html).toContain('<a>Next chapter</a>');
    });

    it('drops href for a relative link with a fragment (internal footnote/anchor link)', () => {
      const { html } = sanitizeAndSerialize(
        '<html><body><a href="chapter2.xhtml#note3">see note</a></body></html>',
      );
      expect(html).not.toMatch(/href=/);
      expect(html).toContain('<a>see note</a>');
    });

    it('drops href for a bare same-page fragment link', () => {
      const { html } = sanitizeAndSerialize('<html><body><a href="#footnote1">1</a></body></html>');
      expect(html).not.toMatch(/href=/);
      expect(html).toContain('<a>1</a>');
    });

    it('drops href for a parent-relative internal link', () => {
      const { html } = sanitizeAndSerialize(
        '<html><body><a href="../text/chapter2.xhtml">Next</a></body></html>',
      );
      expect(html).not.toMatch(/href=/);
    });

    it('keeps an absolute https:// external link and forces target=_blank + safe rel', () => {
      const { html } = sanitizeAndSerialize(
        '<html><body><a href="https://example.com/article">source</a></body></html>',
      );
      expect(html).toContain('href="https://example.com/article"');
      expect(html).toContain('target="_blank"');
      expect(html).toMatch(/rel="noopener noreferrer"/);
    });

    it('keeps an absolute http:// external link and forces target=_blank + safe rel', () => {
      const { html } = sanitizeAndSerialize(
        '<html><body><a href="http://example.com/article">source</a></body></html>',
      );
      expect(html).toContain('href="http://example.com/article"');
      expect(html).toContain('target="_blank"');
    });

    it('treats a protocol-relative URL as external', () => {
      const { html } = sanitizeAndSerialize(
        '<html><body><a href="//example.com/article">source</a></body></html>',
      );
      expect(html).toContain('href="//example.com/article"');
      expect(html).toContain('target="_blank"');
    });

    it('does not let a source-supplied target or rel attribute override the enforced safe values', () => {
      const { html } = sanitizeAndSerialize(
        '<html><body><a href="https://example.com" target="_self" rel="opener">link</a></body></html>',
      );
      expect(html).toContain('target="_blank"');
      expect(html).toContain('rel="noopener noreferrer"');
      expect(html).not.toContain('target="_self"');
      expect(html).not.toContain('rel="opener"');
    });

    it('an <a> with no href at all (e.g. just an anchor id) keeps its id but has no href', () => {
      const { html } = sanitizeAndSerialize('<html><body><a id="note1">1</a></body></html>');
      expect(html).toContain('id="note1"');
      expect(html).not.toMatch(/href=/);
    });
  });

  it('drops inline style attributes unconditionally', () => {
    const { html } = sanitizeAndSerialize(
      '<html><body><p style="background:url(javascript:alert(1))">text</p></body></html>',
    );
    expect(html).not.toMatch(/style=/);
    expect(html).toContain('<p>text</p>');
  });

  it('keeps only allow-listed class names and drops arbitrary ones', () => {
    const { html } = sanitizeAndSerialize(
      '<html><body><p class="italic hacker-class">text</p></body></html>',
    );
    expect(html).toContain('class="italic"');
    expect(html).not.toContain('hacker-class');
  });

  it('drops the class attribute entirely when no allow-listed class remains', () => {
    const { html } = sanitizeAndSerialize(
      '<html><body><p class="totally-custom">text</p></body></html>',
    );
    expect(html).not.toMatch(/class=/);
  });

  it('unwraps unknown/structural tags but keeps their children', () => {
    const { html } = sanitizeAndSerialize(
      '<html><body><div><span>kept text</span></div></body></html>',
    );
    expect(html).not.toContain('<div');
    expect(html).not.toContain('<span');
    expect(html).toContain('kept text');
  });

  it('preserves figures with images and captions', () => {
    const { html, images } = sanitizeAndSerialize(
      '<html><body><figure><img src="images/pic.jpg" alt="A cat"/><figcaption>A cat</figcaption></figure></body></html>',
    );
    expect(html).toContain('<figure>');
    expect(html).toContain('<figcaption>A cat</figcaption>');
    expect(html).toMatch(/<img[^>]*src="\/assets\/img-[^"]+\.webp"/);
    expect(images).toHaveLength(1);
    expect(images[0].archivePath).toBe('OEBPS/images/pic.jpg');
  });

  it('resolves image paths relative to the section, not the OPF root', () => {
    const { images } = sanitizeAndSerialize(
      '<html><body><img src="../images/pic.jpg"/></body></html>',
      'OEBPS',
      'OEBPS/text/ch1.xhtml',
    );
    expect(images[0].archivePath).toBe('OEBPS/images/pic.jpg');
  });

  it('drops an <img> reference entirely if it would escape the archive root', () => {
    const { html, images } = sanitizeAndSerialize(
      '<html><body><img src="../../../../etc/passwd"/></body></html>',
      'OEBPS',
      'OEBPS/ch1.xhtml',
    );
    expect(images).toHaveLength(0);
    expect(html).not.toContain('etc/passwd');
  });

  it('ignores an attacker-supplied data-epub-src-placeholder attribute', () => {
    const { html, images } = sanitizeAndSerialize(
      '<html><body><img src="images/pic.jpg" data-epub-src-placeholder="img-fake-id"/></body></html>',
    );
    expect(images).toHaveLength(1);
    // The real generated placeholder id must be used, not the attacker-supplied one.
    expect(html).not.toContain('img-fake-id');
    expect(html).toMatch(/src="\/assets\/img-[0-9a-f-]+\.webp"/);
  });

  it('preserves tables, lists, and blockquotes', () => {
    const { html } = sanitizeAndSerialize(
      `<html><body>
        <table><tbody><tr><td>a</td></tr></tbody></table>
        <ul><li>one</li><li>two</li></ul>
        <blockquote>quoted</blockquote>
      </body></html>`,
    );
    expect(html).toContain('<table>');
    expect(html).toContain('<ul>');
    expect(html).toContain('<blockquote>quoted</blockquote>');
  });

  it('collapses pure inter-tag whitespace without touching sentence spacing', () => {
    const { html } = sanitizeAndSerialize(
      '<html><body>\n  <p>Hello   world</p>\n  <p>Second</p>\n</body></html>',
    );
    expect(html).toContain('<p>Hello   world</p>');
    expect(html).toBe('<p>Hello   world</p><p>Second</p>');
  });

  it('handles a nested script-inside-noscript-inside-div attack without leaking text', () => {
    const { html } = sanitizeAndSerialize(
      '<html><body><div><noscript><script>alert(1)</script>fallback text</noscript><p>real</p></div></body></html>',
    );
    expect(html).not.toContain('alert');
    expect(html).not.toContain('fallback text');
    expect(html).toContain('<p>real</p>');
  });
});
