import { clientRequest } from '@/api/client';
import type { BackendError } from '@/shared/types/sudo';

export type RegisterStartResponse =
  { url?: string; mail?: string } | BackendError;

export const startRegistration = (mail: string) =>
  clientRequest.Post<RegisterStartResponse>('/register', { mail });

export type RegisterCompleteRequest = {
  code: string;
  password: string;
  verifyPassword: string;
  uname?: string;
};

export type RegisterCompleteResponse = { url: string } | BackendError;

export const completeRegistration = ({
  code,
  ...payload
}: RegisterCompleteRequest) =>
  clientRequest.Post<RegisterCompleteResponse>(
    `/register/${encodeURIComponent(code)}`,
    { code, ...payload }
  );
