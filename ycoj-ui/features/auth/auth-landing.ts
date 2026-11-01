/** Keeps auth redirects on a same-site page the new UI can actually render. */
const HOME_PATH = '/home';

const REPLACED_PATHS = new Set([
  '/home/settings/preference',
  '/home/settings/domain',
  '/login',
  '/register',
  '/lostpass',
]);

/**
 * Returns a same-origin path for a backend redirect, or `null` when the value
 * points at another origin or cannot be parsed. Backend `url()` results are
 * usually path-only, so a relative value is resolved against the given origin.
 */
export function sameSitePath(value: string, origin: string): string | null {
  if (!value || /[\\\u0000- ]/.test(value)) return null;

  let url: URL;
  try {
    url = new URL(value, origin);
  } catch {
    return null;
  }

  if (url.origin !== origin) return null;
  if (!url.pathname.startsWith('/')) return null;

  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * Turns a backend post-auth redirect into a same-origin path. Unknown or
 * unmigrated destinations fall back to the home page so the user never lands
 * on a page this UI does not serve.
 */
export function resolveAuthLanding(value: string, origin: string): string {
  const path = sameSitePath(value, origin);
  if (!path) return HOME_PATH;

  const pathname = path.split(/[?#]/, 1)[0];
  if (pathname === '/') return HOME_PATH;
  if (REPLACED_PATHS.has(pathname)) return HOME_PATH;
  if (pathname.startsWith('/login/') || pathname.startsWith('/register/'))
    return HOME_PATH;

  return path;
}
