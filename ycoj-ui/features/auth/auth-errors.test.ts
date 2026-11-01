import {
  loginErrorKey,
  lostpassCompleteErrorKey,
  lostpassStartErrorKey,
  registerCompleteErrorKey,
  registerStartErrorKey,
} from './auth-errors';
import { describe, expect, it } from 'vitest';

describe('loginErrorKey', () => {
  it.each([
    [{ name: 'LoginError' }, 'loginError'],
    [{ name: 'UserNotFoundError' }, 'loginError'],
    [{ name: 'AccountExpiredError' }, 'accountExpired'],
    [{ name: 'BlacklistedError' }, 'accountBanned'],
    [{ name: 'BuiltinLoginError' }, 'loginDisabled'],
    [{ name: 'OpcountExceededError' }, 'tooManyAttempts'],
    [{ name: 'SystemError' }, 'retryError'],
    [{}, 'retryError'],
  ])('%o -> %s', (error, expected) => {
    expect(loginErrorKey(error)).toBe(expected);
  });
});

describe('registerStartErrorKey', () => {
  it.each([
    [{ name: 'UserAlreadyExistError' }, 'emailTaken'],
    [{ name: 'BlacklistedError' }, 'emailBlocked'],
    [{ name: 'ValidationError', params: ['mail'] }, 'invalidEmail'],
    [{ name: 'PrivilegeError' }, 'registerUnavailable'],
    [{ name: 'ForbiddenError' }, 'registerUnavailable'],
    [{ name: 'OpcountExceededError' }, 'tooManyAttempts'],
    [{ name: 'SystemError' }, 'retryError'],
  ])('%o -> %s', (error, expected) => {
    expect(registerStartErrorKey(error)).toBe(expected);
  });
});

describe('registerCompleteErrorKey', () => {
  it.each([
    [{ name: 'UserAlreadyExistError' }, 'usernameTaken'],
    [{ name: 'InvalidTokenError' }, 'invalidToken'],
    [{ name: 'ValidationError', params: ['uname'] }, 'usernameInvalid'],
    [{ name: 'ValidationError', params: ['password'] }, 'retryError'],
    [{ name: 'VerifyPasswordError' }, 'retryError'],
  ])('%o -> %s', (error, expected) => {
    expect(registerCompleteErrorKey(error)).toBe(expected);
  });
});

describe('lostpassStartErrorKey', () => {
  it.each([
    [{ name: 'UserNotFoundError' }, 'noAccount'],
    [{ name: 'SystemError' }, 'mailUnavailable'],
    [{ name: 'OpcountExceededError' }, 'tooManyAttempts'],
    [{ name: 'ValidationError' }, 'invalidEmail'],
    [{ name: 'OtherError' }, 'retryError'],
  ])('%o -> %s', (error, expected) => {
    expect(lostpassStartErrorKey(error)).toBe(expected);
  });
});

describe('lostpassCompleteErrorKey', () => {
  it.each([
    [{ name: 'InvalidTokenError' }, 'invalidToken'],
    [{ name: 'ValidationError', params: ['password'] }, 'weakPassword'],
    [{ name: 'ValidationError', params: ['verifyPassword'] }, 'retryError'],
  ])('%o -> %s', (error, expected) => {
    expect(lostpassCompleteErrorKey(error)).toBe(expected);
  });
});
