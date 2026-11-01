import {
  DEFAULT_UPLOAD_LIMITS,
  isValidUploadFileName,
  validateUploadSelection,
} from './validate-upload';
import { describe, expect, it } from 'vitest';

const file = (name: string, size = 1) =>
  new File(['x'.repeat(size)], name, { type: 'text/plain' });
const existing = [{ name: 'old.txt', size: 100 }];

describe('isValidUploadFileName', () => {
  it.each([
    ['statement.pdf', true],
    ['a b.txt', true],
    ['', false],
    ['   ', false],
    ['a/b.txt', false],
    ['a\\b.txt', false],
    ['name?.txt', false],
    ['name*.txt', false],
    ['a'.repeat(255), true],
    ['a'.repeat(256), false],
  ])('validates %j as %s', (name, expected) => {
    expect(isValidUploadFileName(name)).toBe(expected);
  });
});

describe('validateUploadSelection', () => {
  it('accepts new files with valid names', () => {
    const result = validateUploadSelection(
      [file('new.txt'), file('other.txt')],
      existing
    );
    expect(result.accepted.map((item) => item.name)).toEqual([
      'new.txt',
      'other.txt',
    ]);
    expect(result.rejected).toEqual([]);
  });

  it('rejects path separators and duplicate names', () => {
    const result = validateUploadSelection(
      [file('bad/name.txt'), file('old.txt'), file('ok.txt')],
      existing
    );
    expect(result.accepted.map((item) => item.name)).toEqual(['ok.txt']);
    expect(result.rejected).toEqual([
      { name: 'bad/name.txt', reason: 'invalidName' },
      { name: 'old.txt', reason: 'duplicateName' },
    ]);
  });

  it('rejects duplicates inside the same selection after the first', () => {
    const result = validateUploadSelection(
      [file('same.txt'), file('same.txt')],
      []
    );
    expect(result.accepted).toHaveLength(1);
    expect(result.rejected).toEqual([
      { name: 'same.txt', reason: 'duplicateName' },
    ]);
  });

  it('enforces the same count limit as the backend', () => {
    const limits = { ...DEFAULT_UPLOAD_LIMITS, maxFileCount: 2 };
    const result = validateUploadSelection(
      [file('a.txt'), file('b.txt'), file('c.txt')],
      [],
      limits
    );
    expect(result.accepted.map((item) => item.name)).toEqual([
      'a.txt',
      'b.txt',
    ]);
    expect(result.rejected).toEqual([
      { name: 'c.txt', reason: 'exceedsCount' },
    ]);
  });

  it('enforces the same exclusive total-size limit as the backend', () => {
    const result = validateUploadSelection([file('big.bin', 200)], existing, {
      ...DEFAULT_UPLOAD_LIMITS,
      maxTotalBytes: 300,
    });
    expect(result.accepted).toHaveLength(0);
    expect(result.rejected[0].reason).toBe('exceedsTotal');
  });

  it('counts files accepted earlier in the same selection toward limits', () => {
    const result = validateUploadSelection(
      [file('a.bin', 100), file('b.bin', 100)],
      [],
      { maxFileCount: 100, maxTotalBytes: 150 }
    );
    expect(result.accepted.map((item) => item.name)).toEqual(['a.bin']);
    expect(result.rejected).toEqual([
      { name: 'b.bin', reason: 'exceedsTotal' },
    ]);
  });
});
