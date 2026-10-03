import { hasPerm, PERM } from '@/features/user/lib/priv';
import type { User } from '@/shared/types/user';

type ProblemForEditCheck = {
  owner: number;
  reference?: unknown;
};

type Options = {
  tid?: string;
};

/**
 * Single source of truth for "can edit problem" permission.
 * Covers: login check, reference-problem guard, contest-mode guard,
 * and (owner + PERM_EDIT_PROBLEM_SELF) || PERM_EDIT_PROBLEM.
 */
export function canEditProblem(
  user: User | null | undefined,
  pdoc: ProblemForEditCheck,
  options?: Options
): boolean {
  // A visitor who is not signed in has no user record; metadata and layout
  // guards may still run this before the login redirect takes effect.
  if (!user?._id) return false;
  if (pdoc.reference) return false;
  if (options?.tid) return false;

  const isOwner = user._id === pdoc.owner;
  const hasSelfPerm = hasPerm(user, PERM.PERM_EDIT_PROBLEM_SELF);
  const hasEditPerm = hasPerm(user, PERM.PERM_EDIT_PROBLEM);

  return (isOwner && hasSelfPerm) || hasEditPerm;
}
