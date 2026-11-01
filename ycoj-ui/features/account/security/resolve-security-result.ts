import {
  isSudoRequired,
  throwBackendError,
} from '@/shared/lib/backend-response';
import { SudoRedirectError } from '@/shared/lib/sudo-navigation';

export type SecurityActionResult = 'success' | 'sudo';

/**
 * Normalizes a security mutation response. The shared client adapter already
 * redirects to sudo and throws `SudoRedirectError`; this also covers a raw
 * `{ url: '/user/sudo' }` body from other transports.
 *
 * A successful mutation may legitimately redirect to `/login` (changing the
 * password revokes every session), so callers decide navigation from `url`.
 * A sudo result is safe to ignore: the global listener already navigates.
 */
export function resolveSecurityResult<T extends object>(
  response: T
): SecurityActionResult {
  throwBackendError(response);
  if (isSudoRequired(response)) return 'sudo';
  return 'success';
}

/** Returns a user-facing message for a failed security action, if any. */
export function securityErrorMessage(error: unknown, fallback: string) {
  if (error instanceof SudoRedirectError) return null;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/**
 * Normalizes a mutation response or rethrows the failure. The sudo hand-off is
 * swallowed (the global listener navigates) so form-level handlers never show
 * it as an error.
 */
export function assertSecurityResult<T extends object>(response: T) {
  try {
    return resolveSecurityResult(response);
  } catch (error) {
    if (error instanceof SudoRedirectError) return 'sudo' as const;
    throw error;
  }
}
