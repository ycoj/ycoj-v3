import { alova } from '@/api/server';
import type { Errorable } from '@/shared/types/error';
import type { SecurityData } from '@/shared/types/security';

export type SecurityResponse = Errorable<SecurityData> | { url: string };

export type ChangeMailConfirmationResponse =
  | { url: string }
  | {
      error: {
        message?: string;
        name?: string;
        params?: unknown[];
      };
    };

export const getSecuritySettings = () =>
  alova.Get<SecurityResponse>('/home/security', { cacheFor: 0 });

/**
 * Consumes the email-change token. The backend mutates the account on GET and
 * redirects to `/home/security`.
 */
export const confirmChangeMail = (code: string) =>
  alova.Get<ChangeMailConfirmationResponse>(
    `/home/changeMail/${encodeURIComponent(code)}`,
    { cacheFor: 0 }
  );
