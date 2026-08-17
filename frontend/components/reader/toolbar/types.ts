import type { PurchaseDialogBook } from '@/components/chapter-purchase-dialog';
import type { ReaderZoomApi } from '@/components/reader/reader-zoom';

export type ReaderChapterItem = {
  id: number;
  index: number;
  title: string;
  pageCount: number;
  locked: boolean;
  price?: number | null;
};

/** Which reader surface the toolbar is driving. */
export type ReaderContentMode = 'image' | 'text';

export type ReaderTextDirection = 'ltr' | 'rtl';

export type ReaderTypographySettings = {
  fontSize: number;
  lineHeight: number;
  fontFamily: string;
  /** Direction of the rendered chapter text. Independent from the UI locale direction. */
  textDirection: ReaderTextDirection;
};

export type PanelKey = 'brightness' | 'jump' | 'more' | 'settings' | 'typography' | null;

export type ToolbarPrefs = {
  brightness: boolean;
  fullscreen: boolean;
  readMode: boolean;
  chapters: boolean;
  zoom: boolean;
  typography: boolean;
};

export const DEFAULT_PREFS: ToolbarPrefs = {
  brightness: true,
  fullscreen: true,
  readMode: true,
  chapters: true,
  zoom: true,
  typography: true,
};

export const PREFS_STORAGE_KEY = 'reader-toolbar-prefs:v2';

export const spring = { type: 'spring' as const, damping: 28, stiffness: 340 };

export const FONT_SIZE_RANGE = { min: 14, max: 28, step: 1 };
export const LINE_HEIGHT_RANGE = { min: 1.2, max: 2.4, step: 0.1 };

export const TEXT_DIRECTIONS = [
  { value: 'ltr' as const, labelKey: 'TextDirectionLtr' },
  { value: 'rtl' as const, labelKey: 'TextDirectionRtl' },
] as const;

export const FONT_FAMILIES = [
  { value: 'var(--font-vazirmatn), sans-serif', labelKey: 'FontDefault' },
  { value: 'Georgia, serif', labelKey: 'FontSerif' },
  { value: 'Inter, system-ui, sans-serif', labelKey: 'FontSans' },
  { value: 'ui-monospace, SFMono-Regular, Menlo, monospace', labelKey: 'FontMono' },
] as const;

export interface ReaderToolbarProps {
  /** 'image' => chapters / read mode / brightness / nav / zoom / fullscreen.
   *  'text'  => chapters / typography / nav / fullscreen. */
  contentMode: ReaderContentMode;
  currentPage: number;
  totalPages: number;
  brightness: number;
  readMode: 'scroll' | 'page';
  currentChapter: ReaderChapterItem;
  chapters: ReaderChapterItem[];
  onPageChange: (page: number) => void;
  onBrightnessChange: (val: number) => void;
  onReadModeChange: (mode: 'scroll' | 'page') => void;
  onChapterChange: (chapter: ReaderChapterItem) => void;
  book: PurchaseDialogBook | null;
  typeSlug: string;
  onPurchased?: (chapterId: number) => void;
  showReadModeToggle?: boolean;
  fullscreenTarget?: HTMLElement | null;
  /** Zoom api from useReaderZoom(); ignored in text mode. */
  zoom?: ReaderZoomApi;
  /** Required in text mode: typography state owned by the reader page. */
  typography?: ReaderTypographySettings;
  onTypographyChange?: (next: ReaderTypographySettings) => void;
}
