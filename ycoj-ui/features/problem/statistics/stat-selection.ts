import { PROBLEM_STAT_SORTS } from '@/shared/types/problem-statistics';
import type {
  ProblemStatDirection,
  ProblemStatQuery,
  ProblemStatSelection,
} from '@/shared/types/problem-statistics';

const isStatSort = (value: unknown): value is ProblemStatSortLike =>
  typeof value === 'string' &&
  (PROBLEM_STAT_SORTS as readonly string[]).includes(value);

type ProblemStatSortLike = (typeof PROBLEM_STAT_SORTS)[number];

/** A repeated query parameter arrives as an array; the first value wins. */
const firstValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

/**
 * Normalizes URL query values into the request the backend accepts.
 *
 * The backend defaults `sort` to `time` and `direction` to ascending; keep the
 * same defaults so an empty URL matches the rendered controls.
 */
export function resolveProblemStatSelection(
  query: ProblemStatQuery
): ProblemStatSelection {
  const sort = firstValue(query.sort);
  const direction = firstValue(query.direction);
  const lang = firstValue(query.lang);
  const page = firstValue(query.page);

  const sortValue = isStatSort(sort) ? sort : 'time';
  const directionValue: ProblemStatDirection = direction === '-1' ? -1 : 1;
  const pageNumber = Number(page);

  return {
    sort: sortValue,
    direction: directionValue,
    lang: lang?.trim() ?? '',
    page: Number.isSafeInteger(pageNumber) && pageNumber > 0 ? pageNumber : 1,
  };
}

/**
 * Applies a filter change and resets pagination.
 *
 * Changing the metric, direction or language shows page 1; paging keeps the
 * other filters untouched.
 */
export function applyStatFilterChange(
  selection: ProblemStatSelection,
  patch: Partial<Omit<ProblemStatSelection, 'page'>>
): ProblemStatSelection {
  return { ...selection, ...patch, page: 1 };
}

/** Toggles a sort direction between ascending and descending. */
export function toggleProblemStatDirection(
  direction: ProblemStatDirection
): ProblemStatDirection {
  return direction === -1 ? 1 : -1;
}

/** Builds the next URL query string for a selection. */
export function buildStatSearchParams(selection: ProblemStatSelection): string {
  const params = new URLSearchParams();
  params.set('sort', selection.sort);
  params.set('direction', String(selection.direction));
  if (selection.lang) params.set('lang', selection.lang);
  if (selection.page > 1) params.set('page', String(selection.page));
  return params.toString();
}

/** Flattens allowed languages into individual versions for the filter. */
export function flattenStatLanguages(
  languages: Record<
    string,
    { display: string; versions: Array<{ name: string; display: string }> }
  >
): Array<{ name: string; display: string }> {
  return Object.values(languages).flatMap((family) =>
    family.versions.map((version) => ({
      name: version.name,
      display: version.display,
    }))
  );
}
