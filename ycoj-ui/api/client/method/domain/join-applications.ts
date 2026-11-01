import { clientRequest } from '@/api/client';
import type { DomainMutationResponse } from '@/api/client/method/domain/account';

export type SaveJoinSettingsPayload = {
  method: 0 | 1 | 2;
  role?: string;
  group?: string;
  expire?: number;
  invitationCode?: string;
};

export const saveDomainJoinApplications = (payload: SaveJoinSettingsPayload) =>
  clientRequest.Post<DomainMutationResponse>(
    '/domain/join_applications',
    payload
  );
