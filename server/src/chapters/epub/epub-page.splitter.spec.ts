import { BlockUnit } from './epub-block.extractor';
import { splitIntoPages } from './epub-page.splitter';

function makeUnits(count: number, imageIndices: Set<number> = new Set()): BlockUnit[] {
  return Array.from({ length: count }, (_, i) => ({
    node: { type: 'element', tag: imageIndices.has(i) ? 'img' : 'p', attribs: {}, children: [] },
    kind: imageIndices.has(i) ? 'image' : 'text',
    containsImage: imageIndices.has(i),
  }));
}

describe('splitIntoPages', () => {
  it('returns a single page when unit count is under the cap', () => {
    const pages = splitIntoPages(makeUnits(50), { maxUnitsPerPage: 100, splitThreshold: 20 });
    expect(pages).toHaveLength(1);
    expect(pages[0].units).toHaveLength(50);
  });

  it('does NOT split when remainder after the cap is within the threshold (the 100+1 case)', () => {
    const pages = splitIntoPages(makeUnits(101), { maxUnitsPerPage: 100, splitThreshold: 20 });
    expect(pages).toHaveLength(1);
    expect(pages[0].units).toHaveLength(101);
  });

  it('does NOT split when remainder equals the threshold exactly', () => {
    // 100 + 20 = 120 total; remainder at unit 101 is 20, which is <= threshold 20.
    const pages = splitIntoPages(makeUnits(120), { maxUnitsPerPage: 100, splitThreshold: 20 });
    expect(pages).toHaveLength(1);
    expect(pages[0].units).toHaveLength(120);
  });

  it('DOES split when remainder exceeds the threshold', () => {
    // 100 + 21 = 121 total; remainder at unit 101 is 21 > threshold 20 → split.
    const pages = splitIntoPages(makeUnits(121), { maxUnitsPerPage: 100, splitThreshold: 20 });
    expect(pages).toHaveLength(2);
    expect(pages[0].units).toHaveLength(100);
    expect(pages[1].units).toHaveLength(21);
  });

  it('never produces a page with only a handful of units when a large remainder exists', () => {
    // 250 units: page1=100, remaining=150 (>20) -> split; page2=100, remaining=50 (>20) -> split; page3=50
    const pages = splitIntoPages(makeUnits(250), { maxUnitsPerPage: 100, splitThreshold: 20 });
    expect(pages.map((p) => p.units.length)).toEqual([100, 100, 50]);
  });

  it('splits mid-run correctly across multiple boundaries with a small threshold', () => {
    // 205 units, cap 100, threshold 5:
    // page1: reach 100, remaining incl. current = 105 (>5) -> split -> page1=100
    // page2: reach 100 again (units 101..200), remaining incl. current at that point = 5 (<=5) -> no split
    // page2 ends up with 105 units (200 - 100 + 5 trailing = 105), consuming the rest.
    const pages = splitIntoPages(makeUnits(205), { maxUnitsPerPage: 100, splitThreshold: 5 });
    expect(pages.map((p) => p.units.length)).toEqual([100, 105]);
  });

  it('never splits inside a single indivisible unit (each unit stays whole in exactly one page)', () => {
    const units = makeUnits(150);
    const pages = splitIntoPages(units, { maxUnitsPerPage: 100, splitThreshold: 20 });
    const flattenedBack = pages.flatMap((p) => p.units);
    expect(flattenedBack).toEqual(units); // same objects, same order, nothing duplicated or dropped
  });

  it('produces mixed text/image pages reflecting document order, not grouped by type', () => {
    // pattern: p, p, img, p  -> single page since well under cap
    const units = makeUnits(4, new Set([2]));
    const pages = splitIntoPages(units, { maxUnitsPerPage: 100, splitThreshold: 20 });
    expect(pages).toHaveLength(1);
    expect(pages[0].units.map((u) => u.kind)).toEqual(['text', 'text', 'image', 'text']);
    expect(pages[0].hasImages).toBe(true);
  });

  it('marks hasImages false for a page with no image units', () => {
    const pages = splitIntoPages(makeUnits(10), { maxUnitsPerPage: 100, splitThreshold: 20 });
    expect(pages[0].hasImages).toBe(false);
  });

  it('returns an empty array for zero units', () => {
    expect(splitIntoPages([], { maxUnitsPerPage: 100, splitThreshold: 20 })).toEqual([]);
  });

  it('handles maxUnitsPerPage=1 (every unit becomes checked against threshold individually)', () => {
    // With cap=1 and threshold=0: every unit after the first triggers a split
    // since remaining is always >= 1 > 0.
    const pages = splitIntoPages(makeUnits(5), { maxUnitsPerPage: 1, splitThreshold: 0 });
    expect(pages.map((p) => p.units.length)).toEqual([1, 1, 1, 1, 1]);
  });

  it('throws for an invalid (zero) maxUnitsPerPage', () => {
    expect(() => splitIntoPages(makeUnits(5), { maxUnitsPerPage: 0, splitThreshold: 0 })).toThrow();
  });
});
