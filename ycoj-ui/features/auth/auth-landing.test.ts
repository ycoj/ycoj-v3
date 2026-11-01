import { resolveAuthLanding, sameSitePath } from './auth-landing';
import { describe, expect, it } from 'vitest';

const ORIGIN = 'https://ycoj.example';

describe('sameSitePath', () => {
  it.each([
    ['/problem/1001?tid=abc', '/problem/1001?tid=abc'],
    ['/home/settings/account', '/home/settings/account'],
    ['https://ycoj.example/home', '/home'],
    ['/d/system/problem/1', '/d/system/problem/1'],
  ])('keeps a same-site path: %s', (value, expected) => {
    expect(sameSitePath(value, ORIGIN)).toBe(expected);
  });

  it.each([
    ['', 'empty'],
    ['https://other.example/home', 'other origin'],
    ['//other.example/home', 'protocol-relative'],
    ['/\\evil.example', 'backslash'],
    ['/home\nnext', 'control characters'],
  ])('rejects %s (%s)', (value) => {
    expect(sameSitePath(value, ORIGIN)).toBeNull();
  });
});

describe('resolveAuthLanding', () => {
  it.each([
    ['/home', '/home'],
    ['/home/messages', '/home/messages'],
    ['/problem/1001?tid=abc', '/problem/1001?tid=abc'],
  ])('keeps a migrated destination: %s', (value, expected) => {
    expect(resolveAuthLanding(value, ORIGIN)).toBe(expected);
  });

  it.each([
    ['/', 'homepage is served by this UI'],
    ['/home/settings/preference', 'unmigrated settings category'],
    ['/home/settings/domain', 'unmigrated settings category'],
    ['/login', 'login page itself'],
    ['/register/new-code', 'registration page itself'],
    ['https://other.example/home', 'cross-origin'],
    ['', 'empty value'],
  ])('falls back to /home for %s (%s)', (value) => {
    expect(resolveAuthLanding(value, ORIGIN)).toBe('/home');
  });
});
