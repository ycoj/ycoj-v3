import type { DiscussionPermissionFlags } from './permissions';
import {
  canDeleteTopic,
  canDeleteTopicReply,
  canDeleteTopicTailReply,
  canEditTopic,
  canEditTopicReply,
  canEditTopicTailReply,
  canLockTopic,
  resolveDiscussionPermissions,
} from './permissions';
import { PERM } from '@/features/user/lib/priv';
import type { User } from '@/shared/types/user';
import { describe, expect, it } from 'vitest';

function userWith(perms: bigint[], id = 1): User {
  return {
    _id: id,
    uname: 'viewer',
    mail: '',
    avatar: '',
    perm: `BigInt::${perms.reduce((acc, perm) => acc | perm, BigInt(0))}`,
    priv: 0,
    role: 'default',
    regat: '',
    loginat: '',
    tfa: false,
    authn: false,
  };
}

function flags(
  overrides: Partial<DiscussionPermissionFlags> = {}
): DiscussionPermissionFlags {
  return {
    canCreate: false,
    canEditAny: false,
    canEditSelf: false,
    canDeleteAny: false,
    canDeleteSelf: false,
    canPin: false,
    canHighlight: false,
    canLock: false,
    canReply: false,
    canEditReplySelf: false,
    canDeleteReply: false,
    canDeleteReplySelf: false,
    canDeleteReplyAsOwner: false,
    canReact: false,
    ...overrides,
  };
}

describe('resolveDiscussionPermissions', () => {
  it('maps each backend permission into the matching flag', () => {
    const permissions = resolveDiscussionPermissions(
      userWith([
        PERM.PERM_CREATE_DISCUSSION,
        PERM.PERM_EDIT_DISCUSSION,
        PERM.PERM_EDIT_DISCUSSION_SELF,
        PERM.PERM_DELETE_DISCUSSION,
        PERM.PERM_DELETE_DISCUSSION_SELF,
        PERM.PERM_PIN_DISCUSSION,
        PERM.PERM_HIGHLIGHT_DISCUSSION,
        PERM.PERM_LOCK_DISCUSSION,
        PERM.PERM_REPLY_DISCUSSION,
        PERM.PERM_EDIT_DISCUSSION_REPLY_SELF,
        PERM.PERM_DELETE_DISCUSSION_REPLY,
        PERM.PERM_DELETE_DISCUSSION_REPLY_SELF,
        PERM.PERM_DELETE_DISCUSSION_REPLY_SELF_DISCUSSION,
        PERM.PERM_ADD_REACTION,
      ])
    );
    expect(Object.values(permissions).every(Boolean)).toBe(true);
  });

  it('grants nothing to anonymous visitors', () => {
    const permissions = resolveDiscussionPermissions(null);
    expect(Object.values(permissions).some(Boolean)).toBe(false);
  });
});

describe('topic ownership branches', () => {
  it.each([
    ['author with edit-self', { canEditSelf: true }, 7, 7, true],
    ['author without edit-self', {}, 7, 7, false],
    ['moderator with edit-any', { canEditAny: true }, 1, 7, true],
    ['stranger with only edit-self', { canEditSelf: true }, 8, 7, false],
    ['anonymous', { canEditSelf: true }, undefined, 7, false],
  ] as const)('edit: %s', (_label, overrides, viewerId, owner, expected) => {
    expect(canEditTopic(flags(overrides), viewerId, owner)).toBe(expected);
  });

  it.each([
    ['author with delete-self', { canDeleteSelf: true }, 7, 7, true],
    ['author without delete-self', {}, 7, 7, false],
    ['moderator with delete-any', { canDeleteAny: true }, 1, 7, true],
    ['stranger', { canDeleteSelf: true }, 8, 7, false],
  ] as const)('delete: %s', (_label, overrides, viewerId, owner, expected) => {
    expect(canDeleteTopic(flags(overrides), viewerId, owner)).toBe(expected);
  });

  it.each([
    ['author without lock permission', {}, 7, 7, true],
    ['author with lock permission', { canLock: true }, 7, 7, true],
    ['moderator with lock permission', { canLock: true }, 1, 7, true],
    ['stranger without lock permission', {}, 8, 7, false],
  ] as const)('lock: %s', (_label, overrides, viewerId, owner, expected) => {
    expect(canLockTopic(flags(overrides), viewerId, owner)).toBe(expected);
  });
});

describe('reply ownership branches', () => {
  it.each([
    ['reply author with edit-self', { canEditReplySelf: true }, 7, 7, true],
    ['reply author without permission', {}, 7, 7, false],
    [
      'moderator can never edit another author reply',
      { canEditReplySelf: true, canEditAny: true },
      1,
      7,
      false,
    ],
    ['anonymous', { canEditReplySelf: true }, undefined, 7, false],
  ] as const)(
    'edit reply: %s',
    (_label, overrides, viewerId, replyOwner, expected) => {
      expect(canEditTopicReply(flags(overrides), viewerId, replyOwner)).toBe(
        expected
      );
      expect(
        canEditTopicTailReply(flags(overrides), viewerId, replyOwner)
      ).toBe(expected);
    }
  );

  it.each([
    [
      'reply author with delete-self',
      { canDeleteReplySelf: true },
      7,
      7,
      70,
      true,
    ],
    [
      'topic owner with owner-delete permission',
      { canDeleteReplyAsOwner: true },
      70,
      7,
      70,
      true,
    ],
    ['topic owner without owner-delete permission', {}, 70, 7, 70, false],
    ['moderator with delete-any', { canDeleteReply: true }, 1, 7, 70, true],
    ['stranger', { canDeleteReplySelf: true }, 8, 7, 70, false],
  ] as const)(
    'delete reply: %s',
    (_label, overrides, viewerId, replyOwner, topicOwner, expected) => {
      expect(
        canDeleteTopicReply(flags(overrides), viewerId, replyOwner, topicOwner)
      ).toBe(expected);
    }
  );

  it.each([
    [
      'tail-reply author with delete-self',
      { canDeleteReplySelf: true },
      7,
      7,
      true,
    ],
    [
      'topic owner without global delete permission',
      { canDeleteReplySelf: true, canDeleteReplyAsOwner: true },
      70,
      7,
      false,
    ],
    ['moderator with delete-any', { canDeleteReply: true }, 1, 7, true],
    ['stranger', { canDeleteReplySelf: true }, 8, 7, false],
  ] as const)(
    'delete tail reply: %s',
    (_label, overrides, viewerId, replyOwner, expected) => {
      expect(
        canDeleteTopicTailReply(flags(overrides), viewerId, replyOwner)
      ).toBe(expected);
    }
  );
});
