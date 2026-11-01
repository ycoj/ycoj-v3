import {
  DEFAULT_CODE_LENGTH_LIMIT,
  ANSWER_FILE_SIZE_LIMIT,
  formatSizeLimit,
  normalizeAppUrl,
  resolvePreferredSelection,
  resolveSubmitMode,
} from './submit-mode';
import { describe, expect, it } from 'vitest';

describe('resolveSubmitMode', () => {
  const cases: Array<[string | undefined, string, boolean]> = [
    ['default', 'code', false],
    ['traditional', 'code', false],
    ['interactive', 'code', false],
    ['communication', 'code', false],
    ['remote_judge', 'code', false],
    ['submit_answer', 'answer', true],
    [undefined, 'code', false],
  ];

  it.each(cases)(
    'maps problem type %s to %s mode',
    (type, mode, fixedLanguage) => {
      const info = resolveSubmitMode(
        type === undefined
          ? { config: undefined as never }
          : {
              config: {
                type,
                count: 1,
                memoryMax: 256,
                memoryMin: 1,
                timeMax: 1000,
                timeMin: 1,
              },
            }
      );
      expect(info.mode).toBe(mode);
      expect(info.fixedLanguage).toBe(fixedLanguage);
    }
  );

  it('allows answer-file uploads up to 128 MiB', () => {
    const info = resolveSubmitMode({
      config: {
        type: 'submit_answer',
        count: 1,
        memoryMax: 256,
        memoryMin: 1,
        timeMax: 1000,
        timeMin: 1,
      },
    });
    expect(info.fileLimit).toBe(ANSWER_FILE_SIZE_LIMIT);
  });

  it('uses the inline source limit for ordinary problems', () => {
    const info = resolveSubmitMode({
      config: {
        type: 'default',
        count: 1,
        memoryMax: 256,
        memoryMin: 1,
        timeMax: 1000,
        timeMin: 1,
      },
    });
    expect(info.codeLimit).toBe(DEFAULT_CODE_LENGTH_LIMIT);
    expect(info.fileLimit).toBe(DEFAULT_CODE_LENGTH_LIMIT);
  });
});

describe('formatSizeLimit', () => {
  it.each([
    [128 * 1024 * 1024, '128 MiB'],
    [1024 * 1024, '1 MiB'],
    [1536 * 1024, '1.5 MiB'],
    [128 * 1024, '128 KiB'],
    [2048, '2 KiB'],
    [512, '512 B'],
  ])('formats %i bytes as %s', (bytes, expected) => {
    expect(formatSizeLimit(bytes)).toBe(expected);
  });
});

describe('resolvePreferredSelection', () => {
  const languages = {
    cc: {
      versions: [{ name: 'cc' }, { name: 'cc.cc14o2' }, { name: 'cc.cc17o2' }],
    },
    py: { versions: [{ name: 'py' }, { name: 'py.py3' }] },
  };

  it.each([
    ['cc.cc14o2', 'cc', 'cc.cc14o2'],
    ['cc.cc17o2', 'cc', 'cc.cc17o2'],
    ['py.py3', 'py', 'py.py3'],
    ['py', 'py', 'py'],
  ])('selects %s as family %s / version %s', (preferred, family, lang) => {
    expect(resolvePreferredSelection(languages, preferred)).toEqual({
      familyKey: family,
      lang,
    });
  });

  it('falls back to a version when only the family is preferred', () => {
    expect(resolvePreferredSelection(languages, 'cc.cc99o2')).toEqual({
      familyKey: 'cc',
      lang: 'cc',
    });
  });

  it('falls back to C++14 O2 without a preference', () => {
    expect(resolvePreferredSelection(languages)).toEqual({
      familyKey: 'cc',
      lang: 'cc.cc14o2',
    });
  });

  it('falls back to the first available language when C++ is unavailable', () => {
    expect(resolvePreferredSelection({ py: languages.py }, undefined)).toEqual({
      familyKey: 'py',
      lang: 'py',
    });
  });

  it('handles an empty language list', () => {
    expect(resolvePreferredSelection({}, 'cc.cc14o2')).toEqual({
      familyKey: '',
      lang: '',
    });
  });
});

describe('normalizeAppUrl', () => {
  it.each([
    ['/record/abc', '/record/abc'],
    ['/contest/xyz/problems', '/contest/xyz/problems'],
    ['/p/P1000', '/problem/P1000'],
    ['/p', '/problem'],
    ['/d/system/p/P1000', '/problem/P1000'],
    ['/d/system/record/abc', '/record/abc'],
  ])('maps %s to %s', (input, expected) => {
    expect(normalizeAppUrl(input)).toBe(expected);
  });

  it.each([undefined, '', 'https://evil.example/p/P1000', '//evil.example'])(
    'rejects %s',
    (input) => {
      expect(normalizeAppUrl(input)).toBeUndefined();
    }
  );
});
