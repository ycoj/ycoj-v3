import {
  bitsToMask,
  buildPermissionMatrix,
  hasPermission,
  initialPermissionState,
  isBuiltinRole,
  isEditableRole,
  maskToBits,
  ROLE_NAME_PATTERN,
  parseBigInt,
  permissionBit,
  serializePermissions,
  splitRoles,
  togglePermission,
} from './domain-permissions';
import type { DomainRoleDoc } from '@/api/server/method/domain/types';
import { describe, expect, it } from 'vitest';

const ROLE_FIXTURE: DomainRoleDoc[] = [
  { _id: 'default', perm: 'BigInt::5' },
  { _id: 'root', perm: 'BigInt::-1' },
  { _id: 'teacher', perm: 'BigInt::256' },
];

const JOINT_MASK_FIXTURE = BigInt(5);

describe('permission bitmask helpers', () => {
  it.each([
    ['BigInt::1', BigInt(1)],
    ['BigInt::255', BigInt(255)],
    ['BigInt::-1', BigInt(-1)],
    ['', BigInt(0)],
  ])('parses %s', (value, expected) => {
    expect(parseBigInt(value)).toBe(expected);
  });

  it('derives the bit index from a power-of-two key', () => {
    expect(permissionBit({ key: 'BigInt::128' })).toBe('7');
  });

  it('tests and toggles permissions without disturbing other bits', () => {
    const view = { key: 'BigInt::1' };
    const submit = { key: 'BigInt::512' };
    const mask = bitsToMask([0]);

    expect(hasPermission(mask, view)).toBe(true);
    expect(hasPermission(mask, submit)).toBe(false);

    const withSubmit = togglePermission(mask, submit);
    expect(withSubmit).toBe(BigInt(513));
    expect(hasPermission(withSubmit, view)).toBe(true);
    expect(hasPermission(withSubmit, submit)).toBe(true);

    const withoutView = togglePermission(withSubmit, view);
    expect(withoutView).toBe(BigInt(512));
  });

  it('round-trips a mask through bit indices', () => {
    const mask = bitsToMask([0, 4, 7, 10]);
    expect(maskToBits(mask)).toEqual([
      BigInt(0),
      BigInt(4),
      BigInt(7),
      BigInt(10),
    ]);
    expect(bitsToMask(maskToBits(mask))).toBe(mask);
  });

  it('treats negative masks as 64-bit unsigned for bit extraction', () => {
    expect(maskToBits(BigInt(-1))).toHaveLength(64);
  });

  it('serializes editable roles only and omits root', () => {
    const state = new Map<string, bigint>([
      ['root', BigInt(-1)],
      ['teacher', BigInt(5)],
      ['guest', BigInt(0)],
    ]);
    expect(serializePermissions(state)).toEqual({
      teacher: [BigInt(0), BigInt(2)],
      guest: [],
    });
  });

  it.each([
    ['teacher', true],
    ['Class_2024', true],
    ['老师', true],
    ['a-b', false],
    ['', false],
    ['x'.repeat(32), false],
  ])('validates role names %j', (name, valid) => {
    expect(ROLE_NAME_PATTERN.test(name)).toBe(valid);
  });

  it('classifies built-in and editable roles', () => {
    expect(isBuiltinRole('root')).toBe(true);
    expect(isBuiltinRole('guest')).toBe(true);
    expect(isBuiltinRole('teacher')).toBe(false);
    expect(isEditableRole('root')).toBe(false);
    expect(isEditableRole('teacher')).toBe(true);
  });

  it('builds the matrix in declaration order and drops empty keys', () => {
    const matrix = buildPermissionMatrix({
      perm_general: [
        { family: 'perm_general', key: 'BigInt::1', desc: 'view' },
      ],
      broken: [{ family: 'broken', key: 'BigInt::0', desc: 'none' }],
    });
    expect(matrix).toEqual([
      {
        family: 'perm_general',
        permissions: [
          { family: 'perm_general', key: 'BigInt::1', desc: 'view' },
        ],
      },
      { family: 'broken', permissions: [] },
    ]);
  });

  it('initializes editable state from role masks', () => {
    const state = initialPermissionState(ROLE_FIXTURE);
    expect(state.get('root')).toBeUndefined();
    expect(state.get('default')).toBe(JOINT_MASK_FIXTURE);
  });

  it('splits roles into editable and built-in groups', () => {
    const groups = splitRoles(ROLE_FIXTURE);
    expect(groups.editable.map((role) => role._id)).toEqual(['teacher']);
    expect(groups.builtin.map((role) => role._id)).toEqual(['default', 'root']);
  });
});
