import { clientRequest } from '@/api/client';
import type { Errorable } from '@/shared/types/error';

export type RandomProblemResponse = Errorable<{
  pid?: string | number;
  url?: string;
}>;

/**
 * Requests one random problem. The backend only applies `category:` terms from
 * the query, so callers should pass a category-only expression.
 */
export const getRandomProblem = (query?: string) =>
  clientRequest.Get<RandomProblemResponse>('/problem/random', {
    params: query ? { q: query } : {},
  });

/**
 * Maps the backend problem-detail URL (`/p/P1000`) onto this app's problem
 * route (`/problem/P1000`). Other URLs are kept unchanged.
 */
export function randomProblemHref(response: {
  pid?: string | number;
  url?: string;
}): string | null {
  if (typeof response.url === 'string' && response.url) {
    const url = response.url;
    if (url.startsWith('/p/')) return `/problem/${url.slice(3)}`;
    if (url.startsWith('/problem/')) return url;
  }
  if (
    response.pid !== undefined &&
    response.pid !== null &&
    response.pid !== ''
  )
    return `/problem/${response.pid}`;
  return null;
}
