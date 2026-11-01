import { clientRequest } from '@/api/client';
import type { DomainMutationResponse } from '@/api/client/method/domain/account';

export const createDomainRole = (role: string) =>
  clientRequest.Post<DomainMutationResponse>('/domain/role', {
    operation: 'add',
    role,
  });

export const deleteDomainRoles = (roles: string[]) =>
  clientRequest.Post<DomainMutationResponse>('/domain/role', {
    operation: 'delete',
    roles,
  });

/**
 * Saves permission bitmasks per role. Each value is the permission bit index
 * set for that role; the backend combines them into a bigint mask.
 */
export const saveDomainPermissions = (roles: Record<string, bigint[]>) =>
  clientRequest.Post<DomainMutationResponse>(
    '/domain/permission',
    Object.fromEntries(
      Object.entries(roles).map(([role, bits]) => [
        role,
        bits.map((bit) => bit.toString()),
      ])
    )
  );
