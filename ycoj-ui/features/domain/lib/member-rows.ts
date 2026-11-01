import type { DomainUserDoc } from '@/api/server/method/domain/types';

/** Members grouped by role plus the roles still offered for assignment. */
export type MemberRow = DomainUserDoc & { role: string };

/** Excludes `guest` from both the picker and add-user menus, matching legacy. */
export function assignableRoles(roles: { _id: string }[]) {
  return roles.filter((role) => role._id !== 'guest');
}

export function buildMemberRows(
  rudocs: Record<string, DomainUserDoc[]>
): MemberRow[] {
  return Object.entries(rudocs).flatMap(([role, users]) =>
    users.map((user) => ({ ...user, role: user.role ?? role }))
  );
}

/** Only joined members can be kicked; the owner is never selectable. */
export function canSelectMember(user: DomainUserDoc, ownerId?: number) {
  return user._id !== ownerId;
}

export function toggleSelection(
  selected: number[],
  uid: number,
  checked: boolean
) {
  return checked
    ? Array.from(new Set([...selected, uid]))
    : selected.filter((value) => value !== uid);
}

export function toggleAllSelection(
  selected: number[],
  rows: MemberRow[],
  checked: boolean
) {
  if (!checked) return selected.filter(() => false);
  return Array.from(new Set([...selected, ...rows.map((row) => row._id)]));
}

/** The raw export is `uid,role,uname,displayName` per line. */
export function serializeMembersRaw(rows: MemberRow[]) {
  return rows
    .map(
      (row) => `${row._id},${row.role},${row.uname},${row.displayName ?? ''}`
    )
    .join('\n');
}
