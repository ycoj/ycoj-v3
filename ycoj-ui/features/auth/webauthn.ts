'use client';

import ClientApis from '@/api/client/method';
import { throwBackendError } from '@/shared/lib/backend-response';
import { startAuthentication } from '@simplewebauthn/browser';

function supportsSecurityKeys() {
  return window.isSecureContext && 'credentials' in navigator;
}

/**
 * Runs a WebAuthn assertion and returns the challenge the backend now marks as
 * verified. Passing `uname` prepares the credential list for an account that
 * has not signed in yet; omitting it reuses the current session's credential.
 */
export async function requestWebauthnAssertion(
  uname: string | undefined,
  failureMessage: string
) {
  if (!supportsSecurityKeys()) throw new Error(failureMessage);

  const options = uname
    ? await ClientApis.Auth.getLoginWebauthnOptions(uname).send()
    : await ClientApis.Auth.getWebauthnOptions().send();
  throwBackendError(options);
  if (!('authOptions' in options)) throw new Error(failureMessage);

  const result = await startAuthentication({
    optionsJSON: options.authOptions,
  });
  const response = uname
    ? await ClientApis.Auth.submitWebauthnAssertion(result).send()
    : await ClientApis.Auth.verifyWebauthn(result).send();
  throwBackendError(response);

  return options.authOptions.challenge;
}
