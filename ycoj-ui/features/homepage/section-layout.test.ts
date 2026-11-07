import {
  getColumnSpan,
  getColumnSpans,
  isCheckinSectionShown,
  normalizeColumnWidth,
  normalizeHomepageColumns,
  placeCheckinColumn,
} from './section-layout';
import type { Content } from '@/api/server/method/ui/homepage';
import { describe, expect, it } from 'vitest';

const CONTEST: Content = {
  width: 9,
  sections: [
    ['bulletin', true],
    ['contest', [[], {}]],
    ['homework', [[], {}]],
    ['training', [[], {}]],
    ['ranking', []],
    ['discussion', [[], {}]],
  ],
};

const SIDEBAR: Content = {
  width: 3,
  sections: [
    ['hitokoto', true],
    ['starred_problems', [[]]],
    ['recent_problems', [[], {}]],
    ['discussion_nodes', []],
    ['suggestion', []],
  ],
};

describe('normalizeColumnWidth', () => {
  it.each([
    { input: 9, expected: 9 },
    { input: 3.4, expected: 3 },
    { input: 0, expected: 12 },
    { input: -2, expected: 12 },
    { input: Number.NaN, expected: 12 },
    { input: undefined, expected: 12 },
    { input: 99, expected: 12 },
  ])('turns $input into $expected', ({ input, expected }) => {
    expect(normalizeColumnWidth(input)).toBe(expected);
  });
});

describe('normalizeHomepageColumns', () => {
  it('preserves the legacy 9/3 layout and section order', () => {
    const layout = normalizeHomepageColumns([CONTEST, SIDEBAR]);

    expect(layout.columns).toHaveLength(2);
    expect(layout.columns[0].width).toBe(9);
    expect(layout.columns[0].sections.map((section) => section.name)).toEqual([
      'bulletin',
      'contest',
      'homework',
      'training',
      'ranking',
      'discussion',
    ]);
    expect(layout.columns[1].width).toBe(3);
    expect(layout.columns[1].sections.map((section) => section.name)).toEqual([
      'hitokoto',
      'starred_problems',
      'recent_problems',
      'discussion_nodes',
      'suggestion',
    ]);
    expect(layout.skipped).toEqual([]);
    expect(layout.scaled).toBe(false);
  });

  it('skips unknown section names but keeps every renderable one', () => {
    const layout = normalizeHomepageColumns([
      {
        width: 12,
        sections: [
          ['banner', { pictures: [] }],
          ['custom_widget', {}],
          ['countdown', { events: [], startDate: '' }],
          ['another_custom', 1],
        ],
      },
    ]);

    expect(layout.columns[0].sections.map((section) => section.name)).toEqual([
      'banner',
      'countdown',
    ]);
    // Each unknown name is reported once, in first-seen order.
    expect(layout.skipped).toEqual(['custom_widget', 'another_custom']);
  });

  it('drops columns that contain only unknown sections', () => {
    const layout = normalizeHomepageColumns([
      CONTEST,
      { width: 3, sections: [['custom_widget', {}]] },
    ]);

    expect(layout.columns).toHaveLength(1);
    expect(layout.columns[0].width).toBe(9);
  });

  it('handles a missing or malformed configuration gracefully', () => {
    expect(normalizeHomepageColumns(undefined).columns).toEqual([]);
    expect(normalizeHomepageColumns(null).columns).toEqual([]);
    expect(
      normalizeHomepageColumns([{ width: 12 } as unknown as Content]).columns
    ).toEqual([]);
  });

  it('flags widths that exceed one 12-column row', () => {
    const layout = normalizeHomepageColumns([
      { width: 9, sections: [['bulletin', true]] },
      { width: 9, sections: [['hitokoto', true]] },
    ]);

    expect(layout.scaled).toBe(true);
  });
});

describe('getColumnSpan', () => {
  it.each([
    { width: 9, total: 12, expected: 9 },
    { width: 3, total: 12, expected: 3 },
  ])(
    'uses the configured width when it fits ($width/$total)',
    ({ width, total, expected }) => {
      expect(getColumnSpan(width, total)).toBe(expected);
    }
  );

  it('scales oversized layouts back into twelve columns', () => {
    expect(getColumnSpan(9, 18)).toBe(6);
    expect(getColumnSpan(9, 18)).toBe(6);
    expect(getColumnSpan(1, 18)).toBe(1);
  });
});

describe('getColumnSpans', () => {
  it('keeps the legacy 9/3 spans for a balanced layout', () => {
    const columns = normalizeHomepageColumns([CONTEST, SIDEBAR]).columns;
    expect(getColumnSpans(columns)).toEqual([9, 3]);
  });

  it('scales an over-wide layout proportionally', () => {
    const columns = normalizeHomepageColumns([
      { width: 9, sections: [['bulletin', true]] },
      { width: 9, sections: [['hitokoto', true]] },
    ]).columns;
    expect(getColumnSpans(columns)).toEqual([6, 6]);
  });

  it('keeps a full-width layout when there is no sidebar column', () => {
    const columns = normalizeHomepageColumns([
      { width: 12, sections: [['bulletin', true]] },
    ]).columns;
    expect(getColumnSpans(columns)).toEqual([12]);
  });

  it('always totals twelve units', () => {
    for (const contents of [
      [CONTEST, SIDEBAR],
      [{ width: 12, sections: [['bulletin', true]] }],
      [
        { width: 9, sections: [['bulletin', true]] },
        { width: 9, sections: [['hitokoto', true]] },
      ],
      [
        { width: 1, sections: [['bulletin', true]] },
        { width: 11, sections: [['hitokoto', true]] },
      ],
    ]) {
      const columns = normalizeHomepageColumns(
        contents as unknown as Content[]
      ).columns;
      const total = getColumnSpans(columns).reduce(
        (sum, span) => sum + span,
        0
      );
      expect(total).toBe(12);
    }
  });
});

describe('isCheckinSectionShown', () => {
  it.each([
    { payload: true, shown: true },
    { payload: 1, shown: true },
    { payload: { enabled: true }, shown: true },
    { payload: { title: '签到' }, shown: true },
    { payload: false, shown: false },
    { payload: 0, shown: false },
    { payload: null, shown: false },
    { payload: { enabled: false, title: '签到' }, shown: false },
  ])('treats $payload as shown=$shown', ({ payload, shown }) => {
    expect(isCheckinSectionShown(payload)).toBe(shown);
  });
});

describe('placeCheckinColumn', () => {
  it('appends check-in to the last narrow column when the config omits it', () => {
    const columns = normalizeHomepageColumns([CONTEST, SIDEBAR]).columns;
    const placed = placeCheckinColumn(columns);

    expect(placed[0]).toBe(columns[0]);
    expect(placed[1].width).toBe(3);
    expect(placed[1].sections.map((section) => section.name)).toEqual([
      'hitokoto',
      'starred_problems',
      'recent_problems',
      'discussion_nodes',
      'suggestion',
      'checkin',
    ]);
    expect(placed[1].sections.at(-1)?.payload).toBe(true);
  });

  it('treats a width of 6 as the sidebar', () => {
    const columns = normalizeHomepageColumns([
      { width: 7, sections: [['bulletin', true]] },
      { width: 6, sections: [['hitokoto', true]] },
    ]).columns;
    const placed = placeCheckinColumn(columns);

    expect(placed[0].sections.map((section) => section.name)).toEqual([
      'bulletin',
    ]);
    expect(placed[1].sections.map((section) => section.name)).toEqual([
      'hitokoto',
      'checkin',
    ]);
  });

  it('appends check-in to the last column when every configured column is wide', () => {
    const columns = normalizeHomepageColumns([
      { width: 12, sections: [['bulletin', true]] },
      { width: 12, sections: [['hitokoto', true]] },
    ]).columns;
    const placed = placeCheckinColumn(columns);

    expect(placed[0]).toBe(columns[0]);
    expect(placed[1].sections.map((section) => section.name)).toEqual([
      'hitokoto',
      'checkin',
    ]);
  });

  it('creates a full-width column only for an empty homepage', () => {
    expect(placeCheckinColumn([])).toEqual([
      { width: 12, sections: [{ name: 'checkin', payload: true }] },
    ]);
  });

  it('keeps a configured check-in in its column and order', () => {
    const columns = normalizeHomepageColumns([
      {
        width: 8,
        sections: [
          ['bulletin', true],
          ['checkin', true],
          ['contest', [[], {}]],
        ],
      },
      SIDEBAR,
    ]).columns;
    const placed = placeCheckinColumn(columns);

    expect(placed).toBe(columns);
    expect(placed[0].sections.map((section) => section.name)).toEqual([
      'bulletin',
      'checkin',
      'contest',
    ]);
    expect(
      placed[1].sections.some((section) => section.name === 'checkin')
    ).toBe(false);
  });

  it('does not fall back when check-in is configured off', () => {
    const columns = normalizeHomepageColumns([
      {
        width: 9,
        sections: [
          ['bulletin', true],
          ['checkin', false],
        ],
      },
      { width: 3, sections: [['checkin', { enabled: false }]] },
    ]).columns;
    const placed = placeCheckinColumn(columns);

    expect(placed).toHaveLength(1);
    expect(placed[0].sections.map((section) => section.name)).toEqual([
      'bulletin',
    ]);
  });
});
