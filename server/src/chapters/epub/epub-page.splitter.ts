import { BlockUnit } from './epub-block.extractor';

export const DEFAULT_MAX_UNITS_PER_PAGE = 100;
export const DEFAULT_SPLIT_THRESHOLD = 20;

export type SplitConfig = {
  /** Hard cap on block units per page before a split is considered. */
  maxUnitsPerPage: number;
  /**
   * If, upon reaching maxUnitsPerPage, the number of remaining units
   * (including the current one) is less than or equal to this threshold,
   * do NOT split — keep everything in the current page instead of
   * producing a near-empty trailing page.
   */
  splitThreshold: number;
};

export const DEFAULT_SPLIT_CONFIG: SplitConfig = {
  maxUnitsPerPage: DEFAULT_MAX_UNITS_PER_PAGE,
  splitThreshold: DEFAULT_SPLIT_THRESHOLD,
};

export type SectionPage = {
  units: BlockUnit[];
  hasImages: boolean;
};

/**
 * Splits an ordered list of indivisible block units into pages.
 *
 * Rules:
 * - The unit count cap applies to the TOTAL number of block units
 *   (text + images + tables + ...), not text paragraphs alone.
 * - A unit is NEVER split across two pages.
 * - When the running page reaches maxUnitsPerPage, look at how many units
 *   remain (including the one that triggered the cap). If that remaining
 *   count is <= splitThreshold, keep going in the same page instead of
 *   creating a small trailing page. Otherwise, close the current page and
 *   start a new one with that unit.
 *
 * Worked example (maxUnitsPerPage=100, splitThreshold=20):
 * - 101 total units: at unit #101, remaining-including-it = 1 <= 20 → no
 *   split, single page of 101 units.
 * - 140 total units: at unit #101, remaining-including-it = 40 > 20 → split
 *   here; page 1 = units 1..100, page 2 = units 101..140.
 */
export function splitIntoPages(
  units: BlockUnit[],
  config: SplitConfig = DEFAULT_SPLIT_CONFIG,
): SectionPage[] {
  if (units.length === 0) return [];

  const { maxUnitsPerPage, splitThreshold } = config;
  if (maxUnitsPerPage < 1) {
    throw new Error('maxUnitsPerPage must be at least 1');
  }

  const pages: SectionPage[] = [];
  let current: BlockUnit[] = [];

  for (let index = 0; index < units.length; index += 1) {
    const unit = units[index];

    if (current.length < maxUnitsPerPage) {
      current.push(unit);
      continue;
    }

    // We've hit the cap. Decide whether to fold the remainder into this
    // page or start a fresh one, based on how much is left (including
    // the unit we're currently looking at).
    const remainingIncludingCurrent = units.length - index;

    if (remainingIncludingCurrent <= splitThreshold) {
      current.push(unit);
    } else {
      pages.push(finalizePage(current));
      current = [unit];
    }
  }

  if (current.length > 0) {
    pages.push(finalizePage(current));
  }

  return pages;
}

function finalizePage(units: BlockUnit[]): SectionPage {
  return {
    units,
    hasImages: units.some((u) => u.containsImage),
  };
}
