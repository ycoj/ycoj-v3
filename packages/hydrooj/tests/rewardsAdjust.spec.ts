import assert from 'assert';
import { MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { after, before, beforeEach, describe, it } from 'node:test';

function mockModule(request: string, exports: unknown) {
    require.cache[require.resolve(request)] = { exports } as NodeJS.Module;
}

let mongod: MongoMemoryServer;
let client: MongoClient;
let database: ReturnType<MongoClient['db']>;
let coinAdjust: typeof import('../src/model/coinAdjust');
const sent: { from: number, to: number, content: string, flag: number }[] = [];

before(async () => {
    mongod = await MongoMemoryServer.create();
    client = await MongoClient.connect(mongod.getUri());
    database = client.db('coin-adjust');
    mockModule('../src/service/db', { collection: (name: string) => database.collection(name) });
    mockModule('../src/model/message', {
        FLAG_UNREAD: 1,
        FLAG_I18N: 16,
        send: async (from: number, to: number, content: string, flag: number) => {
            sent.push({ from, to, content, flag });
        },
    });
    coinAdjust = require('../src/model/coinAdjust');
});

beforeEach(async () => {
    sent.length = 0;
    await Promise.all(['reward.wallet', 'domain.user'].map((name) => database.collection(name).deleteMany({})));
});

after(async () => {
    await client?.close();
    await mongod?.stop();
});

const grant = {
    domainId: 'school',
    operatorUid: 3,
    operatorName: 'teacher',
    domainName: 'School',
    uids: [12],
    direction: 'grant' as const,
    amount: 25,
    note: 'Class prize',
    requestId: 'request-25',
};

async function join(uid: number, extra: Record<string, unknown> = {}) {
    await database.collection('domain.user').insertOne({
        domainId: 'school', uid, join: true, role: 'default', ...extra,
    });
}

describe('domain coin adjustments', () => {
    it('does not open a wallet when any selected user is outside the domain', async () => {
        await join(12);
        await database.collection('domain.user').insertOne({ domainId: 'other', uid: 99, join: true, role: 'default' });
        await database.collection('domain.user').insertOne({ domainId: 'school', uid: 14, join: false, role: 'default' });
        await database.collection('domain.user').insertOne({ domainId: 'school', uid: 15, join: true, role: 'guest' });
        await assert.rejects(coinAdjust.adjustDomainCoins({ ...grant, uids: [12, 99] }), /user-not-in-domain/);
        await assert.rejects(coinAdjust.adjustDomainCoins({ ...grant, uids: [14], requestId: 'request-14' }), /user-not-in-domain/);
        await assert.rejects(coinAdjust.adjustDomainCoins({ ...grant, uids: [15], requestId: 'request-15' }), /user-not-in-domain/);
        assert.equal(await database.collection('reward.wallet').countDocuments(), 0);
        assert.equal(sent.length, 0);
    });

    it('writes the operator, amount, and reason once and notifies the member once', async () => {
        await join(12);
        const first = await coinAdjust.adjustDomainCoins(grant);
        assert.equal(first.adjustments[0].applied, true);
        assert.equal(first.adjustments[0].balance, 125);
        const wallet = await database.collection('reward.wallet').findOne({ _id: 12 });
        assert.equal(wallet.balance, 125);
        assert.equal(wallet.earned - wallet.spent, wallet.balance);
        assert.equal(wallet.ledger[0].id, 'adjust:request-25:12');
        assert.equal(wallet.ledger[0].reason, 'admin-adjust');
        assert.equal(wallet.ledger[0].amount, 25);
        assert.equal(wallet.ledger[0].by, 3);
        assert.equal(wallet.ledger[0].byName, 'teacher');
        assert.equal(wallet.ledger[0].note, 'Class prize');
        assert.equal(sent.length, 1);
        assert.equal(sent[0].from, 1);
        assert.equal(sent[0].to, 12);
        assert.equal(sent[0].flag, 17);
        const body = JSON.parse(sent[0].content);
        assert.equal(body.message, '{0} granted you {1} coins in {2}. Reason: {3}');
        assert.deepEqual(body.params, ['teacher', 25, 'School', 'Class prize']);

        const second = await coinAdjust.adjustDomainCoins(grant);
        assert.equal(second.adjustments[0].applied, false);
        assert.equal(second.adjustments[0].balance, 125);
        assert.equal(sent.length, 1);
        const again = await database.collection('reward.wallet').findOne({ _id: 12 });
        assert.equal(again.balance, 125);
        assert.equal(again.ledger.length, 2);
    });

    it('lets a deduction go below zero and stores the full penalty', async () => {
        await join(12);
        const result = await coinAdjust.adjustDomainCoins({
            ...grant, direction: 'deduct', amount: 250, note: 'Contest misconduct', requestId: 'penalty-250',
        });
        assert.equal(result.adjustments[0].amount, -250);
        assert.equal(result.adjustments[0].balance, -150);
        const wallet = await database.collection('reward.wallet').findOne({ _id: 12 });
        assert.equal(wallet.balance, -150);
        assert.equal(wallet.earned, 100);
        assert.equal(wallet.spent, 250);
        assert.equal(wallet.earned - wallet.spent, wallet.balance);
        assert.equal(wallet.ledger[0].amount, -250);
        assert.equal(wallet.ledger[0].note, 'Contest misconduct');
        const body = JSON.parse(sent[0].content);
        assert.equal(body.message, '{0} deducted {1} coins in {2}. Reason: {3}');
        assert.deepEqual(body.params, ['teacher', 250, 'School', 'Contest misconduct']);
    });
});

describe('retired cosmetics migration', () => {
    const at = '2026-11-02T04:00:00.000Z';

    async function seed() {
        await database.collection('reward.wallet').insertMany([
            {
                _id: 12, version: 0, balance: 40, earned: 100, spent: 60,
                owned: ['frame-sprout', 'accent-forest'],
                equipped: { frame: 'frame-sprout', accent: 'accent-forest' },
                claims: [],
                ledger: [
                    { id: 'buy:frame-sprout', reason: 'frame-sprout', amount: -45, at },
                    { id: 'welcome', reason: 'welcome', amount: 100, at },
                ],
            },
            {
                _id: 13, version: 0, balance: 20, earned: 100, spent: 80,
                owned: ['title-explorer'], equipped: { title: 'title-explorer' }, claims: [],
                ledger: [{ id: 'welcome', reason: 'welcome', amount: 100, at }],
            },
        ]);
    }

    function removalMessages() {
        return sent.filter((message) => JSON.parse(message.content).message.includes('remade'));
    }

    it('previews the refund without writing or messaging', async () => {
        await seed();
        const preview = await coinAdjust.retireRetiredCosmetics({ dryRun: true });
        assert.equal(preview.refundedCoins, 125);
        assert.equal(preview.messages, 2);
        assert.equal((await database.collection('reward.wallet').findOne({ _id: 12 })).balance, 40);
        assert.equal(sent.length, 0);
    });

    it('refunds once, unequips retired items, and ignores a second run', async () => {
        await seed();
        const first = await coinAdjust.retireRetiredCosmetics({ dryRun: false });
        assert.equal(first.refundedCoins, 125);
        assert.equal(first.refundedUsers, 2);
        assert.equal(first.messages, 2);
        const alice = await database.collection('reward.wallet').findOne({ _id: 12 });
        assert.equal(alice.balance, 85);
        assert.equal(alice.earned - alice.spent, alice.balance);
        assert.deepEqual(alice.owned, ['accent-forest']);
        assert.deepEqual(alice.equipped, { accent: 'accent-forest' });
        assert.equal(alice.ledger[0].id, 'retire:frame-sprout');
        assert.equal(alice.ledger[0].amount, 45);
        assert.equal(alice.cosmeticsRetirement.notified, true);
        const bob = await database.collection('reward.wallet').findOne({ _id: 13 });
        assert.equal(bob.balance, 100);
        assert.deepEqual(bob.owned, []);
        assert.deepEqual(bob.equipped, {});
        assert.equal(bob.ledger[0].amount, 80);
        assert.equal(removalMessages().length, 2);
        assert.deepEqual(JSON.parse(removalMessages().find((message) => message.to === 12).content).params, [45]);
        assert.match(JSON.parse(removalMessages()[0].content).message, /being remade/);

        const second = await coinAdjust.retireRetiredCosmetics({ dryRun: false });
        assert.equal(second.refundedCoins, 0);
        assert.equal(second.messages, 0);
        assert.equal(removalMessages().length, 2);
        assert.equal((await database.collection('reward.wallet').findOne({ _id: 12 })).balance, 85);
        assert.equal((await database.collection('reward.wallet').findOne({ _id: 13 })).balance, 100);
    });
});
