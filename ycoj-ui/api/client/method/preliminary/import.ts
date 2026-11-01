import { clientRequest } from '@/api/client';
import type { ProblemAutoCompleteResponse } from '@/api/client/method/problem/auto-complete';
import type { Errorable } from '@/shared/types/error';

export const searchObjectiveProblems = (query: string) =>
  clientRequest.Get<Errorable<ProblemAutoCompleteResponse>>(
    '/preliminary/import',
    {
      params: { q: query },
      cacheFor: 0,
    }
  );

export const importObjectiveProblem = (pid: string) =>
  clientRequest.Post<Errorable<{ paperId: string; url: string }>>(
    '/preliminary/import',
    { operation: 'import', pid }
  );
