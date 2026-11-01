import { resolveHackHref } from './hack-entry';
import { STATUS } from '@/shared/configs/status';
import { describe, expect, it } from 'vitest';

const base = {
  canHack: true,
  isSignedIn: true,
  problemHackable: true,
  recordUid: 2,
  recordStatus: STATUS.STATUS_ACCEPTED,
  viewerUid: 7,
  problemPath: '/problem/P1000',
  recordId: 'r'.repeat(24),
};

describe('resolveHackHref', () => {
  it('links to the hack page for another user’s accepted submission', () => {
    expect(resolveHackHref(base)).toBe(`/problem/P1000/hack/${'r'.repeat(24)}`);
  });

  it('keeps the contest context', () => {
    expect(resolveHackHref({ ...base, contest: 'c'.repeat(24) })).toBe(
      `/problem/P1000/hack/${'r'.repeat(24)}?tid=${'c'.repeat(24)}`
    );
  });

  it.each([
    ['guest', { isSignedIn: false }],
    ['missing permission', { canHack: false }],
    ['problem not hackable', { problemHackable: false }],
    ['own submission', { viewerUid: 2 }],
    ['unaccepted target', { recordStatus: STATUS.STATUS_WRONG_ANSWER }],
  ])('hides the entry for %s', (_label, patch) => {
    expect(resolveHackHref({ ...base, ...patch })).toBeUndefined();
  });
});
