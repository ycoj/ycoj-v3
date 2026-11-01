import type { SolutionPermissionFlags } from './solution-reply-permissions';
import {
  canDeleteSolutionReply,
  canEditSolutionReply,
  canManageSolution,
  canReplyToSolution,
  resolveSolutionPermissions,
} from './solution-reply-permissions';
import { PERM } from '@/features/user/lib/priv';
import type { User } from '@/shared/types/user';
import { describe, expect, it } from 'vitest';

function userWith(perms: bigint[]): User {
  return {
    _id: 1,
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
  overrides: Partial<SolutionPermissionFlags> = {}
): SolutionPermissionFlags {
  return {
    allowEditAny: false,
    allowEditSelf: false,
    allowDeleteAny: false,
    allowDeleteSelf: false,
    allowReply: false,
    allowEditReplySelf: false,
    allowDeleteReplyAny: false,
    allowDeleteReplySelf: false,
    ...overrides,
  };
}

describe('resolveSolutionPermissions', () => {
  it('reads the solution and reply permissions independently', () => {
    expect(
      resolveSolutionPermissions(
        userWith([
          PERM.PERM_EDIT_PROBLEM_SOLUTION,
          PERM.PERM_REPLY_PROBLEM_SOLUTION,
          PERM.PERM_DELETE_PROBLEM_SOLUTION_REPLY,
        ])
      )
    ).toEqual({
      allowEditAny: true,
      allowEditSelf: false,
      allowDeleteAny: false,
      allowDeleteSelf: false,
      allowReply: true,
      allowEditReplySelf: false,
      allowDeleteReplyAny: true,
      allowDeleteReplySelf: false,
    });
  });

  it('grants nothing to anonymous visitors', () => {
    const permissions = resolveSolutionPermissions(undefined);
    expect(Object.values(permissions).some(Boolean)).toBe(false);
  });
});

describe('solution reply permissions', () => {
  it.each([
    ['author with edit-self', { allowEditReplySelf: true }, 3, 3, true],
    ['author without permission', {}, 3, 3, false],
    [
      'moderator cannot edit another author reply',
      { allowEditReplySelf: true, allowEditAny: true },
      1,
      3,
      false,
    ],
    ['anonymous', { allowEditReplySelf: true }, undefined, 3, false],
  ] as const)(
    'edit: %s',
    (_label, overrides, viewerId, replyOwner, expected) => {
      expect(canEditSolutionReply(flags(overrides), replyOwner, viewerId)).toBe(
        expected
      );
    }
  );

  it.each([
    ['author with self-delete', { allowDeleteReplySelf: true }, 3, 3, true],
    ['author without permission', {}, 3, 3, false],
    ['moderator with delete-any', { allowDeleteReplyAny: true }, 1, 3, true],
    ['stranger', { allowDeleteReplySelf: true }, 4, 3, false],
  ] as const)(
    'delete: %s',
    (_label, overrides, viewerId, replyOwner, expected) => {
      expect(
        canDeleteSolutionReply(flags(overrides), replyOwner, viewerId)
      ).toBe(expected);
    }
  );

  it('hides the reply form for blocked authors or without reply permission', () => {
    expect(canReplyToSolution({ allowReply: true }, false)).toBe(true);
    expect(canReplyToSolution({ allowReply: true }, true)).toBe(false);
    expect(canReplyToSolution({ allowReply: false }, false)).toBe(false);
  });

  it('keeps the solution edit/delete ownership branch unchanged', () => {
    expect(
      canManageSolution(
        flags({ allowEditSelf: true, allowDeleteAny: true }),
        3,
        3
      )
    ).toEqual({ canEdit: true, canDelete: true });
    expect(canManageSolution(flags({ allowEditSelf: true }), 3, 4)).toEqual({
      canEdit: false,
      canDelete: false,
    });
  });
});
