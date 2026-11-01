import { createCheckConnUrl } from './check-conn-url';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('check connection URL', () => {
  afterEach(() => {
    document.cookie = 'sid=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
    vi.unstubAllEnvs();
  });

  it('returns null when no websocket base is configured', () => {
    expect(createCheckConnUrl('')).toBeNull();
    expect(createCheckConnUrl('not a url')).toBeNull();
    expect(createCheckConnUrl('ftp://example.com/')).toBeNull();
  });

  it('maps https to wss and keeps base subpaths', () => {
    const url = new URL(createCheckConnUrl('https://oj.example.com/hydro/')!);
    expect(url.protocol).toBe('wss:');
    expect(url.pathname).toBe('/hydro/manage/check-conn');
  });

  it('maps http to ws', () => {
    const url = new URL(createCheckConnUrl('http://localhost:8080/')!);
    expect(url.protocol).toBe('ws:');
    expect(url.pathname).toBe('/manage/check-conn');
  });

  it('adds the session cookie only for cross-origin diagnostics', () => {
    document.cookie = 'sid=admin-session; path=/';
    const sameOrigin = new URL(
      createCheckConnUrl(`wss://${window.location.host}/`)!
    );
    expect(sameOrigin.searchParams.has('sid')).toBe(false);

    const crossOrigin = new URL(
      createCheckConnUrl('wss://backend.example.com/admin/')!
    );
    expect(crossOrigin.searchParams.get('sid')).toBe('admin-session');
  });
});
