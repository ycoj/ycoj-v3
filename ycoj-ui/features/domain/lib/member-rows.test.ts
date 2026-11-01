import {
  assignableRoles,
  buildMemberRows,
  canSelectMember,
  serializeMembersRaw,
  toggleAllSelection,
  toggleSelection,
} from './member-rows';
import type { DomainUserDoc } from '@/api/server/method/domain/types';
import { describe, expect, it } from 'vitest';

const rudocs: Record<string, DomainUserDoc[]> = {
  root: [
    { _id: 2, uname: 'owner', role: 'root', join: true, mail: '', avatar: '' },
  ],
  member: [
    {
      _id: 3,
      uname: 'alice',
      role: 'member',
      join: true,
      mail: '',
      avatar: '',
    },
    { _id: 4, uname: 'bob', role: 'member', join: false, mail: '', avatar: '' },
  ],
  guest: [{ _id: 5, uname: 'carol', join: false, mail: '', avatar: '' }],
};

describe('member rows', () => {
  it('flattens role groups preserving each user role', () => {
    expect(buildMemberRows(rudocs)).toEqual([
      {
        _id: 2,
        uname: 'owner',
        role: 'root',
        join: true,
        mail: '',
        avatar: '',
      },
      {
        _id: 3,
        uname: 'alice',
        role: 'member',
        join: true,
        mail: '',
        avatar: '',
      },
      {
        _id: 4,
        uname: 'bob',
        role: 'member',
        join: false,
        mail: '',
        avatar: '',
      },
      {
        _id: 5,
        uname: 'carol',
        role: 'guest',
        join: false,
        mail: '',
        avatar: '',
      },
    ]);
  });

  it('never offers guest as an assignable role', () => {
    expect(
      assignableRoles([{ _id: 'guest' }, { _id: 'member' }, { _id: 'root' }])
    ).toEqual([{ _id: 'member' }, { _id: 'root' }]);
  });

  it('excludes the owner from selection', () => {
    expect(
      canSelectMember({ _id: 2, uname: 'owner', mail: '', avatar: '' }, 2)
    ).toBe(false);
    expect(
      canSelectMember({ _id: 3, uname: 'alice', mail: '', avatar: '' }, 2)
    ).toBe(true);
  });

  it('toggles a single member without duplicates', () => {
    expect(toggleSelection([3], 3, true)).toEqual([3]);
    expect(toggleSelection([3], 4, true)).toEqual([3, 4]);
    expect(toggleSelection([3, 4], 3, false)).toEqual([4]);
  });

  it('toggles all rows at once', () => {
    const rows = buildMemberRows(rudocs);
    expect(toggleAllSelection([], rows, true)).toEqual([2, 3, 4, 5]);
    expect(toggleAllSelection([2, 3], rows, false)).toEqual([]);
  });

  it('serializes the raw export format', () => {
    expect(
      serializeMembersRaw([
        {
          _id: 3,
          uname: 'alice',
          role: 'member',
          displayName: 'Alice A',
          mail: '',
          avatar: '',
        },
        { _id: 4, uname: 'bob', role: 'member', mail: '', avatar: '' },
      ])
    ).toBe('3,member,alice,Alice A\n4,member,bob,');
  });
});
