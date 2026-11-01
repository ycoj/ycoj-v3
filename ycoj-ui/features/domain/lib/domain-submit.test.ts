import { resolveDomainRedirect } from './domain-submit';
import { describe, expect, it } from 'vitest';

describe('domain mutation redirects', () => {
  it.each([
    ['/domain/dashboard', '/domain'],
    ['/domain/edit', '/domain/edit'],
    ['/domain/user', '/domain/user'],
    ['/domain/role', '/domain/role'],
    ['/domain/permission', '/domain/permission'],
    ['/domain/group', '/domain/group'],
    ['/domain/join_applications', '/domain/join-applications'],
    ['/home/domain', '/home/domain'],
  ])('maps %s to the new UI route', (url, expected) => {
    expect(resolveDomainRedirect(url, '/fallback')).toBe(expected);
  });

  it('preserves the query string for mapped URLs', () => {
    expect(resolveDomainRedirect('/home/domain?x=1', '/fallback')).toBe(
      '/home/domain?x=1'
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
