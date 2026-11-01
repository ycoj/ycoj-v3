import { hasPerm, PERM } from '@/features/user/lib/priv';
import type { User } from '@/shared/types/user';

export type DiscussionPermissionFlags = {
  canCreate: boolean;
  canEditAny: boolean;
  canEditSelf: boolean;
  canDeleteAny: boolean;
  canDeleteSelf: boolean;
  canPin: boolean;
  canHighlight: boolean;
  canLock: boolean;
  canReply: boolean;
  canEditReplySelf: boolean;
  canDeleteReply: boolean;
  canDeleteReplySelf: boolean;
  canDeleteReplyAsOwner: boolean;
  canReact: boolean;
};

/**
 * Mirrors the permissions `DiscussionDetailHandler`, `DiscussionEditHandler`
 * and `DiscussionCreateHandler` check, so the UI never offers an action the
 * backend would reject.
 */
export function resolveDiscussionPermissions(
  user: User | null | undefined
): DiscussionPermissionFlags {
  return {
    canCreate: hasPerm(user, PERM.PERM_CREATE_DISCUSSION),
    canEditAny: hasPerm(user, PERM.PERM_EDIT_DISCUSSION),
    canEditSelf: hasPerm(user, PERM.PERM_EDIT_DISCUSSION_SELF),
    canDeleteAny: hasPerm(user, PERM.PERM_DELETE_DISCUSSION),
    canDeleteSelf: hasPerm(user, PERM.PERM_DELETE_DISCUSSION_SELF),
    canPin: hasPerm(user, PERM.PERM_PIN_DISCUSSION),
    canHighlight: hasPerm(user, PERM.PERM_HIGHLIGHT_DISCUSSION),
    canLock: hasPerm(user, PERM.PERM_LOCK_DISCUSSION),
    canReply: hasPerm(user, PERM.PERM_REPLY_DISCUSSION),
    canEditReplySelf: hasPerm(user, PERM.PERM_EDIT_DISCUSSION_REPLY_SELF),
    canDeleteReply: hasPerm(user, PERM.PERM_DELETE_DISCUSSION_REPLY),
    canDeleteReplySelf: hasPerm(user, PERM.PERM_DELETE_DISCUSSION_REPLY_SELF),
    canDeleteReplyAsOwner: hasPerm(
      user,
      PERM.PERM_DELETE_DISCUSSION_REPLY_SELF_DISCUSSION
    ),
    canReact: hasPerm(user, PERM.PERM_ADD_REACTION),
  };
}

/** Mirrors `postUpdate`: the author needs EDIT_SELF, others need EDIT. */
export function canEditTopic(
  permissions: Pick<DiscussionPermissionFlags, 'canEditAny' | 'canEditSelf'>,
  viewerId: number | undefined,
  topicOwner: number | undefined
): boolean {
  return canManageOwnedContent(
    permissions.canEditAny,
    permissions.canEditSelf,
    viewerId,
    topicOwner
  );
}

/** Mirrors `postDelete`: the author needs DELETE_SELF, others need DELETE. */
export function canDeleteTopic(
  permissions: Pick<
    DiscussionPermissionFlags,
    'canDeleteAny' | 'canDeleteSelf'
  >,
  viewerId: number | undefined,
  topicOwner: number | undefined
): boolean {
  return canManageOwnedContent(
    permissions.canDeleteAny,
    permissions.canDeleteSelf,
    viewerId,
    topicOwner
  );
}

function canManageOwnedContent(
  allowAny: boolean,
  allowSelf: boolean,
  viewerId: number | undefined,
  owner: number | undefined
) {
  if (allowAny) return true;
  return allowSelf && viewerId !== undefined && viewerId === owner;
}

/** Mirrors `postSetLock`: topic owner or `PERM_LOCK_DISCUSSION`. */
export function canLockTopic(
  permissions: Pick<DiscussionPermissionFlags, 'canLock'>,
  viewerId: number | undefined,
  topicOwner: number | undefined
): boolean {
  return canManageOwnedContent(permissions.canLock, true, viewerId, topicOwner);
}

/**
 * Mirrors `postEditReply`: only the reply author with
 * `PERM_EDIT_DISCUSSION_REPLY_SELF`. There is no moderator edit path.
 */
export function canEditTopicReply(
  permissions: Pick<DiscussionPermissionFlags, 'canEditReplySelf'>,
  viewerId: number | undefined,
  replyOwner: number | undefined
): boolean {
  return (
    !!permissions.canEditReplySelf &&
    viewerId !== undefined &&
    replyOwner === viewerId
  );
}

/**
 * Mirrors `postEditTailReply`: the nested reply author only, same permission as
 * top-level reply editing.
 */
export const canEditTopicTailReply = canEditTopicReply;

/**
 * Mirrors `postDeleteReply`:
 * - the reply author with `PERM_DELETE_DISCUSSION_REPLY_SELF`, or
 * - the topic owner with `PERM_DELETE_DISCUSSION_REPLY_SELF_DISCUSSION`, or
 * - anyone with `PERM_DELETE_DISCUSSION_REPLY`.
 */
export function canDeleteTopicReply(
  permissions: Pick<
    DiscussionPermissionFlags,
    'canDeleteReply' | 'canDeleteReplySelf' | 'canDeleteReplyAsOwner'
  >,
  viewerId: number | undefined,
  replyOwner: number | undefined,
  topicOwner: number | undefined
): boolean {
  if (permissions.canDeleteReply) return true;
  if (viewerId === undefined) return false;
  if (viewerId === replyOwner && permissions.canDeleteReplySelf) return true;
  return viewerId === topicOwner && permissions.canDeleteReplyAsOwner;
}

/**
 * Mirrors `postDeleteTailReply`: the tail-reply author with
 * `PERM_DELETE_DISCUSSION_REPLY_SELF`, or `PERM_DELETE_DISCUSSION_REPLY` for
 * moderators. The topic owner has no special tail-reply deletion right.
 */
export function canDeleteTopicTailReply(
  permissions: Pick<
    DiscussionPermissionFlags,
    'canDeleteReply' | 'canDeleteReplySelf'
  >,
  viewerId: number | undefined,
  replyOwner: number | undefined
): boolean {
  return canManageOwnedContent(
    permissions.canDeleteReply,
    permissions.canDeleteReplySelf,
    viewerId,
    replyOwner
  );
}
