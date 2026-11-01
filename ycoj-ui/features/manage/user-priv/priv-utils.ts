export const PRIV_FLAG_NAMES = {
  PRIV_EDIT_SYSTEM: 1 << 0,
  PRIV_SET_PERM: 1 << 1,
  PRIV_USER_PROFILE: 1 << 2,
  PRIV_REGISTER_USER: 1 << 3,
  PRIV_READ_PROBLEM_DATA: 1 << 4,
  PRIV_READ_RECORD_CODE: 1 << 7,
  PRIV_VIEW_HIDDEN_RECORD: 1 << 8,
  PRIV_JUDGE: 1 << 9,
  PRIV_CREATE_DOMAIN: 1 << 10,
  PRIV_VIEW_ALL_DOMAIN: 1 << 11,
  PRIV_MANAGE_ALL_DOMAIN: 1 << 12,
  PRIV_REJUDGE: 1 << 13,
  PRIV_VIEW_USER_SECRET: 1 << 14,
  PRIV_VIEW_JUDGE_STATISTICS: 1 << 15,
  PRIV_CREATE_FILE: 1 << 16,
  PRIV_UNLIMITED_QUOTA: 1 << 17,
  PRIV_DELETE_FILE: 1 << 18,
  PRIV_UNLIMITED_ACCESS: 1 << 22,
  PRIV_VIEW_SYSTEM_NOTIFICATION: 1 << 23,
  PRIV_SEND_MESSAGE: 1 << 24,
  PRIV_MOD_BADGE: 1 << 25,
} as const;

export type UserPrivOption = { name: string; value: number };

/**
 * Turns the backend `Priv` map into a stable, display-ready list.
 * Names not recognized by the UI keep their backend value so no bit is lost.
 */
export function toUserPrivOptions(
  priv: Record<string, number>
): UserPrivOption[] {
  return Object.entries(priv)
    .filter(([, value]) => Number.isFinite(value) && value > 0)
    .map(([name, value]) => ({ name, value }))
    .sort((first, second) => first.value - second.value);
}

/** Adds or removes a bit from a signed 32-bit privilege mask. */
export function togglePrivBit(mask: number, bit: number) {
  if ((mask & bit) === bit) return mask & ~bit;
  return mask | bit;
}

export function privBits(mask: number, options: UserPrivOption[]) {
  return options.filter((option) => (mask & option.value) === option.value);
}

/** Human-readable delta between a default mask and an account's mask. */
export function describePrivDelta(
  priv: number,
  defaultPriv: number,
  options: UserPrivOption[]
) {
  if (priv === -1) return [{ name: 'PRIV_ALL', sign: 'none' as const }];
  if (priv === 0) return [{ name: 'PRIV_NONE', sign: 'none' as const }];
  const entries: Array<{ name: string; sign: 'plus' | 'minus' }> = [];
  for (const option of options) {
    const has = (priv & option.value) === option.value;
    const hasDefault = (defaultPriv & option.value) === option.value;
    if (has && !hasDefault) entries.push({ name: option.name, sign: 'plus' });
    if (!has && hasDefault) entries.push({ name: option.name, sign: 'minus' });
  }
  return entries;
}
