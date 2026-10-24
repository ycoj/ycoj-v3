import getUsernameColor, { getRatingTier } from './username-color';
import type { BaseUser } from '@/shared/types/user';
import { describe, expect, it } from 'vitest';

function makeUser(rating?: number | null): BaseUser {
  return {
    _id: 1,
    uname: 'alice',
    mail: 'a@example.com',
    avatar: '',
    contestRating:
      rating == null
        ? null
        : { rating, peak: rating, contests: 1, provisional: true },
  };
}

describe('getUsernameColor', () => {
  it.each([
    [undefined, 'unrated'],
    [null, 'unrated'],
    [NaN, 'unrated'],
    [-20, 'newbie'],
    [1199, 'newbie'],
    [1200, 'pupil'],
    [1399, 'pupil'],
    [1400, 'specialist'],
    [1599, 'specialist'],
    [1600, 'expert'],
    [1899, 'expert'],
    [1900, 'candidateMaster'],
    [2099, 'candidateMaster'],
    [2100, 'master'],
    [2399, 'master'],
    [2400, 'grandmaster'],
    [2999, 'grandmaster'],
    [3000, 'legendaryGrandmaster'],
    [4000, 'legendaryGrandmaster'],
  ] as const)('uses the Codeforces tier for rating %s', (rating, expected) => {
    expect(getRatingTier(rating)).toBe(expected);
  });

  it('uses contest rating rather than legacy UOJ rating for username colors', () => {
    const user = { ...makeUser(1652), uojRating: 2500 };
    expect(getUsernameColor(user)).toBe(getUsernameColor(makeUser(1652)));
    expect(getUsernameColor(makeUser())).not.toBe(getUsernameColor(user));
  });
});
