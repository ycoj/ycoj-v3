/**
 * CDN prefix for `/_next/static` and VelociTex, read by `next.config.ts` when
 * Next loads the config. An empty value keeps those URLs on the site origin.
 *
 * Next joins this string directly to `/_next/...`, so the result has no
 * trailing slash. `next dev` ignores it; a production build freezes it into
 * the client bundles and, for standalone output, into `server.js`.
 */
export function normalizeAssetPrefix(
  value: string | undefined
): string | undefined {
  if (value == null) return undefined;
  const trimmed = value.trim();
  if (trimmed === '') return undefined;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error(invalidAssetPrefix(value, 'an absolute http(s) URL'));
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(invalidAssetPrefix(value, 'an http or https URL'));
  }
  if (url.username !== '' || url.password !== '') {
    throw new Error(invalidAssetPrefix(value, 'a URL without user info'));
  }
  if (url.search !== '' || url.hash !== '') {
    throw new Error(invalidAssetPrefix(value, 'a URL without a query or hash'));
  }

  const path = url.pathname.replace(/\/+$/, '');
  return `${url.origin}${path === '/' ? '' : path}`;
}

function invalidAssetPrefix(value: string, expected: string): string {
  return `ASSET_PREFIX must be ${expected}, or empty to serve /_next/static from the site origin. Received ${JSON.stringify(value)}.`;
}
