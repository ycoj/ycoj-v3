import { resolveDomainRedirect } from './domain-submit';
import { describe, expect, it } from 'vitest';

describe('domain mutation redirects', () => {
  it.each([
    ['/domain/dashboard', '/domain'],
    ['/domain/edit', '/domain/edit'],
    ['/domain/user', '/domain/user'],
    ['/domain/coins', '/domain/coins'],
    ['/domain/role', '/domain/role'],
    ['/domain/permission', '/domain/permission'],
    ['/domain/group', '/domain/group'],
  ])('maps %s to the new UI route', (url, expected) => {
    expect(resolveDomainRedirect(url, '/fallback')).toBe(expected);
  });

  it('preserves the query string for mapped URLs', () => {
    expect(resolveDomainRedirect('/domain/user?x=1', '/fallback')).toBe(
      '/domain/user?x=1'
    );
  });

  it('falls back for unknown destinations or missing URLs', () => {
    expect(resolveDomainRedirect(undefined, '/fallback')).toBe('/fallback');
    expect(resolveDomainRedirect('', '/fallback')).toBe('/fallback');
    expect(resolveDomainRedirect('/contest/abc', '/domain/user')).toBe(
      '/domain/user'
    );
    expect(resolveDomainRedirect('not a url', '/fallback')).toBe('/fallback');
  });

  it('does not translate a sudo URL into a domain page', () => {
    expect(resolveDomainRedirect('/user/sudo', '/domain/user')).toBe(
      '/domain/user'
    );
  });
});
