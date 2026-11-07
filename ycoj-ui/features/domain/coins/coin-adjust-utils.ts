export const COIN_ADJUST_MAX_AMOUNT = 100_000;
export const COIN_ADJUST_NOTE_MAX = 200;

export type CoinDirection = 'grant' | 'deduct';
export type CoinAdjustField = 'users' | 'amount' | 'reason';

export type CoinAdjustDraft = {
  uids: string[];
  direction: CoinDirection;
  amount: string;
  reason: string;
};

export type CoinAdjustPayload = {
  uids: number[];
  direction: CoinDirection;
  amount: number;
  reason: string;
  requestId: string;
};

function memberIds(uids: string[]) {
  return [...new Set(uids.map((uid) => Number(uid)))];
}

/** Field errors for the domain coin form. An empty list means the draft can be submitted. */
export function coinAdjustFieldErrors(
  draft: CoinAdjustDraft
): CoinAdjustField[] {
  const errors: CoinAdjustField[] = [];
  const uids = memberIds(draft.uids);
  if (!uids.length || uids.some((uid) => !Number.isInteger(uid) || uid < 2))
    errors.push('users');
  const amount = Number(draft.amount);
  if (
    !Number.isInteger(amount) ||
    amount < 1 ||
    amount > COIN_ADJUST_MAX_AMOUNT
  )
    errors.push('amount');
  const reason = draft.reason.trim();
  if (!reason || reason.length > COIN_ADJUST_NOTE_MAX) errors.push('reason');
  return errors;
}

export function coinAdjustPayload(
  draft: CoinAdjustDraft,
  requestId: string
): CoinAdjustPayload | null {
  if (coinAdjustFieldErrors(draft).length) return null;
  return {
    uids: memberIds(draft.uids),
    direction: draft.direction,
    amount: Number(draft.amount),
    reason: draft.reason.trim(),
    requestId,
  };
}
