import {
  applyProblemSearchInput,
  buildProblemQuery,
  buildRandomProblemQuery,
  DEFAULT_PROBLEM_SORT_DIRECTION,
  difficultyRangeToLevels,
  flipProblemSort,
  levelsToDifficultyRange,
  normalizeDifficultyLevel,
  normalizeProblemSort,
  parseProblemFilters,
  parseProblemQueryExpression,
  problemFilterHref,
  serializeProblemFilters,
  updateProblemFilters,
  type ProblemFilters,
} from './problem-filter-utils';
import { describe, expect, it } from 'vitest';

const emptyFilters: ProblemFilters = {
  q: '',
  category: [],
  difficulty: [],
  namespace: '',
  sort: 'default',
  dir: 'asc',
  showTags: false,
  page: 1,
};

describe('parseProblemFilters', () => {
  it.each([
    {
      name: 'defaults',
      params: {},
      expected: emptyFilters,
    },
    {
      name: 'reads structured filters',
      params: {
        q: 'binary search',
        category: 'dp,graph',
        difficulty: '2,5',
        namespace: 'legacy',
        sort: 'recent',
        dir: 'desc',
        showTags: 'true',
        page: '3',
      },
      expected: {
        ...emptyFilters,
        q: 'binary search',
        category: ['dp', 'graph'],
        difficulty: [2, 5],
        namespace: 'legacy',
        sort: 'recent',
        dir: 'desc',
        showTags: true,
        page: 3,
      },
    },
    {
      name: 'reads expression keywords from a shared link',
      params: {
        q: 'category:dp,graph difficulty:1 difficulty:3 namespace:legacy two-pointers',
      },
      expected: {
        ...emptyFilters,
        q: 'two-pointers',
        category: ['dp', 'graph'],
        difficulty: [1, 3],
        namespace: 'legacy',
      },
    },
    {
      name: 'drops invalid difficulty levels and deduplicates',
      params: { difficulty: '9,2,-1,2,x,0' },
      expected: { ...emptyFilters, difficulty: [0, 2] },
    },
    {
      name: 'rejects an invalid page',
      params: { page: '0' },
      expected: emptyFilters,
    },
    {
      name: 'falls back to the supported sort direction',
      params: { sort: 'recent', dir: 'asc' },
      expected: { ...emptyFilters, sort: 'recent', dir: 'desc' },
    },
    {
      name: 'prefers structured filters over expression keywords',
      params: { q: 'category:graph', category: 'dp', difficulty: '' },
      expected: { ...emptyFilters, category: ['dp'] },
    },
  ])('$name', ({ params, expected }) => {
    expect(parseProblemFilters(params)).toEqual(expected);
  });
});

describe('serializeProblemFilters', () => {
  const cases: Array<{
    name: string;
    filters: ProblemFilters;
    expected: Record<string, string>;
  }> = [
    {
      name: 'omits defaults',
      filters: { ...emptyFilters, showTags: false, page: 1 },
      expected: {},
    },
    {
      name: 'serializes every active filter',
      filters: {
        q: 'two pointers',
        category: ['dp', 'graph'],
        difficulty: [2, 5],
        namespace: 'legacy',
        sort: 'recent',
        dir: 'desc',
        showTags: true,
        page: 2,
      },
      expected: {
        q: 'two pointers',
        category: 'dp,graph',
        difficulty: '2,5',
        namespace: 'legacy',
        sort: 'recent',
        showTags: 'true',
        page: '2',
      },
    },
    {
      name: 'omits a direction equal to the ordering default',
      filters: { ...emptyFilters, sort: 'recent', dir: 'desc' },
      expected: { sort: 'recent' },
    },
  ];

  it.each(cases)('$name', ({ filters, expected }) => {
    expect(serializeProblemFilters(filters)).toEqual(expected);
  });

  it('round-trips through the URL parser', () => {
    const filters: ProblemFilters = {
      q: 'shortest path',
      category: ['dp'],
      difficulty: [4],
      namespace: 'school',
      sort: 'recent',
      dir: 'desc',
      showTags: true,
      page: 4,
    };
    expect(parseProblemFilters(serializeProblemFilters(filters))).toEqual(
      filters
    );
  });

  it('builds a shareable href', () => {
    expect(problemFilterHref('/problem', emptyFilters)).toBe('/problem');
    expect(
      problemFilterHref('/problem', {
        ...emptyFilters,
        q: 'dp',
        page: 2,
      })
    ).toBe('/problem?q=dp&page=2');
  });
});

describe('normalizeProblemSort', () => {
  it.each([
    ['default', 'asc', { metric: 'default', direction: 'asc' }],
    ['default', 'desc', { metric: 'default', direction: 'asc' }],
    ['recent', 'desc', { metric: 'recent', direction: 'desc' }],
    ['recent', 'asc', { metric: 'recent', direction: 'desc' }],
    ['recent', undefined, { metric: 'recent', direction: 'desc' }],
  ] as const)('normalizes %s/%s', (metric, direction, expected) => {
    expect(normalizeProblemSort(metric, direction)).toEqual(expected);
    expect(expected.direction).toBe(DEFAULT_PROBLEM_SORT_DIRECTION[metric]);
  });
});

describe('flipProblemSort', () => {
  it.each([
    ['default', 'asc', { metric: 'recent', direction: 'desc' }],
    ['recent', 'desc', { metric: 'default', direction: 'asc' }],
  ] as const)(
    'flips %s/%s to the other ordering',
    (metric, direction, expected) => {
      expect(flipProblemSort(metric, direction)).toEqual(expected);
    }
  );
});

describe('updateProblemFilters', () => {
  it('returns to the first page when a filter changes', () => {
    expect(
      updateProblemFilters({ ...emptyFilters, page: 5 }, { category: ['dp'] })
    ).toEqual({ ...emptyFilters, category: ['dp'], page: 1 });
  });

  it('keeps the page on an explicit page change', () => {
    expect(
      updateProblemFilters({ ...emptyFilters, page: 5 }, { page: 2 })
    ).toEqual({ ...emptyFilters, page: 2 });
  });

  it('repairs an unsupported direction after a sort change', () => {
    expect(
      updateProblemFilters(
        { ...emptyFilters, sort: 'default', dir: 'asc' },
        { sort: 'recent' }
      )
    ).toEqual({ ...emptyFilters, sort: 'recent', dir: 'desc' });
  });
});

describe('buildProblemQuery', () => {
  it.each([
    {
      name: 'empty filters',
      filters: emptyFilters,
      expected: '',
    },
    {
      name: 'text only',
      filters: { ...emptyFilters, q: 'binary search' },
      expected: 'binary search',
    },
    {
      name: 'every keyword',
      filters: {
        ...emptyFilters,
        q: 'shortest path',
        category: ['dp', 'graph'],
        difficulty: [0, 3],
        namespace: 'legacy',
      },
      expected:
        'shortest path category:dp,graph difficulty:0 difficulty:3 namespace:legacy',
    },
  ])('$name', ({ filters, expected }) => {
    expect(buildProblemQuery(filters)).toBe(expected);
  });

  it('parses back into the same structured filters', () => {
    const filters: ProblemFilters = {
      ...emptyFilters,
      q: 'flow',
      category: ['dp'],
      difficulty: [2],
      namespace: 'legacy',
    };
    expect(parseProblemQueryExpression(buildProblemQuery(filters))).toEqual({
      text: 'flow',
      category: ['dp'],
      difficulty: [2],
      namespace: 'legacy',
    });
  });
});

describe('buildRandomProblemQuery', () => {
  it.each([
    { category: [], expected: '' },
    { category: ['dp'], expected: 'category:dp' },
    { category: ['dp', 'graph'], expected: 'category:dp,graph' },
    { category: ['two pointers'], expected: '' },
  ])('builds $expected', ({ category, expected }) => {
    expect(buildRandomProblemQuery(category)).toBe(expected);
  });
});

describe('applyProblemSearchInput', () => {
  it('extracts keywords and resets to the first page', () => {
    expect(
      applyProblemSearchInput(
        { ...emptyFilters, page: 3, category: ['tree'] },
        'category:dp difficulty:4 linked list'
      )
    ).toEqual({
      ...emptyFilters,
      q: 'linked list',
      category: ['dp'],
      difficulty: [4],
    });
  });

  it('keeps chip selections when the input has no keywords', () => {
    expect(
      applyProblemSearchInput(
        {
          ...emptyFilters,
          page: 2,
          category: ['tree'],
          difficulty: [3],
          namespace: 'legacy',
        },
        'shortest path'
      )
    ).toEqual({
      ...emptyFilters,
      q: 'shortest path',
      category: ['tree'],
      difficulty: [3],
      namespace: 'legacy',
    });
  });
});

describe('parseProblemQueryExpression', () => {
  it.each([
    {
      name: 'keeps unknown tokens as text',
      input: 'hello world',
      expected: {
        text: 'hello world',
        category: [],
        difficulty: [],
        namespace: '',
      },
    },
    {
      name: 'ignores empty keyword values',
      input: 'category: difficulty:2',
      expected: {
        text: 'category:',
        category: [],
        difficulty: [2],
        namespace: '',
      },
    },
    {
      name: 'accepts uppercase keywords',
      input: 'Category:DP',
      expected: {
        text: '',
        category: ['DP'],
        difficulty: [],
        namespace: '',
      },
    },
  ])('$name', ({ input, expected }) => {
    expect(parseProblemQueryExpression(input)).toEqual(expected);
  });
});

describe('difficulty helpers', () => {
  it.each([
    [null, null],
    [0, 0],
    [8, 8],
    [9, null],
    [-1, null],
    ['4', 4],
    ['x', null],
  ])('normalizes a level %s', (input, expected) => {
    expect(normalizeDifficultyLevel(input)).toBe(expected);
  });

  it('builds inclusive level lists from a range', () => {
    expect(levelsToDifficultyRange([5, 2, 1, 2])).toEqual({ min: 1, max: 5 });
    expect(levelsToDifficultyRange([])).toEqual({ min: null, max: null });
    expect(difficultyRangeToLevels({ min: 2, max: 4 })).toEqual([2, 3, 4]);
    expect(difficultyRangeToLevels({ min: 3, max: 2 })).toEqual([2, 3]);
    expect(difficultyRangeToLevels({ min: null, max: null })).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8,
    ]);
  });
});
