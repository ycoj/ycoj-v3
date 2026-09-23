import type { PrintAssetScope } from './assets';
import { twoProblemContest } from './fixtures/two-problem-contest';
import type { PrintableContest } from './model';
import { buildTypstFiles, sanitizeExtraSectionId } from './print-source';
import { PREAMBLE_SOURCE } from './template/preamble';
import { describe, expect, it, vi } from 'vitest';

const document = twoProblemContest.document;

function contentOf(files: { path: string; text?: string }[]): {
  hasNotice: boolean;
  problems: Array<Record<string, unknown>>;
  extraSections: Array<{ id: string; file: string }>;
} {
  const file = files.find((entry) => entry.path === '/content.json');
  return JSON.parse(file?.text ?? '{}') as ReturnType<typeof contentOf>;
}

describe('buildTypstFiles', () => {
  it('uses the reference thematic break without custom note styling', () => {
    expect(PREAMBLE_SOURCE).toContain('stroke: rgb("#808080") + 0.5pt');
    expect(PREAMBLE_SOURCE).not.toContain('print-note');
  });

  it('assembles template, generated sources and content.json', () => {
    const built = buildTypstFiles(document, { tid: '7' });
    expect(built.mainPath).toBe('/main.typ');
    expect(built.files.map((file) => file.path)).toEqual([
      '/main.typ',
      '/preamble.typ',
      '/tuackCodeTheme.tmTheme',
      '/problem-0.typ',
      '/problem-1.typ',
      '/notice.typ',
      '/content.json',
    ]);
    const content = contentOf(built.files);
    expect(content.hasNotice).toBe(true);
    expect(content.problems).toHaveLength(2);
    expect(content.problems[0]?.file).toBe('problem-0.typ');
    expect(content.problems[0]?.statement).toBeUndefined();
    expect(content.problems[0]?.problemId).toBe(1001);
    expect(content.extraSections).toEqual([]);
  });

  it('collects and dedupes asset refs with scope-bound resolution', () => {
    const resolveFile = vi.fn(
      (scope: PrintAssetScope, filename: string): string | null =>
        `${scope.kind}/${scope.kind === 'problem' ? scope.problemId : ''}/${filename}`
    );
    const built = buildTypstFiles(document, { tid: '7', resolveFile });
    // range.png (problem 1001) + poster.png (contest) — distinct uris.
    expect(built.assets).toHaveLength(2);
    const byPath = new Map(built.assets.map((ref) => [ref.path, ref]));
    for (const ref of byPath.values()) {
      expect(ref.path).toMatch(/^asset-[0-9a-f]{8}\.png$/);
      expect(ref.url).not.toBeNull();
    }
    const scopes = resolveFile.mock.calls.map((call) => call[0]);
    expect(scopes).toEqual(
      expect.arrayContaining([
        { kind: 'problem', tid: '7', problemId: 1001 },
        { kind: 'contest', tid: '7' },
      ])
    );
  });

  it('emits asset-unresolved diagnostics when resolveFile is absent', () => {
    const built = buildTypstFiles(document, {});
    expect(built.assets.every((ref) => ref.url === null)).toBe(true);
    const unresolved = built.diagnostics.filter(
      (diagnostic) => diagnostic.code === 'asset-unresolved'
    );
    expect(unresolved.length).toBeGreaterThanOrEqual(2);
    expect(unresolved.every((d) => d.severity === 'warning')).toBe(true);
  });

  it('omits notice.typ and sets hasNotice=false for blank notices', () => {
    const withoutNotice: PrintableContest = {
      ...document,
      notice: '   \n  ',
    };
    const built = buildTypstFiles(withoutNotice, {});
    expect(built.files.some((file) => file.path === '/notice.typ')).toBe(false);
    expect(contentOf(built.files).hasNotice).toBe(false);
  });

  it('sanitizes and dedupes extra-section file names', () => {
    const withExtras: PrintableContest = {
      ...document,
      extraSections: [
        { id: 'precautions', markdown: 'One' },
        { id: 'precautions', markdown: 'Two' },
        { id: 'a b/c', markdown: 'Three' },
        { id: '###', markdown: 'Four' },
      ],
    };
    const built = buildTypstFiles(withExtras, {});
    const content = contentOf(built.files);
    expect(content.extraSections).toEqual([
      { id: 'precautions', file: 'extra-precautions.typ' },
      { id: 'precautions', file: 'extra-precautions-2.typ' },
      { id: 'a b/c', file: 'extra-a_b_c.typ' },
      { id: '###', file: 'extra-section.typ' },
    ]);
    const paths = built.files.map((file) => file.path);
    expect(paths).toContain('/extra-precautions.typ');
    expect(paths).toContain('/extra-precautions-2.typ');
    expect(paths).toContain('/extra-a_b_c.typ');
    expect(paths).toContain('/extra-section.typ');
  });

  it('handles an empty contest document', () => {
    const empty: PrintableContest = {
      language: 'en',
      title: 'Empty',
      subtitle: '',
      dayName: '',
      dateText: '',
      beginAt: '',
      endAt: '',
      notice: '',
      noiStyle: false,
      fileIo: false,
      usePretest: false,
      languages: [],
      problems: [],
      extraSections: [],
    };
    const built = buildTypstFiles(empty, {});
    expect(built.files.map((file) => file.path)).toEqual([
      '/main.typ',
      '/preamble.typ',
      '/tuackCodeTheme.tmTheme',
      '/content.json',
    ]);
    const content = contentOf(built.files);
    expect(content.problems).toEqual([]);
    expect(content.extraSections).toEqual([]);
  });
});

describe('sanitizeExtraSectionId', () => {
  it.each([
    ['precautions', 'precautions'],
    ['a b/c', 'a_b_c'],
    ['hello world!', 'hello_world'],
    ['---', 'section'],
    ['', 'section'],
    ['中日文', 'section'],
    ['__x__', 'x'],
  ])('%s → %s', (input, expected) => {
    expect(sanitizeExtraSectionId(input)).toBe(expected);
  });
});
