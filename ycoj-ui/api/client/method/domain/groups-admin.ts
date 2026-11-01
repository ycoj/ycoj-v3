import { clientRequest } from '@/api/client';
import type { DomainMutationResponse } from '@/api/client/method/domain/account';

/** Upsert a group and its full member list. Empty `uids` clears membership. */
export const updateDomainGroup = (name: string, uids: number[]) =>
  clientRequest.Post<DomainMutationResponse>('/domain/group', {
    operation: 'update',
    name,
    uids,
  });

export const deleteDomainGroup = (name: string) =>
  clientRequest.Post<DomainMutationResponse>('/domain/group', {
    operation: 'del',
    name,
  });
