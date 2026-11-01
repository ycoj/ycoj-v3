/** Sort metrics exposed by the backend `record.STAT_QUERY` map. */
export const PROBLEM_STAT_SORTS = ['time', 'memory', 'length', 'date'] as const;

export type ProblemStatSort = (typeof PROBLEM_STAT_SORTS)[number];

/** The backend accepts `-1` (descending) or `1` (ascending). */
export type ProblemStatDirection = -1 | 1;

/** Query parameters accepted by `GET /p/:pid/stat`. */
export type ProblemStatQuery = {
  sort?: string | string[];
  direction?: string | string[];
  lang?: string | string[];
  page?: string | string[];
};

/** Resolved filter state used by the page and its controls. */
export type ProblemStatSelection = {
  sort: ProblemStatSort;
  direction: ProblemStatDirection;
  lang: string;
  page: number;
};
