import {
  assertSecurityResult,
  resolveSecurityResult,
} from './resolve-security-result';
import { SudoRedirectError } from '@/shared/lib/sudo-navigation';
import { describe, expect, it } from 'vitest';

describe('resolveSecurityResult', () => {
  it('treats a redirect body as success', () => {
    expect(resolveSecurityResult({ url: '/home/security' })).toBe('success');
  });

  it.each(['/user/sudo', '/d/system/user/sudo'])(
    'reports a sudo hand-off for %s',
    (url) => {
      expect(resolveSecurityResult({ url })).toBe('sudo');
    }
  );

  it('throws the backend error message', () => {
    expect(() =>
      resolveSecurityResult({
        error: { name: 'InvalidTokenError', message: 'Invalid code' },
      })
    ).toThrow('Invalid code');
  });
});

describe('assertSecurityResult', () => {
  it('returns sudo instead of surfacing the redirect error', () => {
    expect(assertSecurityResult({ url: '/user/sudo' })).toBe('sudo');
  });

  it('returns success for a normal redirect', () => {
    expect(assertSecurityResult({ url: '/home/security' })).toBe('success');
  });

  it('rethrows backend failures so forms can display them', () => {
    expect(() =>
      assertSecurityResult({
        error: { name: 'VerifyPasswordError', message: 'Passwords differ' },
      })
    ).toThrow('Passwords differ');
  });

  it('identifies the sudo error type used by the shared adapter', () => {
    expect(new SudoRedirectError()).toBeInstanceOf(Error);
  });
});
