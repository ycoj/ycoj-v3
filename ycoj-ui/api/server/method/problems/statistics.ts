import { alova } from '@/api/server';
import type { Errorable } from '@/shared/types/error';
import type { ProblemDoc } from '@/shared/types/problem';
import type {
  ProblemStatDirection,
  ProblemStatSelection,
  ProblemStatSort,
} from '@/shared/types/problem-statistics';
import type { BaseUser, BaseUserDict } from '@/shared/types/user';

export type ProblemStatisticsParams = {
  sort?: ProblemStatSort;
  direction?: ProblemStatDirection;
  lang?: string;
  page?: number;
};

/**
 * One accepted submission from the `record.stat` collection.
 *
 * These documents intentionally omit status, score and code: only the metric
 * fields needed by the performance list are stored per accepted record.
 */
export type ProblemStatRecord = {
  _id: string;
  domainId: string;
  pid: number;
  uid: number;
  time: number;
  memory: number;
  /** Code length in characters. */
  length: number;
  lang: string;
};

export type ProblemStatisticsData = {
  rsdocs: ProblemStatRecord[];
  page: number;
  /** Total number of pages. */
  pcount: number;
  /** Total number of accepted records in the filtered set. */
  rscount: number;
  sort: ProblemStatSort;
  direction: ProblemStatDirection;
  pdoc: ProblemDoc;
  udict: BaseUserDict;
  types: ProblemStatSort[];
  udoc: BaseUser | null;
};

export type ProblemStatisticsResponse = Errorable<ProblemStatisticsData>;

/** Maps the resolved filter state onto the backend request parameters. */
export const buildProblemStatParams = (
  selection: ProblemStatSelection
): ProblemStatisticsParams => ({
  sort: selection.sort,
  direction: selection.direction,
  ...(selection.lang ? { lang: selection.lang } : {}),
  page: selection.page,
});

/**
 * Reads accepted-submission performance for one problem.
 *
 * The backend rejects contest context here, so this is only called from the
 * standalone statistics page without a `tid`.
 */
export const getProblemStatistics = (
  pid: string,
  selection: ProblemStatSelection
) =>
  alova.Get<ProblemStatisticsResponse>(`/p/${pid}/stat`, {
    params: buildProblemStatParams(selection),
  });
