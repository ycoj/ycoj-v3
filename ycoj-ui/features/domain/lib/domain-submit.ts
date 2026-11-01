import {
  backendPathname,
  throwBackendError,
} from '@/shared/lib/backend-response';
import {
  navigateToSudo,
  SudoRedirectError,
} from '@/shared/lib/sudo-navigation';

export type DomainMutationResult = { url?: string; error?: unknown };

/**
 * Legacy backend page URLs mapped to the new UI routes. Domain management
 * redirects and `Handler#back()` referers both point at the server-rendered
 * pages, which do not exist under those paths in the new UI.
 */
const DOMAIN_PAGE_ROUTES: Record<string, string> = {
  '/domain/dashboard': '/domain',
  '/domain/edit': '/domain/edit',
  '/domain/user': '/domain/user',
  '/domain/role': '/domain/role',
  '/domain/permission': '/domain/permission',
  '/domain/group': '/domain/group',
  '/domain/join_applications': '/domain/join-applications',
  '/domain/join': '/domain/join',
  '/home/domain': '/home/domain',
};

/**
 * Resolves where to navigate after a domain mutation. Sudo continuation returns
 * the original backend path, and several operations return the legacy
 * dashboard URL, so known page paths are translated; anything else falls back
 * to the caller's current page.
 */
export function resolveDomainRedirect(
  url: string | undefined,
  fallback: string
) {
  if (!url) return fallback;
  const pathname = backendPathname(url);
  if (!pathname) return fallback;
  const mapped = DOMAIN_PAGE_ROUTES[pathname];
  if (!mapped) return fallback;
  let search = '';
  try {
    search = new URL(url, 'https://ui.invalid').search;
  } catch {
    search = '';
  }
  return `${mapped}${search}`;
}

/**
 * Sends a domain mutation and normalizes the three possible outcomes: an error
 * envelope, a sudo redirect (which throws), or a success redirect. The caller
 * receives the next route rather than having to inspect the backend shape.
 */
export async function submitDomainMutation(
  request: { send: () => Promise<unknown> },
  fallback: string
): Promise<string> {
  const response = (await request.send()) as DomainMutationResult;
  throwBackendError(response);
  if (
    response &&
    typeof response === 'object' &&
    'url' in response &&
    typeof response.url === 'string' &&
    backendPathname(response.url) === '/user/sudo'
  )
    navigateToSudo();
  return resolveDomainRedirect(
    typeof response.url === 'string' ? response.url : undefined,
    fallback
  );
}

/**
 * Sudo confirmation is in progress, so a caller must not report the mutation as
 * failed while the shared flow navigates away.
 */
export function isSudoRedirect(error: unknown) {
  return error instanceof SudoRedirectError;
}
