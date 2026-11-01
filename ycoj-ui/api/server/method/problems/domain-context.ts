import { alova } from '@/api/server';

export type ProblemDomainContext = {
  _id: string;
  name?: string;
  /** Maps a namespace label to the PID prefix used for that namespace. */
  namespaces?: Record<string, string>;
};

type CurrentDomainResponse = {
  domain?: ProblemDomainContext | null;
};

/**
 * Loads the active domain context. The problem list uses the namespace map to
 * offer the same `namespace:` filter the backend understands.
 */
export const getProblemDomainContext = async () => {
  try {
    const response = await alova.Get<CurrentDomainResponse>(
      '/api/domain.current'
    );
    return response?.domain ?? null;
  } catch {
    return null;
  }
};
