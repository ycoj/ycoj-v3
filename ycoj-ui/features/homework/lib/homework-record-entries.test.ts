import {
  canReadHomeworkRecords,
  getHomeworkRecordEntries,
} from './homework-record-entries';
import { PERM, PRIV } from '@/features/user/lib/priv';
import type { HomeworkStatus } from '@/shared/types/homework';
import type { User } from '@/shared/types/user';
import { describe, expect, it } from 'vitest';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    _id: 1,
    uname: 'tester',
    mail: 'tester@example.com',
    avatar: '',
    perm: 'BigInt::0',
    role: 'default',
    priv: 0,
    regat: '2020-01-01T00:00:00.000Z',
    loginat: '2020-01-01T00:00:00.000Z',
    tfa: false,
    authn: false,
    ...overrides,
  };
}

const attended = (attend = 1): HomeworkStatus => ({
  _id: 'status',
  domainId: 'system',
  docId: 'hw',
  docType: 30,
  uid: 1,
  journal: [],
  score: 0,
  penaltyScore: 0,
  time: 0,
  detail: {},
  attend,
});

describe('canReadHomeworkRecords', () => {
  it('denies anonymous viewers', () => {
    expect(canReadHomeworkRecords(makeUser({ _id: 0 }), { owner: 0 })).toBe(
      false
    );
  });

  it('allows the owner and maintainers', () => {
    expect(canReadHomeworkRecords(makeUser(), { owner: 1 })).toBe(true);
    expect(
      canReadHomeworkRecords(makeUser({ _id: 3 }), {
        owner: 1,
        maintainer: [3],
      })
    ).toBe(true);
  });

  it('allows users with the code-reading privilege or permission', () => {
    expect(
      canReadHomeworkRecords(makeUser({ priv: PRIV.PRIV_READ_RECORD_CODE }), {
        owner: 2,
      })
    ).toBe(true);
    expect(
      canReadHomeworkRecords(
        makeUser({ perm: `BigInt::${PERM.PERM_READ_RECORD_CODE.toString()}` }),
        { owner: 2 }
      )
    ).toBe(true);
  });

  it('denies unrelated users without code access', () => {
    expect(canReadHomeworkRecords(makeUser(), { owner: 2 })).toBe(false);
  });
});

describe('getHomeworkRecordEntries', () => {
  it('offers all submissions to code readers', () => {
    expect(getHomeworkRecordEntries(makeUser(), { owner: 1 }, null)).toEqual({
      all: true,
      own: false,
    });
  });

  it('offers own submissions to attendees without code access', () => {
    expect(
      getHomeworkRecordEntries(makeUser(), { owner: 2 }, attended())
    ).toEqual({ all: false, own: true });
  });

  it('offers nothing to viewers who have not joined', () => {
    expect(
      getHomeworkRecordEntries(makeUser(), { owner: 2 }, attended(0))
    ).toEqual({ all: false, own: false });
    expect(getHomeworkRecordEntries(makeUser(), { owner: 2 }, null)).toEqual({
      all: false,
      own: false,
    });
  });
});
