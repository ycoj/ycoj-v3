import { isSameDomain } from './my-domains';

/**
 * After joining, the backend redirects to the joined domain's homepage:
 * `/home?...` for the active domain, or `/d/{id}/home?...` for another domain.
 * The new UI only renders the active domain as a client route, so a different
 * domain lands on the domain list instead of a backend-owned `/d/` page.
 */
export function resolvePostJoinPath(
  url: string | undefined,
  activeDomainId: string,
  fallback = '/home/domain'
) {
  if (!url) return '/home';
  let pathname: string;
  try {
    pathname = new URL(url, 'https://ui.invalid').pathname.replace(/\/+$/, '');
  } catch {
    return fallback;
  }
  // `/d/{id}/home` — the new UI cannot switch to another domain by URL.
  const prefixed = /^\/d\/([^/]+)\/home$/.exec(pathname);
  if (prefixed) {
    const targetId = decodeURIComponent(prefixed[1]);
    return isSameDomain(targetId, activeDomainId) ? '/home' : '/home/domain';
  }
  if (pathname === '/home') return '/home';
  return fallback;
}
