import { clientRequest } from '@/api/client';
import type { DomainMutationResponse } from '@/api/client/method/domain/mutation';

/** Assign a role to selected members, optionally marking them joined. */
export const setDomainUsers = (uids: number[], role: string, join: boolean) =>
  clientRequest.Post<DomainMutationResponse>('/domain/user', {
    operation: 'set_users',
    uids,
    role,
    join,
  });

/** Revoke membership: resets selected members to `guest` and un-joins them. */
export const kickDomainUsers = (uids: number[]) =>
  clientRequest.Post<DomainMutationResponse>('/domain/user', {
    operation: 'kick',
    uids,
  });
