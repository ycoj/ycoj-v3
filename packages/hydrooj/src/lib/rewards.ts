/* eslint-disable no-await-in-loop */
export type RewardSlot = 'frame' | 'background' | 'title' | 'accent';
export type RewardEquipment = Partial<Record<RewardSlot, string>>;
export interface RewardItem { id: string, slot: RewardSlot, price: number }
/**
 * Removed from the shop: the two solid-color frames, every name background,
 * and every personal title. Prices stay here so a refund can use them when
 * the purchase has fallen out of the 100-entry ledger.
 */
export const RETIRED_REWARD_ITEMS: RewardItem[] = [
    { id: 'frame-sprout', slot: 'frame', price: 60 },
    { id: 'frame-starlight', slot: 'frame', price: 180 },
    { id: 'background-sky', slot: 'background', price: 120 },
    { id: 'background-peach', slot: 'background', price: 120 },
    { id: 'title-explorer', slot: 'title', price: 80 },
    { id: 'title-persistent', slot: 'title', price: 240 },
];
export const REWARD_CATALOG: RewardItem[] = [
    { id: 'frame-tiger', slot: 'frame', price: 200 },
    { id: 'frame-pixel', slot: 'frame', price: 200 },
    { id: 'accent-forest', slot: 'accent', price: 160 },
    { id: 'accent-violet', slot: 'accent', price: 160 },
];
export const REWARD_TASKS = [
    { id: 'checkin', period: 'daily', target: 1, coins: 5 },
    { id: 'first-solve', period: 'daily', target: 1, coins: 15 },
    { id: 'three-solves', period: 'daily', target: 3, coins: 20 },
    { id: 'comeback', period: 'daily', target: 1, coins: 10 },
    { id: 'practice-days', period: 'weekly', target: 3, coins: 40 },
    { id: 'eight-solves', period: 'weekly', target: 8, coins: 60 },
] as const;
export type RewardTaskId = typeof REWARD_TASKS[number]['id'];
export type RewardProgress = Record<RewardTaskId, number>;
export interface RewardLedgerEntry {
    id: string;
    reason: string;
    amount: number;
    at: string;
    by?: number;
    byName?: string;
    note?: string;
}
/** Durable retirement marker. Ledger entries are capped, so this is what makes a re-run skip the refund. */
export interface CosmeticsRetirementRecord {
    items: string[];
    refunded: number;
    at: string;
    notified: boolean;
}
export interface RewardWallet {
    _id: number;
    version: number;
    balance: number;
    earned: number;
    spent: number;
    owned: string[];
    equipped: RewardEquipment;
    claims: string[];
    ledger: RewardLedgerEntry[];
    cosmeticsRetirement?: CosmeticsRetirementRecord;
}
export type RewardAction =
    | { action: 'claim', id: string }
    | { action: 'buy', id: string }
    | { action: 'equip', id: string }
    | { action: 'unequip', id: string };
export class RewardError extends Error {}

export function rewardPeriod(now: Date) {
    const date = new Date(now.getTime() + 8 * 3600_000).toISOString().slice(0, 10);
    const monday = new Date(`${date}T00:00:00Z`);
    monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
    return { date, week: monday.toISOString().slice(0, 10) };
}

export function createRewardWallet(uid: number, now: Date): RewardWallet {
    return {
        _id: uid, version: 0, balance: 100, earned: 100, spent: 0,
        owned: [], equipped: {}, claims: [],
        ledger: [{ id: 'welcome', reason: 'welcome', amount: 100, at: now.toISOString() }],
    };
}

export function rewardTasks(wallet: RewardWallet, progress: RewardProgress, now: Date) {
    const period = rewardPeriod(now);
    return REWARD_TASKS.map((task) => {
        const key = `${task.period === 'daily' ? period.date : period.week}:${task.id}`;
        return {
            ...task, key, progress: Math.min(task.target, progress[task.id]),
            claimed: wallet.claims.includes(key),
        };
    });
}

/** Pure transition; persist the complete result with a version compare-and-swap. */
export function applyRewardAction(
    wallet: RewardWallet, action: RewardAction, progress: RewardProgress, now: Date,
): RewardWallet {
    const next: RewardWallet = structuredClone(wallet);
    const { date, week } = rewardPeriod(now);
    next.claims = next.claims.filter((key) => key.startsWith(`${date}:`) || key.startsWith(`${week}:`));
    let amount = 0;
    let reason = '';
    let entryId = '';
    if (action.action === 'claim') {
        const task = rewardTasks(wallet, progress, now).find((t) => t.id === action.id);
        if (!task) throw new RewardError('invalid-task');
        if (task.claimed) return wallet;
        if (task.progress < task.target) throw new RewardError('task-incomplete');
        next.claims.push(task.key);
        amount = task.coins;
        reason = task.id;
        entryId = task.key;
        next.earned += amount;
    } else if (action.action === 'unequip') {
        if (!['frame', 'background', 'title', 'accent'].includes(action.id)) throw new RewardError('invalid-item');
        delete next.equipped[action.id as RewardSlot];
    } else {
        const item = REWARD_CATALOG.find((i) => i.id === action.id);
        if (!item) throw new RewardError('invalid-item');
        if (action.action === 'buy') {
            if (wallet.owned.includes(item.id)) return wallet;
            if (wallet.balance < item.price) throw new RewardError('insufficient-coins');
            next.owned.push(item.id);
            amount = -item.price;
            reason = item.id;
            entryId = `buy:${item.id}`;
            next.spent += item.price;
        } else {
            if (!wallet.owned.includes(item.id)) throw new RewardError('item-not-owned');
            next.equipped[item.slot] = item.id;
        }
    }
    next.balance += amount;
    next.version++;
    if (amount) next.ledger = [{ id: entryId, reason, amount, at: now.toISOString() }, ...next.ledger].slice(0, 100);
    return next;
}

export interface RewardRepository {
    get(uid: number, now: Date): Promise<RewardWallet>;
    replace(previous: RewardWallet, next: RewardWallet): Promise<boolean>;
}

export async function mutateRewardWallet(
    repository: RewardRepository, uid: number, action: RewardAction,
    getProgress: () => Promise<RewardProgress>, clock = () => new Date(),
) {
    // Recompute at each attempt so a retry crossing midnight cannot claim yesterday's work today.
    for (let attempt = 0; attempt < 8; attempt++) {
        const now = clock();
        const wallet = await repository.get(uid, now);
        const progress = action.action === 'claim' ? await getProgress() : {} as RewardProgress;
        if (rewardPeriod(now).date !== rewardPeriod(clock()).date) continue;
        const next = applyRewardAction(wallet, action, progress, now);
        if (next === wallet || await repository.replace(wallet, next)) return next;
    }
    throw new RewardError('busy');
}
