import {
  coinAdjustFieldErrors,
  coinAdjustPayload,
  type CoinAdjustDraft,
} from './coin-adjust-utils';
import { describe, expect, it } from 'vitest';

const valid: CoinAdjustDraft = {
  uids: ['12', '13'],
  direction: 'deduct',
  amount: '20',
  reason: '  Late homework  ',
};

describe('coin adjustment form', () => {
  it('requires members, a whole amount, and a reason', () => {
    expect(
      coinAdjustFieldErrors({
        uids: [],
        direction: 'grant',
        amount: '0',
        reason: '   ',
      })
    ).toEqual(['users', 'amount', 'reason']);
    expect(
      coinAdjustFieldErrors({ ...valid, amount: '100001', uids: ['1'] })
    ).toEqual(['users', 'amount']);
    expect(
      coinAdjustFieldErrors({ ...valid, reason: 'x'.repeat(201) })
    ).toEqual(['reason']);
  });

  it('builds one payload and drops a duplicate member', () => {
    expect(coinAdjustPayload(valid, 'request-22')).toEqual({
      uids: [12, 13],
      direction: 'deduct',
      amount: 20,
      reason: 'Late homework',
      requestId: 'request-22',
    });
    expect(
      coinAdjustPayload({ ...valid, uids: ['12', '12'] }, 'request-22')?.uids
    ).toEqual([12]);
    expect(coinAdjustPayload({ ...valid, amount: '1.5' }, 'request-22')).toBe(
      null
    );
  });
});
