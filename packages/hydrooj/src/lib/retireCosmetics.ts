/* eslint-disable no-await-in-loop */
import {
    RETIRED_REWARD_ITEMS, RewardError, type RewardLedgerEntry, type RewardSlot, type RewardWallet,
} from './rewards';

const RETIRED_IDS = new Set(RETIRED_REWARD_ITEMS.map((item) => item.id));
const RETIRED_PRICE = new Map(RETIRED_REWARD_ITEMS.map((item) => [item.id, item.price]));
const SLOTS: RewardSlot[] = ['frame', 'background', 'title', 'accent'];

export interface CosmeticsRetirementReport {
    scanned: number;
    refundedUsers: number;
    refundedCoins: number;
    messages: number;
}

export interface CosmeticsRetirementDeps {
    list: () => AsyncIterable<RewardWallet>;
    get: (uid: number) => Promise<RewardWallet | null>;
    replace: (previous: RewardWallet, next: RewardWallet) => Promise<boolean>;
    notify: (uid: number, refunded: number) => Promise<void>;
    now?: () => Date;
}

/** Prefer the negative `buy:<id>` ledger amount. Fall back to the catalog price when that entry was pruned. */
export function retiredItemRefund(wallet: RewardWallet, itemId: string) {
    const purchase = wallet.ledger.find((entry) => entry.id === `buy:${itemId}` && entry.amount < 0);
    if (purchase) return -purchase.amount;
    return RETIRED_PRICE.get(itemId) ?? 0;
}

function addSafe(left: number, right: number) {
    const sum = left + right;
    if (!Number.isSafeInteger(sum)) throw new RewardError('invalid-amount');
    return sum;
}

/**
 * Removes retired cosmetics, refunds each one once, and unequips it.
 * Returns null when the wallet already matches that end state.
 * `cosmeticsRetirement` is the idempotency record; the capped ledger is not.
 */
export function planCosmeticsRetirement(wallet: RewardWallet, now: Date): RewardWallet | null {
    const present = new Set<string>();
    for (const id of wallet.owned) if (RETIRED_IDS.has(id)) present.add(id);
    for (const id of Object.values(wallet.equipped)) if (id && RETIRED_IDS.has(id)) present.add(id);
    const done = new Set(wallet.cosmeticsRetirement?.items ?? []);
    const pending = [...present].filter((id) => !done.has(id)).sort();
    const stale = [...present].filter((id) => done.has(id));
    if (!pending.length && !stale.length) return null;

    const next: RewardWallet = structuredClone(wallet);
    let refunded = 0;
    const entries: RewardLedgerEntry[] = [];
    for (const id of pending) {
        const amount = retiredItemRefund(wallet, id);
        refunded = addSafe(refunded, amount);
        if (amount) {
            next.balance = addSafe(next.balance, amount);
            // Count the refund as earned so earned - spent stays equal to balance.
            next.earned = addSafe(next.earned, amount);
        }
        entries.push({
            id: `retire:${id}`,
            reason: 'cosmetics-refund',
            amount,
            at: now.toISOString(),
            note: id,
        });
    }
    next.owned = next.owned.filter((id) => !RETIRED_IDS.has(id));
    for (const slot of SLOTS) {
        if (next.equipped[slot] && RETIRED_IDS.has(next.equipped[slot])) delete next.equipped[slot];
    }
    const previous = wallet.cosmeticsRetirement;
    next.cosmeticsRetirement = {
        items: [...new Set([...(previous?.items ?? []), ...pending])].sort(),
        refunded: addSafe(previous?.refunded ?? 0, refunded),
        at: now.toISOString(),
        notified: previous?.notified ?? false,
    };
    next.version++;
    if (entries.length) next.ledger = [...entries, ...next.ledger].slice(0, 100);
    return next;
}

export function markCosmeticsRetirementNotified(wallet: RewardWallet): RewardWallet | null {
    if (!wallet.cosmeticsRetirement || wallet.cosmeticsRetirement.notified) return null;
    const next: RewardWallet = structuredClone(wallet);
    next.cosmeticsRetirement = { ...next.cosmeticsRetirement, notified: true };
    next.version++;
    return next;
}

async function settleWallet(
    current: RewardWallet,
    deps: CosmeticsRetirementDeps,
    dryRun: boolean,
    report: CosmeticsRetirementReport,
) {
    const now = () => deps.now?.() ?? new Date();
    for (let attempt = 0; attempt < 8; attempt++) {
        const planned = planCosmeticsRetirement(current, now());
        const record = planned?.cosmeticsRetirement ?? current.cosmeticsRetirement;
        const delta = (record?.refunded ?? 0) - (current.cosmeticsRetirement?.refunded ?? 0);
        const shouldNotify = Boolean(record && !record.notified && record.items.length > 0);
        if (!planned && !shouldNotify) return;
        if (dryRun) {
            if (delta > 0) {
                report.refundedUsers++;
                report.refundedCoins += delta;
            }
            if (shouldNotify) report.messages++;
            return;
        }
        if (planned) {
            if (!await deps.replace(current, planned)) {
                const latest = await deps.get(current._id);
                if (!latest) throw new RewardError('busy');
                current = latest;
                continue;
            }
            if (delta > 0) {
                report.refundedUsers++;
                report.refundedCoins += delta;
            }
            current = planned;
        }
        if (shouldNotify && current.cosmeticsRetirement) {
            await deps.notify(current._id, current.cosmeticsRetirement.refunded);
            const marked = markCosmeticsRetirementNotified(current);
            if (marked && !await deps.replace(current, marked)) {
                const latest = await deps.get(current._id);
                if (!latest) throw new RewardError('busy');
                current = latest;
                continue;
            }
            report.messages++;
        }
        return;
    }
    throw new RewardError('busy');
}

/** Walks existing wallets. A dry run counts the same refunds and messages without writing or sending. */
export async function runCosmeticsRetirement(
    deps: CosmeticsRetirementDeps, options: { dryRun: boolean },
): Promise<CosmeticsRetirementReport> {
    const report: CosmeticsRetirementReport = {
        scanned: 0, refundedUsers: 0, refundedCoins: 0, messages: 0,
    };
    for await (const wallet of deps.list()) {
        report.scanned++;
        await settleWallet(wallet, deps, options.dryRun, report);
    }
    return report;
}
