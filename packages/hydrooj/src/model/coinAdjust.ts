/* eslint-disable no-await-in-loop */
import type { CoinAdjustmentInput } from '../lib/coinAdjust';
import { applyCoinAdjustment, normalizeCoinAdjustment } from '../lib/coinAdjust';
import type { CosmeticsRetirementDeps } from '../lib/retireCosmetics';
import { runCosmeticsRetirement } from '../lib/retireCosmetics';
import { createRewardWallet, RewardError, type RewardWallet } from '../lib/rewards';
import db from '../service/db';
import MessageModel from './message';

const wallets = db.collection('reward.wallet');
const domainUsers = db.collection('domain.user');

async function readWallet(uid: number): Promise<RewardWallet | null> {
    return wallets.findOne({ _id: uid });
}

async function openWallet(uid: number, now: Date): Promise<RewardWallet> {
    try {
        await wallets.updateOne({ _id: uid }, { $setOnInsert: createRewardWallet(uid, now) }, { upsert: true });
    } catch (error) {
        if ((error as { code?: number }).code !== 11000) throw error;
    }
    const wallet = await readWallet(uid);
    if (!wallet) throw new RewardError('busy');
    return wallet;
}

async function replaceWallet(previous: RewardWallet, next: RewardWallet) {
    const result = await wallets.replaceOne({ _id: previous._id, version: previous.version }, next);
    return result.modifiedCount === 1;
}

function adjustmentMessage(amount: number) {
    return amount > 0
        ? '{0} granted you {1} coins in {2}. Reason: {3}'
        : '{0} deducted {1} coins in {2}. Reason: {3}';
}

/**
 * Grants or deducts coins for joined members of one domain.
 * Each wallet update is a version compare-and-swap. The same requestId does not apply twice.
 * A deduction may make the balance negative; the ledger stores the full amount.
 */
export async function adjustDomainCoins(input: CoinAdjustmentInput) {
    const normalized = normalizeCoinAdjustment(input);
    const members = await domainUsers.find({
        domainId: input.domainId,
        uid: { $in: normalized.uids },
        join: true,
        role: { $ne: 'guest' },
    }).project({ uid: 1 }).toArray();
    const joined = new Set(members.map((member) => member.uid as number));
    if (normalized.uids.some((uid) => !joined.has(uid))) throw new RewardError('user-not-in-domain');

    const adjustments: { uid: number, amount: number, balance: number, applied: boolean }[] = [];
    for (const uid of normalized.uids) {
        let applied = false;
        let balance = 0;
        let saved = false;
        for (let attempt = 0; attempt < 8 && !saved; attempt++) {
            const now = new Date();
            const wallet = await openWallet(uid, now);
            const next = applyCoinAdjustment(wallet, {
                id: `adjust:${normalized.requestId}:${uid}`,
                amount: normalized.signedAmount,
                by: input.operatorUid,
                byName: input.operatorName,
                note: normalized.note,
            }, now);
            if (next === wallet || await replaceWallet(wallet, next)) {
                applied = next !== wallet;
                balance = next.balance;
                saved = true;
            }
        }
        if (!saved) throw new RewardError('busy');
        if (applied) {
            await MessageModel.send(1, uid, JSON.stringify({
                message: adjustmentMessage(normalized.signedAmount),
                params: [input.operatorName, normalized.amount, input.domainName, normalized.note],
            }), MessageModel.FLAG_I18N | MessageModel.FLAG_UNREAD);
        }
        adjustments.push({
            uid, amount: normalized.signedAmount, balance, applied,
        });
    }
    return { adjustments };
}

const REMOVAL_MESSAGE = 'These cosmetics are being remade. {0} coins have been refunded.';

/** Idempotent refund for retired cosmetics. Dry runs do not write wallets or send messages. */
export async function retireRetiredCosmetics(
    options: { dryRun: boolean },
    invalidate: (uid: number) => Promise<void> = async () => {},
) {
    const deps: CosmeticsRetirementDeps = {
        list: () => wallets.find({}),
        get: (uid) => readWallet(uid),
        replace: async (previous, next) => {
            const saved = await replaceWallet(previous, next);
            if (saved) await invalidate(previous._id);
            return saved;
        },
        notify: async (uid, refunded) => {
            await MessageModel.send(1, uid, JSON.stringify({
                message: REMOVAL_MESSAGE,
                params: [refunded],
            }), MessageModel.FLAG_I18N | MessageModel.FLAG_UNREAD);
        },
    };
    return runCosmeticsRetirement(deps, options);
}
