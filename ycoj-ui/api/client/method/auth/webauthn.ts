import type { WebauthnOptionsResponse } from './sudo';
import { clientRequest } from '@/api/client';
import type { BackendError, BackendRedirect } from '@/shared/types/sudo';
import type { AuthenticationResponseJSON } from '@simplewebauthn/browser';

export const getLoginWebauthnOptions = (uname: string) =>
  clientRequest.Get<WebauthnOptionsResponse>('/user/webauthn', {
    params: { uname, login: false },
    cacheFor: 0,
  });

export const submitWebauthnAssertion = (result: AuthenticationResponseJSON) =>
  clientRequest.Post<BackendRedirect | BackendError>('/user/webauthn', {
    result,
  });
