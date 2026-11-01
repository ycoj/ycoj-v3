import { clientRequest } from '@/api/client';
import type { HydroError } from '@/shared/types/error';
import type { ObjectId } from '@/shared/types/shared';

type ProblemActionResponse = { error?: HydroError; star?: boolean };

/** Stars or unstars a problem for the current user. */
export const starProblem = (pid: string | number, star: boolean) =>
  clientRequest.Post<ProblemActionResponse>(`/p/${pid}`, {
    operation: 'star',
    star,
  });

/** Rejudges every normal submission of one problem. */
export const rejudgeProblem = (pid: string | number, tid?: ObjectId) =>
  clientRequest.Post<ProblemActionResponse>(
    `/p/${pid}`,
    { operation: 'rejudge', pid: Number(pid) },
    { params: tid ? { tid } : {} }
  );
