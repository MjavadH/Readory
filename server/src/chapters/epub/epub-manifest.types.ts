export type EpubManifestPage = {
  key: string;
  /** Stable spine-item identifier this page was generated from. */
  sectionId: string;
  unitCount: number;
  hasImages: boolean;
};

export type EpubManifestTocEntry = {
  title: string;
  pageIndex: number; // 1-based index into `pages`
};

export type EpubChapterManifest = {
  version: 2;
  format: 'epub';
  pageCount: number;
  pages: EpubManifestPage[];
  toc: EpubManifestTocEntry[];
};

export function buildEpubManifest(
  pages: EpubManifestPage[],
  toc: EpubManifestTocEntry[],
): EpubChapterManifest {
  return {
    version: 2,
    format: 'epub',
    pageCount: pages.length,
    pages,
    toc,
  };
}
