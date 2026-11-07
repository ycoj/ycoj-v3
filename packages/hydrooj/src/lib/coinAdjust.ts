import { RewardError, type RewardWallet } from './rewards';

export const COIN_ADJUST_MAX_USERS = 100;
export const COIN_ADJUST_MAX_AMOUNT = 100_000;
export const COIN_ADJUST_NOTE_MAX = 200;
export const COIN_ADJUST_REASON = 'admin-adjust';

export type CoinDirection = 'grant' | 'deduct';

export interface CoinAdjustmentInput {
    domainId: string;
    operatorUid: number;
    operatorName: string;
    domainName: string;
    uids: number[];
    direction: CoinDirection;
    amount: number;
    note: string;
    requestId: string;
}

export interface NormalizedCoinAdjustment {
    uids: number[];
    direction: CoinDirection;
    amount: number;
    note: string;
    requestId: string;
    signedAmount: number;
}

export interface StoredCoinAdjustment {
    id: string;
    amount: number;
    by: number;
    byName: string;
    note: string;
}

const REQUEST_ID = /^[A-Za-z0-9_-]{8,80}$/;

function assertSafeSum(left: number, right: number) {
    const sum = left + right;
    if (!Number.isSafeInteger(sum)) throw new RewardError('invalid-amount');
    return sum;
}

/** Rejects client-shaped input before any wallet is opened. */
export function normalizeCoinAdjustment(input: CoinAdjustmentInput): NormalizedCoinAdjustment {
    const uids = [...new Set(input.uids)];
    if (!uids.length || uids.length > COIN_ADJUST_MAX_USERS
        || uids.some((uid) => !Number.isSafeInteger(uid) || uid < 2)) throw new RewardError('invalid-users');
    if (input.direction !== 'grant' && input.direction !== 'deduct') throw new RewardError('invalid-amount');
    if (!Number.isSafeInteger(input.amount) || input.amount < 1 || input.amount > COIN_ADJUST_MAX_AMOUNT) {
        throw new RewardError('invalid-amount');
    }
    const note = input.note?.trim() ?? '';
    if (!note || note.length > COIN_ADJUST_NOTE_MAX) throw new RewardError('invalid-note');
    if (!REQUEST_ID.test(input.requestId ?? '')) throw new RewardError('invalid-request');
    const signedAmount = input.direction === 'deduct' ? -input.amount : input.amount;
    return {
        uids, direction: input.direction, amount: input.amount, note, requestId: input.requestId, signedAmount,
    };
}

/**
 * Applies one admin grant or deduction.
 * A deduction may drive the balance below zero so the recorded amount matches
 * the penalty the teacher entered. Purchases still require a sufficient balance.
 * The same ledger id is a no-op, which makes a retried requestId safe.
 */
export function applyCoinAdjustment(wallet: RewardWallet, adjustment: StoredCoinAdjustment, now: Date): RewardWallet {
    if (!adjustment.id || wallet.ledger.some((entry) => entry.id === adjustment.id)) return wallet;
    if (!Number.isSafeInteger(adjustment.amount) || adjustment.amount === 0) throw new RewardError('invalid-amount');
    if (!Number.isSafeInteger(adjustment.by) || adjustment.by < 2) throw new RewardError('invalid-request');
    const note = adjustment.note?.trim() ?? '';
    if (!note || note.length > COIN_ADJUST_NOTE_MAX) throw new RewardError('invalid-note');
    const next: RewardWallet = structuredClone(wallet);
    next.balance = assertSafeSum(next.balance, adjustment.amount);
    if (adjustment.amount > 0) next.earned = assertSafeSum(next.earned, adjustment.amount);
    else next.spent = assertSafeSum(next.spent, -adjustment.amount);
    next.version++;
    next.ledger = [{
        id: adjustment.id,
        reason: COIN_ADJUST_REASON,
        amount: adjustment.amount,
        at: now.toISOString(),
        by: adjustment.by,
        byName: adjustment.byName,
        note,
    }, ...next.ledger].slice(0, 100);
    return next;
}
