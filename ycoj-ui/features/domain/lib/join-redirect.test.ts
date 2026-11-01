import { resolvePostJoinPath } from './join-redirect';
import { describe, expect, it } from 'vitest';

describe('post-join destination', () => {
  it('opens the homepage when the joined domain is the active one', () => {
    expect(resolvePostJoinPath('/home?x=1', 'school')).toBe('/home');
    expect(resolvePostJoinPath('/d/school/home', 'school')).toBe('/home');
  });

  it('falls back to the domain list for another domain', () => {
    expect(resolvePostJoinPath('/d/team/home', 'school')).toBe('/home/domain');
    expect(
      resolvePostJoinPath('/d/system/home?notification=joined', 'school')
    ).toBe('/home/domain');
  });

  it('defaults to the homepage when no destination is returned', () => {
    expect(resolvePostJoinPath(undefined, 'school')).toBe('/home');
    expect(resolvePostJoinPath('', 'school')).toBe('/home');
    expect(resolvePostJoinPath('not a url', 'school')).toBe('/home/domain');
  });
});
