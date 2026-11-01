import { clientRequest } from '@/api/client';
import type { Errorable } from '@/shared/types/error';

export type DeleteAccountResponse = Errorable<{ url: string }>;

/**
 * Schedules account deletion. The backend verifies the password and starts a
 * seven-day countdown before returning a redirect (or a pending template).
 */
export const requestAccountDeletion = (password: string) =>
  clientRequest.Post<DeleteAccountResponse>('/user/delete', { password });
