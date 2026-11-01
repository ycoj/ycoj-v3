import type { AuthPageError } from '@/shared/types/auth';
import type { HydroError } from '@/shared/types/error';

export type CodeState<T> =
  | { kind: 'ready'; data: T }
  | { kind: 'invalid' }
  | { kind: 'blocked' }
  | { kind: 'error'; error: HydroError };

/**
 * Splits a token page response into the states the completion form must show:
 * a usable token, an expired or forged token, a refused feature, or a failure.
 */
export function resolveCodeState<T extends object>(
  response: T | AuthPageError | { url: string }
): CodeState<T> {
  if ('error' in response) {
    return response.error.name === 'InvalidTokenError'
      ? { kind: 'invalid' }
      : { kind: 'error', error: response.error };
  }
  if ('url' in response && typeof response.url === 'string') {
    return { kind: 'blocked' };
  }
  return { kind: 'ready', data: response as T };
}
