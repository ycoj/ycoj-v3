import type {
  DomainPermission,
  DomainRoleDoc,
} from '@/api/server/method/domain/types';

/** Parses the backend's `BigInt::{decimal}` encoding into a bigint. */
export function parseBigInt(value: string | bigint | number | undefined) {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(value);
  if (!value) return BigInt(0);
  return BigInt(value.replace(/^BigInt::/, ''));
}

/** Bit index of a permission's power-of-two `key`, e.g. `128` → `"7"`. */
export function permissionBit(permission: Pick<DomainPermission, 'key'>) {
  const value = parseBigInt(permission.key);
  if (value <= BigInt(0)) return null;
  return value.toString(2).length - 1 + '';
}

export function hasPermission(
  mask: bigint,
  permission: Pick<DomainPermission, 'key'>
) {
  return (mask & parseBigInt(permission.key)) === parseBigInt(permission.key);
}

export function togglePermission(
  mask: bigint,
  permission: Pick<DomainPermission, 'key'>
) {
  const bit = parseBigInt(permission.key);
  return hasPermission(mask, permission) ? mask & ~bit : mask | bit;
}

/**
 * Mirrors the backend `Types.Role` pattern so invalid names are rejected before
 * the request: letters, digits, underscores, and CJK characters, 1-31 long.
 */
export const ROLE_NAME_PATTERN = /^[\w\u4E00-\u9FA5]{1,31}$/;

/** Root always holds all permissions and is not editable. */
export function isEditableRole(role: string) {
  return role !== 'root';
}

export function isBuiltinRole(role: string) {
  return ['guest', 'default', 'root'].includes(role);
}

export type PermissionFamily = {
  family: string;
  permissions: DomainPermission[];
};

/**
 * Builds the permission matrix from the backend contract. The backend returns
 * a family→permissions map; this keeps declaration order stable for rendering
 * tables, which matters because the matrix is scanned column-wise.
 */
export function buildPermissionMatrix(
  permsByFamily: Record<string, DomainPermission[]>
): PermissionFamily[] {
  return Object.entries(permsByFamily).map(([family, permissions]) => ({
    family,
    permissions: permissions.filter((permission) =>
      Boolean(parseBigInt(permission.key))
    ),
  }));
}

/** Groups roles into editable and built-in sets for the role list UI. */
export function splitRoles(roles: DomainRoleDoc[]) {
  return {
    editable: roles.filter((role) => !isBuiltinRole(role._id)),
    builtin: roles.filter((role) => isBuiltinRole(role._id)),
  };
}

/**
 * Serializes the matrix form state into the `role → bit index[]` payload the
 * permission endpoint expects. `root` is omitted because the backend rejects
 * writes to it.
 */
export function serializePermissions(
  matrix: Map<string, bigint>
): Record<string, bigint[]> {
  const payload: Record<string, bigint[]> = {};
  for (const [role, mask] of matrix) {
    if (!isEditableRole(role)) continue;
    payload[role] = maskToBits(mask);
  }
  return payload;
}

export function maskToBits(mask: bigint) {
  const bits: bigint[] = [];
  const binary = mask < 0 ? BigInt.asUintN(64, mask) : mask;
  for (let index = BigInt(0); index < BigInt(128); index += BigInt(1)) {
    if ((binary >> index) & BigInt(1)) bits.push(index);
  }
  return bits;
}

export function bitsToMask(bits: Array<string | bigint | number>) {
  let mask = BigInt(0);
  for (const bit of bits) {
    mask |= BigInt(1) << BigInt(bit);
  }
  return mask;
}

/** Initial editable matrix state keyed by role id. */
export function initialPermissionState(roles: DomainRoleDoc[]) {
  const state = new Map<string, bigint>();
  for (const role of roles) {
    if (isEditableRole(role._id)) state.set(role._id, parseBigInt(role.perm));
  }
  return state;
}
