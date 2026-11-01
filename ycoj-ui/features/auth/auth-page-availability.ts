import type { AuthPageError } from '@/shared/types/auth';

/**
 * A public auth page answered with a redirect instead of its content means the
 * backend refused to serve it, for example when registration is disabled.
 */
export function isAuthPageAvailable(
  response: Record<string, unknown> | { url: string } | AuthPageError
) {
  if ('error' in response) return false;
  if ('url' in response && typeof response.url === 'string') return false;
  return true;
}
