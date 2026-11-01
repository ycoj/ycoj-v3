import { clientRequest } from '@/api/client';
import type { BackendError } from '@/shared/types/sudo';

export type LostpassStartResponse = { url?: string } | BackendError;

export const requestPasswordReset = (mail: string) =>
  clientRequest.Post<LostpassStartResponse>('/lostpass', { mail });

export type LostpassCompleteRequest = {
  code: string;
  password: string;
  verifyPassword: string;
};

export type LostpassCompleteResponse = { url: string } | BackendError;

export const resetPassword = ({ code, ...payload }: LostpassCompleteRequest) =>
  clientRequest.Post<LostpassCompleteResponse>(
    `/lostpass/${encodeURIComponent(code)}`,
    { code, ...payload }
  );
