import { clientRequest } from '@/api/client';
import type { BaseUser } from '@/shared/types/user';

export type UserAutoCompleteItem = Pick<BaseUser, 'contestRating'> & {
  _id: number;
  uname: string;
  displayName?: string;
  avatarUrl?: string;
};

const projection = [
  '_id',
  'uname',
  'displayName',
  'avatarUrl',
  'contestRating',
] as const;

const usersEndpoint = (domainId: string) =>
  `/d/${encodeURIComponent(domainId)}/api/users`;

export const searchUsers = (domainId: string, query: string) =>
  clientRequest.Post<UserAutoCompleteItem[]>(usersEndpoint(domainId), {
    args: { search: query },
    projection,
  });

export const getUsersByIds = (domainId: string, userIds: string[]) =>
  clientRequest.Post<UserAutoCompleteItem[]>(usersEndpoint(domainId), {
    args: { auto: userIds },
    projection,
  });
