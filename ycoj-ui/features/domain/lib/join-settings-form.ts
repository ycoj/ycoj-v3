import { JOIN_METHOD } from './join-policy';

export type JoinSettingsFormValues = {
  method: '0' | '1' | '2';
  role: string;
  group: string;
  expire: string;
  invitationCode: string;
};

export type JoinPolicyMessages = {
  codeInvalid: string;
  roleRequired: string;
  expireRequired: string;
};

/**
 * The join endpoint requires `role` whenever a policy exists, a valid
 * invitation code for `method=2`, and an explicit expiry when no policy exists
 * yet (the "keep current" option is unavailable in that case).
 */
export function validateJoinSettings(
  values: JoinSettingsFormValues,
  messages: JoinPolicyMessages,
  hasCurrentPolicy: boolean
): string | null {
  if (values.method === '0') return null;
  if (!values.role) return messages.roleRequired;
  if (!hasCurrentPolicy && values.expire === '') return messages.expireRequired;
  if (
    values.method === String(JOIN_METHOD.CODE) &&
    !/^[a-zA-Z0-9]{1,64}$/.test(values.invitationCode)
  )
    return messages.codeInvalid;
  return null;
}

/** Converts form values into the numeric payload the endpoint expects. */
export function buildJoinSettingsPayload(values: JoinSettingsFormValues) {
  const method = Number(values.method) as 0 | 1 | 2;
  if (method === JOIN_METHOD.NONE) return { method } as const;
  const expire = values.expire === '' ? undefined : Number(values.expire);
  return {
    method,
    role: values.role,
    ...(values.group.trim() ? { group: values.group.trim() } : {}),
    ...(expire !== undefined && Number.isFinite(expire) ? { expire } : {}),
    ...(method === JOIN_METHOD.CODE
      ? { invitationCode: values.invitationCode }
      : {}),
  };
}

export type ExpirationOption = { value: string; label: string };

/**
 * Backend `expirations` uses numeric-hour keys. Translate them into display
 * labels and drop the "keep current" (0) option when no policy exists yet.
 */
export function readableExpirationOptions(
  expirations: Record<string, string>,
  hasCurrentPolicy: boolean,
  labels: { keep: string; never: string; hours: (n: number) => string }
): ExpirationOption[] {
  return Object.keys(expirations)
    .filter((value) => hasCurrentPolicy || Number(value) !== 0)
    .map((value) => {
      const hours = Number(value);
      if (hours === 0) return { value, label: labels.keep };
      if (hours < 0) return { value, label: labels.never };
      return { value, label: labels.hours(hours) };
    });
}
