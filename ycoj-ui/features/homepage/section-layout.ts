import type { Content } from '@/api/server/method/ui/homepage';

/**
 * Rendered homepage sections. The server config is YAML and deployment add-ons
 * can supply their own names, so the set of renderable names is explicit;
 * anything else is skipped rather than failing the page.
 */
export const SUPPORTED_SECTION_NAMES = [
  'banner',
  'bulletin',
  'contest',
  'homework',
  'training',
  'ranking',
  'hitokoto',
  'discussion',
  'starred_problems',
  'recent_problems',
  'recent_blogs',
  'discussion_nodes',
  // The legacy default config uses `suggestion`; older clients typed
  // `suggestions`. Both resolve to the same payload.
  'suggestion',
  'suggestions',
  'countdown',
  // The backend turns a failing section getter into an error payload instead
  // of failing the whole homepage.
  'error',
] as const;

export type SupportedSectionName = (typeof SUPPORTED_SECTION_NAMES)[number];

const SUPPORTED_SECTION_SET: ReadonlySet<string> = new Set(
  SUPPORTED_SECTION_NAMES
);

export type ResolvedSection = {
  name: SupportedSectionName;
  payload: unknown;
};

export type HomepageColumn = {
  /** Column width in twelfths of the legacy 12-column homepage grid. */
  width: number;
  sections: ResolvedSection[];
};

export type HomepageLayout = {
  columns: HomepageColumn[];
  /** Whether the configured widths exceed one 12-column row. */
  scaled: boolean;
  /** Section names this UI has no renderer for. */
  skipped: string[];
};

const MAX_GRID_WIDTH = 12;
const NARROW_COLUMN_MAX_WIDTH = 6;

/** A missing or invalid width renders as a full-width column. */
export function normalizeColumnWidth(width: unknown): number {
  if (typeof width !== 'number' || !Number.isFinite(width) || width <= 0) {
    return MAX_GRID_WIDTH;
  }
  return Math.min(MAX_GRID_WIDTH, Math.round(width));
}

export function isSupportedSection(name: string): name is SupportedSectionName {
  return SUPPORTED_SECTION_SET.has(name);
}

/**
 * Preserve the server's column and section order while dropping sections this
 * UI cannot render. Empty columns disappear, so a deployment that only uses
 * custom widgets still gets a single reading column.
 */
export function normalizeHomepageColumns(
  contents: Content[] | undefined | null
): HomepageLayout {
  if (!Array.isArray(contents)) {
    return { columns: [], scaled: false, skipped: [] };
  }

  const skipped: string[] = [];
  const columns: HomepageColumn[] = [];

  for (const column of contents) {
    if (!column || !Array.isArray(column.sections)) continue;
    const sections: ResolvedSection[] = [];
    for (const entry of column.sections) {
      if (!Array.isArray(entry) || typeof entry[0] !== 'string') continue;
      const [name, payload] = entry;
      if (!isSupportedSection(name)) {
        if (!skipped.includes(name)) skipped.push(name);
        continue;
      }
      sections.push({ name, payload });
    }
    if (!sections.length) continue;
    columns.push({ width: normalizeColumnWidth(column.width), sections });
  }

  const totalWidth = columns.reduce((sum, column) => sum + column.width, 0);
  return { columns, scaled: totalWidth > MAX_GRID_WIDTH, skipped };
}

/**
 * Grid span for a column. When the configured widths exceed one 12-column row
 * (custom layouts can do that), every column is scaled to fit while keeping at
 * least one unit each; otherwise the configured width is used verbatim.
 */
export function getColumnSpan(width: number, totalWidth: number): number {
  if (totalWidth <= MAX_GRID_WIDTH) return width;
  const scaled = Math.round((width / totalWidth) * MAX_GRID_WIDTH);
  return Math.min(MAX_GRID_WIDTH, Math.max(1, scaled));
}

/**
 * Where the daily check-in card goes. Check-in is a YCOJ addition rather than a
 * legacy section, so it must not create or resize configured columns.
 *
 * Rule: it sits first in the last narrow column (the sidebar, as in the legacy
 * 9/3 layout). When every configured column is wide it sits first in the last
 * column, and an empty homepage gets a single full-width column for it.
 */
export function placeCheckinColumn(columns: HomepageColumn[]): {
  columns: HomepageColumn[];
  checkinColumnIndex: number;
  addedColumn: boolean;
} {
  if (!columns.length) {
    return {
      columns: [{ width: MAX_GRID_WIDTH, sections: [] }],
      checkinColumnIndex: 0,
      addedColumn: true,
    };
  }

  let narrowIndex = -1;
  columns.forEach((column, index) => {
    if (column.width <= NARROW_COLUMN_MAX_WIDTH) narrowIndex = index;
  });
  return {
    columns,
    checkinColumnIndex: narrowIndex >= 0 ? narrowIndex : columns.length - 1,
    addedColumn: false,
  };
}

/**
 * Grid spans for a normalized layout. The check-in lives inside an existing
 * column, so configured widths are used verbatim unless the total exceeds one
 * 12-column row; such an over-wide custom layout is scaled back to twelve.
 */
export function getColumnSpans(columns: HomepageColumn[]): number[] {
  const totalWidth = columns.reduce((sum, column) => sum + column.width, 0);
  if (totalWidth <= MAX_GRID_WIDTH) {
    return columns.map((column) => column.width);
  }
  return columns.map((column) => getColumnSpan(column.width, totalWidth));
}
