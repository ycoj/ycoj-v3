import type { HydroError } from '@/shared/types/error';

/** Translation keys under the `auth` namespace, keyed by backend error name. */
export type AuthErrorKey =
  | 'loginError'
  | 'retryError'
  | 'accountExpired'
  | 'accountBanned'
  | 'loginDisabled'
  | 'tooManyAttempts'
  | 'invalidEmail'
  | 'emailTaken'
  | 'emailBlocked'
  | 'noAccount'
  | 'mailUnavailable'
  | 'invalidToken'
  | 'weakPassword'
  | 'usernameInvalid'
  | 'usernameTaken'
  | 'registerUnavailable';

function nameOf(error: HydroError) {
  return typeof error.name === 'string' ? error.name : '';
}

function paramsOf(error: HydroError) {
  return Array.isArray(error.params) ? error.params.map(String) : [];
}

export function loginErrorKey(error: HydroError): AuthErrorKey {
  switch (nameOf(error)) {
    case 'LoginError':
    case 'UserNotFoundError':
      return 'loginError';
    case 'AccountExpiredError':
      return 'accountExpired';
    case 'BlacklistedError':
      return 'accountBanned';
    case 'BuiltinLoginError':
      return 'loginDisabled';
    case 'OpcountExceededError':
      return 'tooManyAttempts';
    default:
      return 'retryError';
  }
}

export function registerStartErrorKey(error: HydroError): AuthErrorKey {
  switch (nameOf(error)) {
    case 'UserAlreadyExistError':
      return 'emailTaken';
    case 'BlacklistedError':
      return 'emailBlocked';
    case 'ValidationError':
      return 'invalidEmail';
    case 'OpcountExceededError':
      return 'tooManyAttempts';
    // The route requires the registration privilege, so a guest without it is
    // refused before the mail is ever sent.
    case 'PrivilegeError':
    case 'PermissionError':
    case 'BuiltinLoginError':
    case 'ForbiddenError':
      return 'registerUnavailable';
    default:
      return 'retryError';
  }
}

export function registerCompleteErrorKey(error: HydroError): AuthErrorKey {
  switch (nameOf(error)) {
    case 'UserAlreadyExistError':
      return 'usernameTaken';
    case 'InvalidTokenError':
      return 'invalidToken';
    case 'ValidationError':
      return paramsOf(error).includes('uname')
        ? 'usernameInvalid'
        : 'retryError';
    case 'VerifyPasswordError':
      return 'retryError';
    default:
      return 'retryError';
  }
}

export function lostpassStartErrorKey(error: HydroError): AuthErrorKey {
  switch (nameOf(error)) {
    case 'UserNotFoundError':
      return 'noAccount';
    case 'SystemError':
      return 'mailUnavailable';
    case 'OpcountExceededError':
      return 'tooManyAttempts';
    case 'ValidationError':
      return 'invalidEmail';
    default:
      return 'retryError';
  }
}

export function lostpassCompleteErrorKey(error: HydroError): AuthErrorKey {
  switch (nameOf(error)) {
    case 'InvalidTokenError':
      return 'invalidToken';
    case 'ValidationError':
      return paramsOf(error).includes('password')
        ? 'weakPassword'
        : 'retryError';
    default:
      return 'retryError';
  }
}
