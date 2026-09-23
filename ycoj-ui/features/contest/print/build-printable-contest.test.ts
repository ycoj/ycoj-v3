import { buildPrintableContest } from './build-printable-contest';
import { twoProblemContest } from './fixtures/two-problem-contest';
import type { PrintContestOverrides } from './model';
import type { ContestManagementResponse } from '@/api/server/method/contests/management';
import type { Contest } from '@/shared/types/contest';
import type { ProblemConfig, ProblemDoc } from '@/shared/types/problem';
import { describe, expect, it } from 'vitest';

function makeProblem(
  docId: number,
  config: Partial<ProblemConfig> = {},
  extra: Partial<ProblemDoc> = {}
): ProblemDoc {
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
      count: 0,
      memoryMax: 0,
      memoryMin: 0,
      timeMax: 0,
      timeMin: 0,
      type: 'default',
      ...config,
    },
    ...extra,
  };
}

function makeResponse(
  pdict: Record<number, ProblemDoc>,
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
      pids: Object.keys(pdict).map(Number),
      duration: 0,
      ...tdoc,
    },
    tsdoc: null,
    owner_udoc: { _id: 2, uname: 'admin', mail: '', avatar: '' },
    pdict,
    files: [],
    privateFiles: [],
  };
}

describe('buildPrintableContest', () => {
  it('keeps a problem printable when its config is missing', () => {
    const problem = makeProblem(1, {}, { pid: 'P1001' });
    const response = makeResponse({
      1: { ...problem, config: null } as unknown as ProblemDoc,
    });
    const { document, diagnostics } = buildPrintableContest(response);
    expect(document.problems[0]).toMatchObject({
      name: 'P1001',
      problemType: '',
      timeLimit: '',
      memoryLimit: '',
      inputFile: '',
      outputFile: '',
    });
    expect(document.languages).toEqual([
      {
        id: 'cc.cc14o2',
        displayName: 'C++',
        compileOptions: '-O2 -std=c++14 -static',
      },
    ]);
    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        severity: 'warning',
        code: 'internal-error',
      })
    );
  });
  it('derives the documented default draft for the two-problem fixture', () => {
    const result = buildPrintableContest(twoProblemContest.response);
    expect(result).toEqual({
      document: twoProblemContest.document,
      diagnostics: [],
    });
  });

  it('keeps tdoc.pids order and skips missing problems with an error', () => {
    const { response } = twoProblemContest;
    const reordered = {
      ...response,
      tdoc: { ...response.tdoc, pids: [1002, 9999, 1001] },
    };
    const result = buildPrintableContest(reordered);
    expect(result.document.problems.map((p) => p.problemId)).toEqual([
      1002, 1001,
    ]);
    expect(result.diagnostics).toEqual([
      {
        severity: 'error',
        code: 'missing-problem',
        message: 'Problem 9999 is not part of the contest payload',
        location: { problemId: 9999 },
      },
    ]);
  });

  it('applies contest-level field overrides verbatim', () => {
    const overrides: PrintContestOverrides = {
      title: 'Renamed',
      subtitle: 'Day 1',
      dateText: '2026-02-07 09:00 ~ 13:00',
      notice: 'custom notice',
      beginAt: '2026-02-08T00:00:00.000Z',
      endAt: '2026-02-08T04:00:00.000Z',
      noiStyle: false,
      usePretest: true,
      fileIo: false,
      extraSections: [{ id: 'rules', markdown: 'rules text' }],
    };
    const { document } = buildPrintableContest(twoProblemContest.response, {
      overrides,
    });
    expect(document).toMatchObject(overrides);
  });

  it('reorders and filters problems via problemOrder', () => {
    const { document } = buildPrintableContest(twoProblemContest.response, {
      overrides: { problemOrder: [1002] },
    });
    expect(document.problems.map((p) => p.problemId)).toEqual([1002]);
    // fileIo reflects the printed problems, not the whole contest.
    expect(document.fileIo).toBe(false);
  });

  it('prints each problem once when ids repeat in problemOrder or pids', () => {
    const { document } = buildPrintableContest(twoProblemContest.response, {
      overrides: { problemOrder: [1002, 1001, 1002] },
    });
    expect(document.problems.map((p) => p.problemId)).toEqual([1002, 1001]);

    const { response } = twoProblemContest;
    const repeated = {
      ...response,
      tdoc: { ...response.tdoc, pids: [1001, 1002, 1001] },
    };
    expect(
      buildPrintableContest(repeated).document.problems.map((p) => p.problemId)
    ).toEqual([1001, 1002]);
  });

  it('applies per-problem overrides without re-deriving fields', () => {
    const { document } = buildPrintableContest(twoProblemContest.response, {
      overrides: {
        problems: { 1001: { title: 'Renamed problem', name: 'sum' } },
      },
    });
    const [problem] = document.problems;
    expect(problem.title).toBe('Renamed problem');
    expect(problem.name).toBe('sum');
    // Directory/program/submission names were derived before the short-name
    // override and do not cascade.
    expect(problem.directory).toBe('aplusb');
    expect(problem.executable).toBe('aplusb.cpp');
    expect(problem.submitFilenames).toEqual(['aplusb.cpp']);
  });

  it('reports overrides for problems absent from the printed list', () => {
    const { diagnostics } = buildPrintableContest(twoProblemContest.response, {
      overrides: { problemOrder: [1001], problems: { 1002: { title: 'x' } } },
    });
    expect(diagnostics).toEqual([
      expect.objectContaining({
        severity: 'info',
        code: 'missing-problem',
        location: { problemId: 1002 },
      }),
    ]);
  });

  it('falls back to zh then en then first available statement language', () => {
    const { response } = twoProblemContest;
    // 'en': 1001 has English, 1002 (zh only) falls back to zh.
    const en = buildPrintableContest(response, {
      overrides: { language: 'en' },
    });
    expect(en.document.problems[0].statement).toContain('Description');
    expect(en.document.problems[1].statement).toContain('题目描述');
    expect(en.diagnostics).toEqual([
      expect.objectContaining({
        code: 'language-fallback',
        location: { problemId: 1002 },
      }),
    ]);

    // 'jp' is absent everywhere: zh is the first fallback for both.
    const jp = buildPrintableContest(response, {
      overrides: { language: 'jp' },
    });
    expect(jp.document.problems[0].statement).toContain('题目描述');
    expect(jp.diagnostics.map((d) => d.code)).toEqual([
      'language-fallback',
      'language-fallback',
    ]);
  });

  it('warns on empty statements', () => {
    const response = makeResponse({ 1: makeProblem(1, {}, { content: '' }) });
    const { document, diagnostics } = buildPrintableContest(response);
    expect(document.problems[0].statement).toBe('');
    expect(diagnostics).toEqual([
      expect.objectContaining({ code: 'empty-statement' }),
    ]);
  });

  it.each([
    [{ timeMax: 1000, timeMin: 1000 }, '1 s'],
    [{ timeMax: 2000, timeMin: 1000 }, '1–2 s'],
    [{ timeMax: 1500, timeMin: 1500 }, '1500 ms'],
    [{ timeMax: 250, timeMin: 250 }, '250 ms'],
    [{ timeMax: 1000, timeMin: 500 }, '500 ms–1 s'],
    [{ timeMax: 0, timeMin: 0 }, ''],
    [{ timeMax: undefined, timeMin: undefined }, ''],
  ])('formats time limit %o as %s', (config, expected) => {
    const response = makeResponse({ 1: makeProblem(1, config) });
    expect(buildPrintableContest(response).document.problems[0].timeLimit).toBe(
      expected
    );
  });

  it.each([
    [{ memoryMax: 512, memoryMin: 512 }, '512 MiB'],
    [{ memoryMax: 512, memoryMin: 256 }, '256–512 MiB'],
    [{ memoryMax: 0, memoryMin: 0 }, ''],
    [{ memoryMax: 512, memoryMin: 0 }, '512 MiB'],
  ])('formats memory limit %o as %s', (config, expected) => {
    const response = makeResponse({ 1: makeProblem(1, config) });
    expect(
      buildPrintableContest(response).document.problems[0].memoryLimit
    ).toBe(expected);
  });

  it.each([
    [{ count: 10 }, '10'],
    [{ count: 0 }, ''],
  ])('formats testcase count %o as %s', (config, expected) => {
    const response = makeResponse({ 1: makeProblem(1, config) });
    expect(
      buildPrintableContest(response).document.problems[0].testcaseCount
    ).toBe(expected);
  });

  it('maps file-I/O problems to .in/.out names and sets fileIo', () => {
    const response = makeResponse({
      1: makeProblem(1, { type: 'default', subType: 'dec' }, { pid: 'P1001' }),
      2: makeProblem(2, { type: 'default' }),
      3: makeProblem(3, { type: 'interactive', subType: 'ignored' }),
      // The judge treats subType verbatim, so `a+b` stays `a+b` in both the
      // I/O filenames and the per-language submit names.
      4: makeProblem(4, {
        type: 'default',
        subType: 'a+b',
        langs: ['cc.cc17o2'],
      }),
    });
    const { document } = buildPrintableContest(response);
    expect(document.fileIo).toBe(true);
    expect(document.problems.map((p) => p.inputFile)).toEqual([
      'dec.in',
      '',
      '',
      'a+b.in',
    ]);
    expect(document.problems[3].outputFile).toBe('a+b.out');
    expect(document.problems[0].outputFile).toBe('dec.out');
    expect(document.problems.map((p) => p.directory)).toEqual([
      'dec',
      'p2',
      'p3',
      'a+b',
    ]);
    expect(document.problems.map((p) => p.executable)).toEqual([
      'dec.cpp',
      'p2.cpp',
      'p3.cpp',
      'a+b.cpp',
    ]);
    // The default C++ row gives each problem one submission filename.
    expect(document.problems[0].submitFilenames).toEqual(['dec.cpp']);
    expect(document.problems[1].submitFilenames).toEqual(['p2.cpp']);
    expect(document.problems[3].submitFilenames).toEqual(['a+b.cpp']);
  });

  it('derives names from pid with sanitizing, else p<docId>', () => {
    const response = makeResponse({
      1: makeProblem(1, {}, { pid: 'P1001' }),
      2: makeProblem(2, {}, { pid: 'a b/c' }),
      3: makeProblem(3),
      4: makeProblem(4, {}, { pid: '!!!' }),
    });
    const names = buildPrintableContest(response).document.problems.map(
      (p) => p.name
    );
    expect(names).toEqual(['P1001', 'a_b_c', 'p3', 'p4']);
  });

  it('defaults to one C++ submission language regardless of contest and problem languages', () => {
    const response = makeResponse(
      { 1: makeProblem(1, { langs: ['cc.cc17o2', 'py.py3'] }) },
      { langs: ['java'] }
    );
    const { document } = buildPrintableContest(response);
    expect(document.languages).toEqual([
      {
        id: 'cc.cc14o2',
        displayName: 'C++',
        compileOptions: '-O2 -std=c++14 -static',
      },
    ]);
    expect(document.usePretest).toBe(false);
    expect(document.problems[0].submitFilenames).toEqual(['p1.cpp']);
  });

  it('honors explicit submission language and pretest overrides', () => {
    const response = makeResponse({ 1: makeProblem(1) });
    const { document } = buildPrintableContest(response, {
      overrides: {
        usePretest: true,
        languages: [
          { id: 'py.py3', displayName: 'Python 3', compileOptions: '' },
        ],
      },
    });
    expect(document.languages).toEqual([
      { id: 'py.py3', displayName: 'Python 3', compileOptions: '' },
    ]);
    expect(document.usePretest).toBe(true);
    expect(document.problems[0].submitFilenames).toEqual(['p1.py']);
  });

  it('formats dateText as the exact contest time range', () => {
    const sameDay = makeResponse({}, {});
    expect(buildPrintableContest(sameDay).document.dateText).toBe(
      '2026年2月7日09:00 ~ 13:00'
    );
    const multiDay = makeResponse(
      {},
      { endAt: new Date('2026-02-08T05:00:00.000Z') }
    );
    expect(buildPrintableContest(multiDay).document.dateText).toBe(
      '2026年2月7日09:00 ~ 2026年2月8日13:00'
    );
    const withSeconds = makeResponse(
      {},
      {
        beginAt: new Date('2026-02-07T01:00:01.000Z'),
        endAt: new Date('2026-02-07T05:00:02.000Z'),
      }
    );
    expect(buildPrintableContest(withSeconds).document.dateText).toBe(
      '2026年2月7日09:00:01 ~ 13:00:02'
    );
  });

  it('produces a JSON-equal result on repeated builds', () => {
    const options = {
      overrides: {
        problems: { 1001: { title: 'x' } },
      } satisfies PrintContestOverrides,
    };
    const first = buildPrintableContest(twoProblemContest.response, options);
    const second = buildPrintableContest(twoProblemContest.response, options);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(second).toEqual(first);
  });
});
