import { alova } from '@/api/server';
import type {
  ListProjectionProblem,
  ProblemStatusDict,
} from '@/shared/types/problem';

export type ProblemListResponse = {
  page: number;
  pcount: number;
  ppcount: number;
  /** Elasticsearch-style count relation. */
  pcountRelation: 'eq' | 'gte';
  pdocs: ListProjectionProblem[];
  psdict: ProblemStatusDict;
  qs: string;
  /** Domain-wide unreviewed solution count, available to reviewers. */
  pendingSolutionCount?: number;
};

export const getProblemsList = (query?: string, page?: number) =>
  alova.Get<ProblemListResponse>('/p', {
    params: {
      q: query,
      page,
    },
  });
