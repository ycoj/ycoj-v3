import { clientRequest } from '@/api/client';
import type { Errorable } from '@/shared/types/error';

/** Every domain mutation answers with `{url}` or `{error}` under JSON. */
export type DomainMutationResponse = Errorable<{ url?: string }>;

export type LeaveDomainPayload = { operation: 'leave'; id: string };

export const leaveDomain = (domainId: string) =>
  clientRequest.Post<DomainMutationResponse>('/home/domain', {
    operation: 'leave',
    id: domainId,
  } satisfies LeaveDomainPayload);

export type CreateDomainPayload = {
  id: string;
  name: string;
  bulletin: string;
  avatar?: string;
};

export const createDomain = (payload: CreateDomainPayload) =>
  clientRequest.Post<DomainMutationResponse>('/home/domain/create', payload);

export type StarDomainPayload = {
  operation: 'star';
  id: string;
  star: boolean;
};

export const setDomainStar = (domainId: string, star: boolean) =>
  clientRequest.Post<Errorable<{ star?: boolean }>>('/home/domain', {
    operation: 'star',
    id: domainId,
    star,
  } satisfies StarDomainPayload);

export type JoinDomainPayload = {
  target: string;
  code?: string;
  redirect?: string;
};

export const joinDomain = (payload: JoinDomainPayload) =>
  clientRequest.Post<DomainMutationResponse>('/domain/join', payload);
