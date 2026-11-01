import { PERM } from '@/features/user/lib/priv';

/**
 * The permission endpoint returns each permission as a power-of-two bigint plus
 * an English description, not the PERM constant name. Map the bit index back to
 * the name so the UI can use localized labels from the `domainAdmin` catalog.
 */
export const PERMISSION_LABEL_OVERRIDES: Record<number, string> = {
  // `priv.ts` predates the rename and keeps the deprecated name for this bit.
  67: 'PERM_VIEW_USER_PRIVATE_INFO',
};

const EXCLUDED = new Set([
  'PERM_NONE',
  'PERM_ALL',
  'PERM_ADMIN',
  'PERM_BASIC',
  'PERM_DEFAULT',
  'PERM_NEVER',
]);

export const PERMISSION_BIT_LABELS: Map<string, string> = (() => {
  const map = new Map<string, string>();
  for (const [name, value] of Object.entries(PERM)) {
    if (EXCLUDED.has(name)) continue;
    if (typeof value !== 'bigint' || value <= BigInt(0)) continue;
    if ((value & (value - BigInt(1))) !== BigInt(0)) continue;
    const bit = (value.toString(2).length - 1).toString();
    if (!map.has(bit)) map.set(bit, name);
  }
  for (const [bit, name] of Object.entries(PERMISSION_LABEL_OVERRIDES)) {
    map.set(bit, name);
  }
  return map;
})();

/** Resolves a permission key (`BigInt::128`) to its PERM constant name. */
export function permissionLabelName(key: string) {
  const value = BigInt(key.replace(/^BigInt::/, '') || '0');
  if (value <= BigInt(0)) return null;
  const bit = (value.toString(2).length - 1).toString();
  return PERMISSION_BIT_LABELS.get(bit) ?? null;
}
