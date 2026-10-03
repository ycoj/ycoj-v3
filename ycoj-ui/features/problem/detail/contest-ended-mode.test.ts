import { getContestEndedVariant } from './contest-ended-mode';
import type { ProblemDetailMode } from '@/api/server/method/problems/detail';
import { describe, expect, it } from 'vitest';

const cases: Array<[ProblemDetailMode | undefined, string | null]> = [
  ['view', 'view'],
  ['correction', 'correction'],
  ['contest', null],
  ['normal', null],
  ['none', null],
  [undefined, null],
];

describe('getContestEndedVariant', () => {
  it.each(cases)('maps mode %s to %s', (mode, expected) => {
    expect(getContestEndedVariant(mode)).toBe(expected);
  });
});
