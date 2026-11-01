import {
  buildProblemPackageEntries,
  problemZipFilename,
  sanitizePackageName,
  statementEntries,
} from './problem-package';
import { load } from 'js-yaml';
import { describe, expect, it } from 'vitest';

describe('sanitizePackageName', () => {
  it.each([
    ['1000 A + B', '1000 A + B'],
    ['a/b\\c', 'a b c'],
    ['  spaced   name  ', 'spaced name'],
    ['illegal:*?"<>|', 'illegal'],
  ])('sanitizes %s', (input, expected) => {
    expect(sanitizePackageName(input)).toBe(expected);
  });

  it('uses the numeric id and title for the archive name', () => {
    expect(
      problemZipFilename({
        domainId: 'system',
        docId: 1000,
        owner: 1,
        title: 'A/B',
      })
    ).toBe('1000 A B.zip');
  });
});

describe('statementEntries', () => {
  it('writes a plain Markdown statement', () => {
    expect(statementEntries('# Problem', '1000')).toEqual([
      { filename: '1000/problem.md', content: '# Problem' },
    ]);
  });

  it('splits a language map into per-language files', () => {
    expect(
      statementEntries(JSON.stringify({ en: '# A', zh: '# 乙' }), '1000')
    ).toEqual([
      { filename: '1000/problem_en.md', content: '# A' },
      { filename: '1000/problem_zh.md', content: '# 乙' },
    ]);
  });

  it('falls back to plain text for arrays and other JSON', () => {
    const content = JSON.stringify(['# A']);
    expect(statementEntries(content, '1000')).toEqual([
      { filename: '1000/problem.md', content },
    ]);
  });

  it('ignores an empty language map', () => {
    expect(statementEntries('{}', '1000')).toEqual([]);
  });

  it.each([undefined, ''])('writes nothing for %s', (content) => {
    expect(statementEntries(content, '1000')).toEqual([]);
  });
});

describe('buildProblemPackageEntries', () => {
  it('builds problem.yaml and the statement files', () => {
    const entries = buildProblemPackageEntries({
      domainId: 'system',
      docId: 1001,
      pid: 'P1001',
      owner: 2,
      title: 'Graph',
      tag: ['graph'],
      nSubmit: 4,
      nAccept: 3,
      content: '# Graph',
    });

    expect(entries.map((entry) => entry.filename)).toEqual([
      '1001/problem.yaml',
      '1001/problem.md',
    ]);
    expect(load(entries[0].content)).toEqual({
      pid: 'P1001',
      owner: 2,
      title: 'Graph',
      tag: ['graph'],
      nSubmit: 4,
      nAccept: 3,
    });
  });
});
