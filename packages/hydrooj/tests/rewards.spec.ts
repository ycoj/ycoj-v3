import assert from 'assert';
import { describe, it } from 'node:test';
import type { RewardProgress, RewardRepository, RewardWallet } from '../src/lib/rewards';
import {
    applyRewardAction, createRewardWallet, mutateRewardWallet, REWARD_CATALOG, rewardPeriod, rewardTasks,
} from '../src/lib/rewards';

const now = new Date('2026-11-02T04:00:00Z');
const complete: RewardProgress = {
    checkin: 1, 'first-solve': 3, 'three-solves': 3, comeback: 1, 'practice-days': 3, 'eight-solves': 8,
};
const empty: RewardProgress = {
    checkin: 0, 'first-solve': 0, 'three-solves': 0, comeback: 0, 'practice-days': 0, 'eight-solves': 0,
};

function memoryRepository() {
    let wallet: RewardWallet | undefined;
    const repository: RewardRepository = {
        async get(uid, time) {
            wallet ||= createRewardWallet(uid, time);
            return structuredClone(wallet);
        },
        async replace(previous, next) {
            await new Promise((resolve) => setImmediate(resolve));
            if (wallet.version !== previous.version) return false;
            wallet = structuredClone(next);
            return true;
        },
    };
    return { repository, read: () => wallet };
}

describe('learning rewards', () => {
    it('gives exactly 100 welcome coins and a matching ledger entry', () => {
        const wallet = createRewardWallet(2, now);
        assert.equal(wallet.balance, 100);
        assert.equal(wallet.ledger[0].amount, 100);
        assert.equal(wallet.earned - wallet.spent, wallet.balance);
    });

    it('rejects incomplete tasks, unknown items, and unowned equipment without changing the wallet', () => {
        const wallet = createRewardWallet(2, now);
        for (const action of [
            { action: 'claim', id: 'three-solves' },
            { action: 'claim', id: 'invented' },
            { action: 'buy', id: 'invented' },
            { action: 'equip', id: 'frame-sprout' },
            { action: 'unequip', id: '__proto__' },
        ] as const) assert.throws(() => applyRewardAction(wallet, action, empty, now));
        assert.equal(wallet.balance, 100);
        assert.deepEqual(wallet.owned, []);
    });

    it('allows each task only once and stacks daily and weekly goals', () => {
        let wallet = createRewardWallet(2, now);
        for (const task of rewardTasks(wallet, complete, now)) {
            wallet = applyRewardAction(wallet, { action: 'claim', id: task.id }, complete, now);
            const duplicate = applyRewardAction(wallet, { action: 'claim', id: task.id }, complete, now);
            assert.equal(duplicate, wallet);
        }
        assert.equal(wallet.balance, 250);
        assert.equal(wallet.ledger.length, 7);
    });

    it('resets days at UTC+8 midnight and weeks on Monday without resetting permanent ownership', () => {
        const sunday = new Date('2026-11-01T15:59:59Z');
        const monday = new Date('2026-11-01T16:00:00Z');
        assert.deepEqual(rewardPeriod(sunday), { date: '2026-11-01', week: '2026-10-26' });
        assert.deepEqual(rewardPeriod(monday), { date: '2026-11-02', week: '2026-11-02' });
        let wallet = applyRewardAction(createRewardWallet(2, sunday), { action: 'claim', id: 'practice-days' }, complete, sunday);
        wallet = applyRewardAction(wallet, { action: 'buy', id: 'frame-sprout' }, complete, sunday);
        assert.equal(rewardTasks(wallet, empty, monday).some((task) => task.claimed), false);
        assert.throws(() => applyRewardAction(wallet, { action: 'claim', id: 'practice-days' }, empty, monday));
        assert.deepEqual(wallet.owned, ['frame-sprout']);
        assert.equal(wallet.balance, 80);
    });

    it('purchases once, keeps each equipment slot separate, and removes without refunding or deleting', () => {
        let wallet = createRewardWallet(2, now);
        wallet.balance = 2000;
        for (const item of REWARD_CATALOG) {
            wallet = applyRewardAction(wallet, { action: 'buy', id: item.id }, complete, now);
            const balance = wallet.balance;
            assert.equal(applyRewardAction(wallet, { action: 'buy', id: item.id }, complete, now).balance, balance);
            wallet = applyRewardAction(wallet, { action: 'equip', id: item.id }, complete, now);
            assert.equal(wallet.equipped[item.slot], item.id);
        }
        const balance = wallet.balance;
        const equipped = { ...wallet.equipped };
        wallet = applyRewardAction(wallet, { action: 'unequip', id: 'title' }, complete, now);
        assert.equal(wallet.equipped.title, undefined);
        assert.equal(wallet.equipped.frame, equipped.frame);
        assert.equal(wallet.equipped.background, equipped.background);
        assert.equal(wallet.equipped.accent, equipped.accent);
        assert.equal(wallet.owned.length, REWARD_CATALOG.length);
        assert.equal(wallet.balance, balance);
    });

    it('does not grant duplicate rewards under concurrent requests', async () => {
        const { repository, read } = memoryRepository();
        await Promise.all(Array.from({ length: 12 }, () => mutateRewardWallet(
            repository, 2, { action: 'claim', id: 'first-solve' }, async () => complete, () => now,
        )));
        assert.equal(read().balance, 115);
        assert.equal(read().ledger.filter((entry) => entry.reason === 'first-solve').length, 1);
    });

    it('cannot overspend when two different purchases race', async () => {
        const { repository, read } = memoryRepository();
        const results = await Promise.allSettled(['frame-sprout', 'title-explorer'].map((id) => mutateRewardWallet(
            repository, 2, { action: 'buy', id }, async () => complete, () => now,
        )));
        assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
        assert.equal(read().owned.length, 1);
        assert.ok(read().balance >= 0);
        assert.equal(read().earned - read().spent, read().balance);
    });

    it('rechecks progress if a request crosses midnight', async () => {
        const { repository, read } = memoryRepository();
        let time = new Date('2026-11-02T15:59:59Z');
        let calls = 0;
        await assert.rejects(mutateRewardWallet(repository, 2, { action: 'claim', id: 'first-solve' }, async () => {
            calls++;
            if (calls === 1) {
                time = new Date('2026-11-02T16:00:00Z');
                return complete;
            }
            return empty;
        }, () => time), /task-incomplete/);
        assert.equal(calls, 2);
        assert.equal(read().balance, 100);
    });
});
