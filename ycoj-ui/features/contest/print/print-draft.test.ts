import {
  addDraftProblem,
  applyContestPatch,
  applyProblemPatch,
  draftProblemOrder,
  isDraftDirty,
  moveDraftProblem,
  nextExtraSectionId,
  problemLetter,
  removeDraftProblem,
  restoreDraftDefaults,
  restoreDraftProblem,
  type PrintDraft,
} from './print-draft';
import type { ContestManagementResponse } from '@/api/server/method/contests/management';
import type { Contest } from '@/shared/types/contest';
import type { ProblemDoc } from '@/shared/types/problem';
import { describe, expect, it } from 'vitest';

function makeProblem(docId: number): ProblemDoc {
  return {
    _id: `problem-${docId}`,
    domainId: 'system',
    docType: 10,
    docId,
    owner: 2,
    title: `Problem ${docId}`,
    nSubmit: 0,
    nAccept: 0,
    tag: [],
    content: 'plain statement',
    data: [],
    config: {
      count: 1,
      memoryMax: 256,
      memoryMin: 256,
      timeMax: 1000,
      timeMin: 1000,
      type: 'default',
    },
  };
}

function makeResponse(
  pids: number[],
  pdictIds: number[] = pids,
  tdoc: Partial<Contest> = {}
): ContestManagementResponse {
  return {
    tdoc: {
      _id: 'contest-1',
      docId: '7',
      docType: 30,
      domainId: 'system',
      owner: 2,
      beginAt: new Date('2026-02-07T01:00:00.000Z'),
      endAt: new Date('2026-02-07T05:00:00.000Z'),
      attend: 0,
      title: 'Contest',
      content: '',
      rule: 'oi',
      pids,
      duration: 0,
      ...tdoc,
    },
    tsdoc: null,
    owner_udoc: { _id: 2, uname: 'admin', mail: '', avatar: '' },
    pdict: Object.fromEntries(pdictIds.map((id) => [id, makeProblem(id)])),
    files: [],
    privateFiles: [],
  };
}

const response = makeResponse([1001, 1002, 1003], [1001, 1002, 1003, 1004]);

describe('draftProblemOrder', () => {
  it('defaults to tdoc.pids and honors the override', () => {
    expect(draftProblemOrder({}, response)).toEqual([1001, 1002, 1003]);
    expect(draftProblemOrder({ problemOrder: [1003, 1001] }, response)).toEqual(
      [1003, 1001]
    );
  });
});

describe('applyContestPatch', () => {
  it('sets contest fields and clears them on undefined', () => {
    let draft: PrintDraft = {};
    draft = applyContestPatch(draft, { title: 'Winter Cup', noiStyle: false });
    expect(draft).toEqual({ title: 'Winter Cup', noiStyle: false });
    draft = applyContestPatch(draft, { title: undefined });
    expect(draft).toEqual({ noiStyle: false });
  });

  it('replaces languages and extraSections arrays wholesale', () => {
    const draft = applyContestPatch(
      { languages: [{ id: 'c.c11', displayName: 'C11', compileOptions: '' }] },
      {
        extraSections: [{ id: 'section-1', markdown: '注意' }],
      }
    );
    expect(draft.languages).toHaveLength(1);
    expect(draft.extraSections).toHaveLength(1);
  });
});

describe('applyProblemPatch', () => {
  it('merges sparse patches into one problem', () => {
    let draft: PrintDraft = {};
    draft = applyProblemPatch(draft, 1001, { title: 'Sum' });
    draft = applyProblemPatch(draft, 1001, { timeLimit: '2 s' });
    expect(draft.problems?.[1001]).toEqual({ title: 'Sum', timeLimit: '2 s' });
    expect(draft.problems?.[1002]).toBeUndefined();
  });

  it('removes keys on undefined and drops emptied problem entries', () => {
    let draft = applyProblemPatch({}, 1001, { title: 'Sum', scoreNote: 'x' });
    draft = applyProblemPatch(draft, 1001, { title: undefined });
    expect(draft.problems?.[1001]).toEqual({ scoreNote: 'x' });
    draft = applyProblemPatch(draft, 1001, { scoreNote: undefined });
    expect(draft.problems).toBeUndefined();
  });
});

describe('moveDraftProblem', () => {
  it('swaps neighbors and is a no-op at the edges', () => {
    const moved = moveDraftProblem({}, response, 1002, 'up');
    expect(moved.problemOrder).toEqual([1002, 1001, 1003]);
    const again = moveDraftProblem(moved, response, 1002, 'up');
    expect(again).toBe(moved);
    expect(moveDraftProblem({}, response, 1001, 'up')).toEqual({});
  });

  it('moves down and ignores unknown ids', () => {
    const moved = moveDraftProblem({}, response, 1001, 'down');
    expect(moved.problemOrder).toEqual([1002, 1001, 1003]);
    expect(moveDraftProblem({}, response, 9999, 'down')).toEqual({});
  });
});

describe('removeDraftProblem / addDraftProblem', () => {
  it('removes an id from the order and keeps its overrides', () => {
    const draft: PrintDraft = {
      problems: { 1002: { title: 'Custom' } },
    };
    const next = removeDraftProblem(draft, response, 1002);
    expect(next.problemOrder).toEqual([1001, 1003]);
    expect(next.problems?.[1002]).toEqual({ title: 'Custom' });
  });

  it('is a no-op for ids not in the order', () => {
    expect(removeDraftProblem({}, response, 9999)).toEqual({});
  });

  it('appends a pdict problem not in the order', () => {
    const draft = removeDraftProblem({}, response, 1002);
    const next = addDraftProblem(draft, response, 1002);
    expect(next.problemOrder).toEqual([1001, 1003, 1002]);
  });

  it('adds a pdict problem absent from tdoc.pids', () => {
    const next = addDraftProblem({}, response, 1004);
    expect(next.problemOrder).toEqual([1001, 1002, 1003, 1004]);
  });

  it('rejects ids missing from pdict or already present', () => {
    expect(addDraftProblem({}, response, 9999)).toEqual({});
    expect(addDraftProblem({}, response, 1001)).toEqual({});
  });
});

describe('restoreDraftProblem / restoreDraftDefaults', () => {
  it('clears only the given problem overrides', () => {
    const draft: PrintDraft = {
      problems: { 1001: { title: 'A' }, 1002: { title: 'B' } },
    };
    const next = restoreDraftProblem(draft, 1001);
    expect(next.problems).toEqual({ 1002: { title: 'B' } });
    expect(restoreDraftProblem(draft, 9999)).toBe(draft);
  });

  it('drops the problems key when the last entry is removed', () => {
    const next = restoreDraftProblem(
      { problems: { 1001: { title: 'A' } } },
      1001
    );
    expect(next).toEqual({});
  });

  it('clears the entire draft', () => {
    expect(restoreDraftDefaults()).toEqual({});
  });
});

describe('isDraftDirty', () => {
  it('is clean for an empty draft', () => {
    expect(isDraftDirty({}, response)).toBe(false);
  });

  it('treats a problemOrder equal to tdoc.pids as clean', () => {
    expect(isDraftDirty({ problemOrder: [1001, 1002, 1003] }, response)).toBe(
      false
    );
    // Duplicates dedupe to the same order, so the build is unchanged.
    expect(
      isDraftDirty({ problemOrder: [1001, 1002, 1003, 1003] }, response)
    ).toBe(false);
  });

  it('detects reorders, removals and additions', () => {
    expect(isDraftDirty({ problemOrder: [1002, 1001, 1003] }, response)).toBe(
      true
    );
    expect(isDraftDirty({ problemOrder: [1001, 1002] }, response)).toBe(true);
    expect(
      isDraftDirty({ problemOrder: [1001, 1002, 1003, 1004] }, response)
    ).toBe(true);
  });

  it('ignores empty per-problem override objects', () => {
    expect(isDraftDirty({ problems: { 1001: {} } }, response)).toBe(false);
    expect(isDraftDirty({ problems: { 1001: { title: 'x' } } }, response)).toBe(
      true
    );
  });

  it('treats an empty extraSections list as clean', () => {
    expect(isDraftDirty({ extraSections: [] }, response)).toBe(false);
    expect(
      isDraftDirty(
        { extraSections: [{ id: 'section-1', markdown: 'm' }] },
        response
      )
    ).toBe(true);
  });

  it.each([
    { title: 'X' },
    { subtitle: 'Day 1' },
    { dateText: '2026-02-08' },
    { notice: 'note' },
    { noiStyle: true },
    { fileIo: false },
    { usePretest: false },
    { language: 'en' as const },
    { languages: [] },
  ])('marks %o as dirty', (patch) => {
    expect(isDraftDirty(patch, response)).toBe(true);
  });
});

describe('problemLetter', () => {
  it('labels positions A–Z and falls back to #N', () => {
    expect(problemLetter(0)).toBe('A');
    expect(problemLetter(1)).toBe('B');
    expect(problemLetter(25)).toBe('Z');
    expect(problemLetter(26)).toBe('#27');
  });
});

describe('nextExtraSectionId', () => {
  it('picks the smallest unused section id', () => {
    expect(nextExtraSectionId([])).toBe('section-1');
    expect(nextExtraSectionId([{ id: 'section-1' }, { id: 'section-3' }])).toBe(
      'section-2'
    );
  });
});
