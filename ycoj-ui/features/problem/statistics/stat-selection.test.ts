import {
  applyStatFilterChange,
  buildStatSearchParams,
  flattenStatLanguages,
  resolveProblemStatSelection,
  toggleProblemStatDirection,
} from './stat-selection';
import { describe, expect, it } from 'vitest';

describe('resolveProblemStatSelection', () => {
  it.each([
    [{}, { sort: 'time', direction: 1, lang: '', page: 1 }],
    [
      { sort: 'memory', direction: '-1', lang: 'cc.cc17', page: '3' },
      { sort: 'memory', direction: -1, lang: 'cc.cc17', page: 3 },
    ],
    [
      { sort: 'bogus', direction: '0' },
      { sort: 'time', direction: 1, lang: '', page: 1 },
    ],
    [{ page: '0' }, { sort: 'time', direction: 1, lang: '', page: 1 }],
    [{ page: '-2' }, { sort: 'time', direction: 1, lang: '', page: 1 }],
    [{ page: 'abc' }, { sort: 'time', direction: 1, lang: '', page: 1 }],
    [{ lang: '  py  ' }, { sort: 'time', direction: 1, lang: 'py', page: 1 }],
  ])('normalizes %o', (query, expected) => {
    expect(resolveProblemStatSelection(query)).toEqual(expected);
  });

  it('uses the first value of a repeated parameter', () => {
    expect(
      resolveProblemStatSelection({
        sort: ['memory', 'time'],
        lang: ['py', 'cc'],
      })
    ).toEqual({ sort: 'memory', direction: 1, lang: 'py', page: 1 });
  });

  it('accepts every backend sort metric', () => {
    for (const sort of ['time', 'memory', 'length', 'date'] as const) {
      expect(resolveProblemStatSelection({ sort }).sort).toBe(sort);
    }
  });
});

describe('applyStatFilterChange', () => {
  const base = {
    sort: 'time' as const,
    direction: -1 as const,
    lang: '',
    page: 3,
  };

  it('resets the page when the metric changes', () => {
    expect(applyStatFilterChange(base, { sort: 'memory' })).toEqual({
      ...base,
      sort: 'memory',
      page: 1,
    });
  });

  it('resets the page when the language changes', () => {
    expect(applyStatFilterChange(base, { lang: 'py' }).page).toBe(1);
  });

  it('always returns to the first page when the filter form is submitted', () => {
    expect(applyStatFilterChange(base, {})).toEqual({ ...base, page: 1 });
  });
});

describe('toggleProblemStatDirection', () => {
  it('flips between ascending and descending', () => {
    expect(toggleProblemStatDirection(-1)).toBe(1);
    expect(toggleProblemStatDirection(1)).toBe(-1);
  });
});

describe('buildStatSearchParams', () => {
  it('omits default paging and the empty language filter', () => {
    expect(
      buildStatSearchParams({
        sort: 'time',
        direction: 1,
        lang: '',
        page: 1,
      })
    ).toBe('sort=time&direction=1');
  });

  it('round-trips through the query parser', () => {
    const selection = {
      sort: 'length' as const,
      direction: -1 as const,
      lang: 'py.py3',
      page: 3,
    };
    const query = Object.fromEntries(
      new URLSearchParams(buildStatSearchParams(selection))
    );
    expect(resolveProblemStatSelection(query)).toEqual(selection);
  });
});

describe('flattenStatLanguages', () => {
  it('lists versions rather than families', () => {
    expect(
      flattenStatLanguages({
        cc: {
          display: 'C++',
          versions: [
            { name: 'cc', display: 'C++' },
            { name: 'cc.cc17', display: 'C++17' },
          ],
        },
        py: {
          display: 'Python',
          versions: [{ name: 'py.py3', display: 'Python 3' }],
        },
      })
    ).toEqual([
      { name: 'cc', display: 'C++' },
      { name: 'cc.cc17', display: 'C++17' },
      { name: 'py.py3', display: 'Python 3' },
    ]);
  });

  it('handles problems without language restrictions', () => {
    expect(flattenStatLanguages({})).toEqual([]);
  });
});
