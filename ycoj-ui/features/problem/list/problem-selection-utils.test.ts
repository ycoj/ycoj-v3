import {
  availableBulkActions,
  reconcileSelection,
  selectableProblemIds,
  selectionCheckState,
  toggleSelectAll,
  toggleSelection,
} from './problem-selection-utils';
import { describe, expect, it } from 'vitest';

const rows = [
  { docId: 1000, hidden: false },
  { docId: 1001, hidden: true },
  { docId: 1002, hidden: false },
];

describe('selectableProblemIds', () => {
  const owned = [
    { docId: 1000, owner: 1 },
    { docId: 1001, owner: 2 },
    { docId: 1002, owner: 3, maintainer: [1] },
  ];

  it('covers every problem with full edit permission', () => {
    expect(
      selectableProblemIds(owned, {
        canManageAll: true,
        canManageOwn: false,
        userId: 1,
      })
    ).toEqual([1000, 1001, 1002]);
  });

  it('limits self-edit permission to owned or maintained problems', () => {
    expect(
      selectableProblemIds(owned, {
        canManageAll: false,
        canManageOwn: true,
        userId: 1,
      })
    ).toEqual([1000, 1002]);
  });

  it('selects nothing without permission or a user', () => {
    expect(
      selectableProblemIds(owned, {
        canManageAll: false,
        canManageOwn: true,
      })
    ).toEqual([]);
    expect(
      selectableProblemIds(owned, {
        canManageAll: false,
        canManageOwn: false,
        userId: 1,
      })
    ).toEqual([]);
  });
});

describe('reconcileSelection', () => {
  it.each([
    {
      selected: [1000, 1001],
      page: [1000, 1001, 1002],
      expected: [1000, 1001],
    },
    { selected: [1000, 9], page: [1000], expected: [1000] },
    { selected: [], page: [1000], expected: [] },
    { selected: [1000, 1000], page: [1000], expected: [1000] },
  ])('keeps only on-page ids', ({ selected, page, expected }) => {
    expect(reconcileSelection(selected, page)).toEqual(expected);
  });
});

describe('toggleSelection', () => {
  it('adds and removes an id', () => {
    expect(toggleSelection([], 1000)).toEqual([1000]);
    expect(toggleSelection([1000, 1001], 1000)).toEqual([1001]);
  });
});

describe('toggleSelectAll', () => {
  it('selects the whole page when nothing is selected', () => {
    expect(toggleSelectAll([], [1000, 1001])).toEqual([1000, 1001]);
  });

  it('selects the whole page when it is partially selected', () => {
    expect(toggleSelectAll([1000], [1000, 1001])).toEqual([1000, 1001]);
  });

  it('clears the page when the whole page is selected', () => {
    expect(toggleSelectAll([1000, 1001], [1000, 1001])).toEqual([]);
  });

  it('keeps off-page selections when clearing the page', () => {
    expect(toggleSelectAll([1000, 1001, 9], [1000, 1001])).toEqual([9]);
  });

  it('does nothing with an empty page', () => {
    expect(toggleSelectAll([1000], [])).toEqual([1000]);
  });
});

describe('selectionCheckState', () => {
  it.each([
    [[], [1000, 1001], false],
    [[1000], [1000, 1001], 'indeterminate'],
    [[1000, 1001], [1000, 1001], true],
    [[1000], [1000], true],
    [[1000], [], false],
  ] as const)('reports %s for %s', (selected, page, expected) => {
    expect(selectionCheckState([...selected], [...page])).toBe(expected);
  });
});

describe('availableBulkActions', () => {
  it('offers every action for a mixed selection', () => {
    expect(availableBulkActions([1000, 1001], rows)).toEqual({
      canHide: true,
      canUnhide: true,
      canDelete: true,
      canDownload: true,
    });
  });

  it('limits hide and unhide to the matching problems', () => {
    expect(availableBulkActions([1001], rows)).toEqual({
      canHide: false,
      canUnhide: true,
      canDelete: true,
      canDownload: true,
    });
    expect(availableBulkActions([1000], rows)).toEqual({
      canHide: true,
      canUnhide: false,
      canDelete: true,
      canDownload: true,
    });
  });

  it('disables every action without a selection', () => {
    expect(availableBulkActions([], rows)).toEqual({
      canHide: false,
      canUnhide: false,
      canDelete: false,
      canDownload: false,
    });
  });
});
