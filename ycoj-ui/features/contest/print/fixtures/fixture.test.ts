import {
  printableContestSchema,
  printDiagnosticSchema,
} from '@/features/contest/print/fixtures/schema';
import { twoProblemContest } from '@/features/contest/print/fixtures/two-problem-contest';
import { describe, expect, it } from 'vitest';

const fixtures = [twoProblemContest];

describe('print fixtures', () => {
  it.each(fixtures)('$name document satisfies the schema', (fixture) => {
    const parsed = printableContestSchema.parse(fixture.document);
    expect(parsed.problems.length).toBeGreaterThan(0);
  });

  it.each(fixtures)(
    '$name document is consistent with its management response',
    (fixture) => {
      const { response, document } = fixture;
      const pids = response.tdoc.pids;
      const dictIds = new Set(
        Object.keys(response.pdict).map((id) => Number(id))
      );

      // Every ordered pid resolves to a problem doc and back.
      expect(document.problems.map((p) => p.problemId)).toEqual(pids);
      for (const problem of document.problems) {
        expect(dictIds.has(problem.problemId)).toBe(true);
      }

      // Unique ids, non-empty display fields, matching submit rows.
      expect(new Set(document.problems.map((p) => p.problemId)).size).toBe(
        document.problems.length
      );
      for (const problem of document.problems) {
        expect(problem.title).not.toBe('');
        expect(problem.statement).not.toBe('');
        expect(problem.submitFilenames.length).toBe(document.languages.length);
      }
    }
  );

  it('keeps markdown constructs needed by the pipeline', () => {
    const { document } = twoProblemContest;
    const all = [
      document.notice,
      ...document.problems.map((p) => p.statement),
    ].join('\n');
    expect(all).toContain('file://');
    expect(all).toContain('$');
    expect(all).toContain('| ---');
    expect(all).toContain('```');
  });

  it('accepts a representative diagnostic', () => {
    expect(() =>
      printDiagnosticSchema.parse({
        severity: 'warning',
        code: 'asset-unresolved',
        message: 'range.png is not attached to the problem',
        location: { problemId: 1001, nodeType: 'image' },
      })
    ).not.toThrow();
  });
});
