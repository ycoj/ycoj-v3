import type { LoginRequest } from '@/api/client/method/auth/login';
import type { HydroError } from '@/shared/types/error';

export type LoginAttempt = Pick<
  LoginRequest,
  'uname' | 'password' | 'rememberme' | 'redirect'
>;

export type LoginCredential = { tfa: string } | { authnChallenge: string };

export type TfaMethods = { tfa: boolean; authn: boolean };

function paramsOf(error: HydroError) {
  return Array.isArray(error.params) ? error.params.map(String) : [];
}

/**
 * Detects the validation error the backend raises when an account has a second
 * factor configured but the attempt carried neither a code nor an assertion.
 * The backend always mentions both factors, so the caller must probe the
 * account to learn which ones are actually enabled.
 */
export function requiredChallenge(error: HydroError): boolean {
  return error.name === 'ValidationError' && paramsOf(error).includes('2FA');
}

/** Assembles the retry payload once a second factor has been provided. */
export function buildLoginPayload(
  attempt: LoginAttempt,
  credential?: LoginCredential
): LoginRequest {
  return { ...attempt, ...credential };
}

/** Normalizes the factor probe; unknown values never count as enabled. */
export function readTfaMethods(value: unknown): TfaMethods | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as { tfa?: unknown; authn?: unknown };
  if (typeof record.tfa !== 'boolean' && typeof record.authn !== 'boolean')
    return null;
  return { tfa: record.tfa === true, authn: record.authn === true };
}
