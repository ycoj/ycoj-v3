export type JoinMethod = 0 | 1 | 2;

export const JOIN_METHOD = {
  NONE: 0,
  ALL: 1,
  CODE: 2,
} as const satisfies Record<string, JoinMethod>;

/** Keep the current expiration; only valid when a policy already exists. */
export const JOIN_EXPIRATION_KEEP_CURRENT = 0;
export const JOIN_EXPIRATION_UNLIMITED = -1;

/** Preset durations in hours offered by the backend join-policy contract. */
export const JOIN_EXPIRATION_HOURS = [3, 24, 24 * 3, 24 * 7, 24 * 30];

export const INVITATION_CODE_PATTERN = /^[a-zA-Z0-9]{1,64}$/;

export function isInvitationCode(value: string) {
  return INVITATION_CODE_PATTERN.test(value);
}

/**
 * Converts the expiration select value into the numeric payload.
 * `''` means "keep current", `'-1'` means never expire.
 */
export function parseExpirationOption(value: string) {
  if (value === '' || value === undefined) return null;
  const hours = Number(value);
  return Number.isFinite(hours) ? hours : null;
}

/**
 * The backend's `expirations` map is keyed by the numeric option. Drop the
 * "keep current" entry when no policy exists yet, mirroring the legacy page.
 */
export function buildExpirationOptions(
  expirations: Record<string, string>,
  hasCurrentPolicy: boolean
) {
  return Object.entries(expirations)
    .filter(
      ([value]) =>
        hasCurrentPolicy || Number(value) !== JOIN_EXPIRATION_KEEP_CURRENT
    )
    .map(([value, label]) => ({ value, label }));
}

export function parseInvitationCode(value: string | undefined) {
  return value?.trim() ?? '';
}
