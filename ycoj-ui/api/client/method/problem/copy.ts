import { clientRequest } from '@/api/client';
import type { Errorable } from '@/shared/types/error';

export type CopyDomainItem = {
  _id: string;
  name?: string;
  avatarUrl?: string;
};

/** Without `redirect`, a successful copy answers with the new document IDs. */
export type CopyProblemsResponse = Errorable<number[] | { url?: string }>;

export type CopyProblemsOptions = {
  hidden?: boolean;
  redirect?: boolean;
};

export const copyProblems = (
  pids: number[],
  target: string,
  options: CopyProblemsOptions = {}
) =>
  clientRequest.Post<CopyProblemsResponse>('/p', {
    operation: 'copy',
    pids,
    target,
    ...(options.hidden === undefined ? {} : { hidden: options.hidden }),
    ...(options.redirect === undefined ? {} : { redirect: options.redirect }),
  });

/**
 * Finds domains the current user can reach. With an empty query the backend
 * returns the domains the user belongs to, which is the useful default for a
 * copy target picker.
 */
export const searchCopyTargetDomains = async (query: string) => {
  const response = await clientRequest
    .Get<CopyDomainItem[] | Errorable<never>>('/domain/search', {
      params: query.trim() ? { q: query.trim() } : {},
    })
    .send();
  return Array.isArray(response) ? response : [];
};
