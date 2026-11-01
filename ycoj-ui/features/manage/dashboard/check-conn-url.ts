/**
 * Builds the diagnostics WebSocket URL for `/manage/check-conn`.
 * Mirrors the shared record socket helper but stays feature-local because the
 * admin endpoint is not a record connection. Returns null when no WebSocket
 * base URL is configured, which lets the dashboard degrade to a notice.
 */
export function createCheckConnUrl(
  base = process.env.NEXT_PUBLIC_WEBSOCKET_BASEURL
): string | null {
  if (!base) return null;

  let url: URL;
  try {
    const normalizedBase = base.endsWith('/') ? base : `${base}/`;
    url = new URL('manage/check-conn', normalizedBase);
  } catch {
    return null;
  }

  if (url.protocol === 'https:') url.protocol = 'wss:';
  else if (url.protocol === 'http:') url.protocol = 'ws:';
  if (url.protocol !== 'wss:' && url.protocol !== 'ws:') return null;

  if (typeof window !== 'undefined' && url.host !== window.location.host) {
    const sid = document.cookie
      .split('; ')
      .find((cookie) => cookie.startsWith('sid='))
      ?.slice('sid='.length);
    if (sid) url.searchParams.set('sid', sid);
  }

  return url.toString();
}
