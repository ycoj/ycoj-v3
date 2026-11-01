import { hasPerm, PERM } from '@/features/user/lib/priv';
import type { User } from '@/shared/types/user';

export type SolutionPermissionFlags = {
  allowEditAny: boolean;
  allowEditSelf: boolean;
  allowDeleteAny: boolean;
  allowDeleteSelf: boolean;
  allowReply: boolean;
  allowEditReplySelf: boolean;
  allowDeleteReplyAny: boolean;
  allowDeleteReplySelf: boolean;
};

/**
 * Mirrors `ProblemSolutionHandler`: solution and reply mutations each have a
 * domain-wide permission plus an author permission. Reply editing has no
 * moderator variant — the backend only accepts the reply author.
 */
export function resolveSolutionPermissions(
  user: User | null | undefined
): SolutionPermissionFlags {
  return {
    allowEditAny: hasPerm(user, PERM.PERM_EDIT_PROBLEM_SOLUTION),
    allowEditSelf: hasPerm(user, PERM.PERM_EDIT_PROBLEM_SOLUTION_SELF),
    allowDeleteAny: hasPerm(user, PERM.PERM_DELETE_PROBLEM_SOLUTION),
    allowDeleteSelf: hasPerm(user, PERM.PERM_DELETE_PROBLEM_SOLUTION_SELF),
    allowReply: hasPerm(user, PERM.PERM_REPLY_PROBLEM_SOLUTION),
    allowEditReplySelf: hasPerm(
      user,
      PERM.PERM_EDIT_PROBLEM_SOLUTION_REPLY_SELF
    ),
    allowDeleteReplyAny: hasPerm(user, PERM.PERM_DELETE_PROBLEM_SOLUTION_REPLY),
    allowDeleteReplySelf: hasPerm(
      user,
      PERM.PERM_DELETE_PROBLEM_SOLUTION_REPLY_SELF
    ),
  };
}

/**
 * The backend requires both ownership and the reply-self edit permission; no
 * moderator override exists for solution replies.
 */
export function canEditSolutionReply(
  permissions: Pick<SolutionPermissionFlags, 'allowEditReplySelf'>,
  replyOwner: number | undefined,
  viewerId: number | undefined
): boolean {
  return (
    !!permissions.allowEditReplySelf &&
    viewerId !== undefined &&
    replyOwner === viewerId
  );
}

/**
 * Reply authors use their self-delete permission; moderators use the
 * domain-wide reply delete permission regardless of ownership.
 */
export function canDeleteSolutionReply(
  permissions: Pick<
    SolutionPermissionFlags,
    'allowDeleteReplyAny' | 'allowDeleteReplySelf'
  >,
  replyOwner: number | undefined,
  viewerId: number | undefined
): boolean {
  if (permissions.allowDeleteReplyAny) return true;
  return (
    !!permissions.allowDeleteReplySelf &&
    viewerId !== undefined &&
    replyOwner === viewerId
  );
}

export function canReplyToSolution(
  permissions: Pick<SolutionPermissionFlags, 'allowReply'>,
  solutionBlocked: boolean | undefined
): boolean {
  return !!permissions.allowReply && !solutionBlocked;
}

/** Authors and editors of the solution itself, as `SolutionItem` checks. */
export function canManageSolution(
  permissions: Pick<
    SolutionPermissionFlags,
    'allowEditAny' | 'allowEditSelf' | 'allowDeleteAny' | 'allowDeleteSelf'
  >,
  solutionOwner: number,
  viewerId: number | undefined
) {
  const owns = viewerId !== undefined && viewerId === solutionOwner;
  return {
    canEdit: permissions.allowEditAny || (permissions.allowEditSelf && owns),
    canDelete:
      permissions.allowDeleteAny || (permissions.allowDeleteSelf && owns),
  };
}
