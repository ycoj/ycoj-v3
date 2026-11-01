import { clientRequest } from '@/api/client';
import type { Errorable } from '@/shared/types/error';

export type ProblemBulkOperation = 'hide' | 'unhide' | 'delete';

/**
 * A bulk action answers with the framework "back" redirect. Under JSON accept
 * that becomes `{ url }`; statuses that cannot change a problem answer with
 * `{ error }`.
 */
export type ProblemBulkResponse = Errorable<{ url?: string }>;

export const bulkUpdateProblems = (
  operation: ProblemBulkOperation,
  pids: number[]
) => clientRequest.Post<ProblemBulkResponse>('/p', { operation, pids });
