import { clientRequest } from '@/api/client';
import type { BackendError } from '@/shared/types/sudo';

export type TfaMethodsResponse =
  { tfa?: boolean; authn?: boolean } | BackendError;

export const getTfaMethods = (uname: string) =>
  clientRequest.Get<TfaMethodsResponse>('/user/tfa', {
    params: { q: uname },
    cacheFor: 0,
  });
