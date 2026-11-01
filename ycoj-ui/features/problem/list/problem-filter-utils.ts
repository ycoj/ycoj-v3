export type ProblemSortMetric = 'default' | 'recent';
export type ProblemSortDirection = 'asc' | 'desc';

export type ProblemFilterSearchParams = {
  q?: string;
  page?: string;
  showTags?: string;
  category?: string;
  difficulty?: string;
  namespace?: string;
  sort?: string;
  dir?: string;
};

export type ProblemFilters = {
  /** Free-text search terms; expression keywords stay in the structured fields. */
  q: string;
  category: string[];
  /** Selected difficulty levels (0 = unrated, 1–8 = rated). */
  difficulty: number[];
  namespace: string;
  sort: ProblemSortMetric;
  dir: ProblemSortDirection;
  showTags: boolean;
  page: number;
};

export type ProblemDifficultyRange = {
  min: number | null;
  max: number | null;
};

export const MAX_PROBLEM_DIFFICULTY = 8;

/** Each server ordering has one direction the problem handler can produce. */
export const DEFAULT_PROBLEM_SORT_DIRECTION: Record<
  ProblemSortMetric,
  ProblemSortDirection
> = {
  default: 'asc',
  recent: 'desc',
};

const DIFFICULTY_LEVELS = Array.from(
  { length: MAX_PROBLEM_DIFFICULTY + 1 },
  (_, level) => level
);

const splitList = (value: string | undefined) =>
  (value ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

const parsePage = (value: string | undefined) => {
  if (!value || !/^\d+$/.test(value.trim())) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
};

export function parseProblemSortMetric(value: string | undefined) {
  return value?.trim().toLowerCase() === 'recent' ? 'recent' : 'default';
}

export function parseProblemSortDirection(value: string | undefined) {
  return value?.trim().toLowerCase() === 'desc' ? 'desc' : 'asc';
}

export function isProblemSortDirectionSupported(
  metric: ProblemSortMetric,
  direction: ProblemSortDirection
) {
  return DEFAULT_PROBLEM_SORT_DIRECTION[metric] === direction;
}

/**
 * Returns the server ordering closest to the requested one. The problem list
 * handler only exposes ascending problem order and newest-first order, so an
 * unsupported direction falls back to the metric's fixed direction.
 */
export function normalizeProblemSort(
  metric: ProblemSortMetric,
  direction?: ProblemSortDirection
): { metric: ProblemSortMetric; direction: ProblemSortDirection } {
  const requested = direction ?? DEFAULT_PROBLEM_SORT_DIRECTION[metric];
  return isProblemSortDirectionSupported(metric, requested)
    ? { metric, direction: requested }
    : { metric, direction: DEFAULT_PROBLEM_SORT_DIRECTION[metric] };
}

/**
 * Flips the display direction. The problem list exposes exactly two server
 * orderings (problem order ascending and newest first), so the reverse of one
 * is the other ordering in its own direction.
 */
export function flipProblemSort(
  metric: ProblemSortMetric,
  direction: ProblemSortDirection
): { metric: ProblemSortMetric; direction: ProblemSortDirection } {
  const nextDirection: ProblemSortDirection =
    direction === 'asc' ? 'desc' : 'asc';
  if (isProblemSortDirectionSupported(metric, nextDirection))
    return { metric, direction: nextDirection };
  if (isProblemSortDirectionSupported(metric, direction))
    return metric === 'default'
      ? { metric: 'recent', direction: 'desc' }
      : { metric: 'default', direction: 'asc' };
  return normalizeProblemSort(metric, nextDirection);
}

export function normalizeDifficultyLevel(value: unknown): number | null {
  const level =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
        ? Number(value)
        : Number.NaN;
  return Number.isSafeInteger(level) &&
    level >= 0 &&
    level <= MAX_PROBLEM_DIFFICULTY
    ? level
    : null;
}

type ParsedProblemExpression = {
  text: string;
  category: string[];
  difficulty: number[];
  namespace: string;
};

/**
 * Reads the `category:`, `difficulty:`, and `namespace:` tokens the backend
 * understands. Everything else is free-text search.
 */
export function parseProblemQueryExpression(
  input: string | undefined
): ParsedProblemExpression {
  const parsed: ParsedProblemExpression = {
    text: '',
    category: [],
    difficulty: [],
    namespace: '',
  };
  const text: string[] = [];

  for (const token of (input ?? '').split(/\s+/)) {
    if (!token) continue;
    const separator = token.indexOf(':');
    if (separator <= 0) {
      text.push(token);
      continue;
    }
    const keyword = token.slice(0, separator).toLowerCase();
    const value = token.slice(separator + 1);
    if (!value) {
      text.push(token);
      continue;
    }
    if (keyword === 'category') {
      parsed.category.push(...splitList(value));
    } else if (keyword === 'difficulty') {
      for (const level of splitList(value)) {
        const normalized = normalizeDifficultyLevel(level);
        if (normalized !== null) parsed.difficulty.push(normalized);
      }
    } else if (keyword === 'namespace') {
      parsed.namespace = value;
    } else {
      text.push(token);
    }
  }

  parsed.category = Array.from(new Set(parsed.category));
  parsed.difficulty = Array.from(new Set(parsed.difficulty)).sort(
    (a, b) => a - b
  );
  parsed.text = text.join(' ');
  return parsed;
}

/**
 * Parses list URL state. Expression keywords in `q` remain supported for old
 * shared links; the structured parameters win when both are present.
 */
export function parseProblemFilters(
  params: ProblemFilterSearchParams
): ProblemFilters {
  const expression = parseProblemQueryExpression(params.q);
  const structuredCategory = splitList(params.category);
  const structuredDifficulty = splitList(params.difficulty)
    .map(normalizeDifficultyLevel)
    .filter((level): level is number => level !== null);
  const category = Array.from(
    new Set(
      structuredCategory.length ? structuredCategory : expression.category
    )
  );
  const difficulty = Array.from(
    new Set(
      structuredDifficulty.length ? structuredDifficulty : expression.difficulty
    )
  ).sort((a, b) => a - b);
  const namespace = (params.namespace ?? '').trim();
  const metric = parseProblemSortMetric(params.sort);
  const { direction } = normalizeProblemSort(
    metric,
    parseProblemSortDirection(params.dir)
  );

  return {
    q: expression.text.trim(),
    category,
    difficulty,
    namespace: namespace || expression.namespace,
    sort: metric,
    dir: direction,
    showTags: params.showTags === 'true',
    page: parsePage(params.page),
  };
}

/**
 * Applies free-form search input. Keywords typed into the search box replace
 * the matching structured filter; categories and levels selected elsewhere
 * stay active when the input has no keyword for them, matching the legacy
 * problem-set search.
 */
export function applyProblemSearchInput(
  filters: ProblemFilters,
  input: string
): ProblemFilters {
  const expression = parseProblemQueryExpression(input);
  return updateProblemFilters(filters, {
    q: expression.text.trim(),
    ...(expression.category.length ? { category: expression.category } : {}),
    ...(expression.difficulty.length
      ? { difficulty: expression.difficulty }
      : {}),
    ...(expression.namespace ? { namespace: expression.namespace } : {}),
  });
}

export function serializeProblemFilters(filters: ProblemFilters) {
  const params: Record<string, string> = {};
  if (filters.q) params.q = filters.q;
  if (filters.category.length) params.category = filters.category.join(',');
  if (filters.difficulty.length)
    params.difficulty = filters.difficulty.join(',');
  if (filters.namespace) params.namespace = filters.namespace;
  if (filters.sort !== 'default') params.sort = filters.sort;
  if (filters.dir !== DEFAULT_PROBLEM_SORT_DIRECTION[filters.sort])
    params.dir = filters.dir;
  if (filters.showTags) params.showTags = 'true';
  if (filters.page > 1) params.page = String(filters.page);
  return params;
}

/**
 * Applies a filter change and returns to the first page unless the change is a
 * page change itself.
 */
export function updateProblemFilters(
  filters: ProblemFilters,
  patch: Partial<ProblemFilters>
): ProblemFilters {
  const next: ProblemFilters = { ...filters, ...patch };
  if (patch.page === undefined) next.page = 1;
  const { direction } = normalizeProblemSort(next.sort, next.dir);
  return { ...next, dir: direction };
}

export function problemFilterHref(pathname: string, filters: ProblemFilters) {
  const query = new URLSearchParams(
    serializeProblemFilters(filters)
  ).toString();
  return query ? `${pathname}?${query}` : pathname;
}

const quoteFilterValue = (value: string) =>
  /\s/.test(value) ? JSON.stringify(value) : value;

/**
 * Builds the backend `q` expression. The problem list handler parses
 * `category:`, `difficulty:`, and `namespace:` tokens; everything else is
 * reserved for full-text search.
 */
export function buildProblemQuery(filters: ProblemFilters) {
  const parts: string[] = [];
  if (filters.q) parts.push(filters.q);
  if (filters.category.length)
    parts.push(`category:${filters.category.map(quoteFilterValue).join(',')}`);
  for (const level of filters.difficulty) parts.push(`difficulty:${level}`);
  if (filters.namespace)
    parts.push(`namespace:${quoteFilterValue(filters.namespace)}`);
  return parts.join(' ');
}

/**
 * The random-problem handler only understands `category:` terms, so this
 * deliberately drops text, difficulty, and namespace filters.
 */
export function buildRandomProblemQuery(category: string[]) {
  const tags = category.filter((tag) => tag && !/\s/.test(tag));
  return tags.length ? `category:${tags.join(',')}` : '';
}

export function levelsToDifficultyRange(
  levels: number[]
): ProblemDifficultyRange {
  const valid = levels
    .map(normalizeDifficultyLevel)
    .filter((level): level is number => level !== null)
    .sort((a, b) => a - b);
  if (!valid.length) return { min: null, max: null };
  return { min: valid[0], max: valid[valid.length - 1] };
}

export function difficultyRangeToLevels(
  range: ProblemDifficultyRange
): number[] {
  const min = normalizeDifficultyLevel(range.min);
  const max = normalizeDifficultyLevel(range.max);
  const lower = Math.min(
    min ?? DIFFICULTY_LEVELS[0],
    max ?? MAX_PROBLEM_DIFFICULTY
  );
  const upper = Math.max(
    min ?? DIFFICULTY_LEVELS[0],
    max ?? MAX_PROBLEM_DIFFICULTY
  );
  return DIFFICULTY_LEVELS.filter((level) => level >= lower && level <= upper);
}
