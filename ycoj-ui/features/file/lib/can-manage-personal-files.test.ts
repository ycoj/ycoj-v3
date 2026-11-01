import { canUploadPersonalFiles } from './can-manage-personal-files';
import { PRIV } from '@/features/user/lib/priv';
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

describe('canUploadPersonalFiles', () => {
  it('denies anonymous and missing users', () => {
    expect(canUploadPersonalFiles(null)).toBe(false);
    expect(canUploadPersonalFiles(makeUser({ _id: 0 }))).toBe(false);
  });

  it('denies signed-in users without the file-creation privilege', () => {
    expect(canUploadPersonalFiles(makeUser())).toBe(false);
  });

  it('allows users with the file-creation privilege', () => {
    expect(
      canUploadPersonalFiles(makeUser({ priv: PRIV.PRIV_CREATE_FILE }))
    ).toBe(true);
  });

  it('allows administrators holding every privilege', () => {
    expect(canUploadPersonalFiles(makeUser({ priv: PRIV.PRIV_ALL }))).toBe(
      true
    );
  });
});
