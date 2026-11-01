import {
  buildLoginPayload,
  readTfaMethods,
  requiredChallenge,
} from './tfa-bridge';
import { describe, expect, it } from 'vitest';

describe('requiredChallenge', () => {
  it.each([
    [{ name: 'ValidationError', params: ['2FA'] }, true],
    // The backend always mentions both factors in this error.
    [{ name: 'ValidationError', params: ['2FA', 'Authn'] }, true],
    [{ name: 'ValidationError', params: [] }, false],
    [{ name: 'LoginError', params: ['2FA'] }, false],
    [{ name: 'ValidationError', params: ['password'] }, false],
    [{ params: ['2FA'] }, false],
  ])('maps %o to %s', (error, expected) => {
    expect(requiredChallenge(error)).toBe(expected);
  });
});

describe('readTfaMethods', () => {
  it.each([
    [
      { tfa: true, authn: false },
      { tfa: true, authn: false },
    ],
    [
      { tfa: false, authn: true },
      { tfa: false, authn: true },
    ],
    [{ tfa: true }, { tfa: true, authn: false }],
    [{ authn: true }, { tfa: false, authn: true }],
    [{ tfa: 'yes' }, null],
    [{}, null],
    [null, null],
    ['tfa', null],
  ])('normalizes %o', (value, expected) => {
    expect(readTfaMethods(value)).toEqual(expected);
  });
});

describe('buildLoginPayload', () => {
  const attempt = {
    uname: 'alice',
    password: 'secret',
    rememberme: true,
    redirect: '/home',
  };

  it('resends the original attempt with a TOTP code', () => {
    expect(buildLoginPayload(attempt, { tfa: '123456' })).toEqual({
      ...attempt,
      tfa: '123456',
    });
  });

  it('resends the original attempt with a WebAuthn challenge', () => {
    expect(
      buildLoginPayload(attempt, { authnChallenge: 'challenge-1' })
    ).toEqual({ ...attempt, authnChallenge: 'challenge-1' });
  });

  it('keeps the attempt untouched without a credential', () => {
    expect(buildLoginPayload(attempt)).toEqual(attempt);
  });
});
