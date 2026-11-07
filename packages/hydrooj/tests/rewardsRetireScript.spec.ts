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
let script: {
    validate: (input: unknown) => { confirm?: boolean, dryRun?: boolean };
    run: (
        args: { confirm?: boolean, dryRun?: boolean },
        report: (data: unknown) => Promise<unknown>,
    ) => Promise<boolean>;
};
const sent: number[] = [];
const cleared: number[] = [];

/**
 * Same sequencing as JudgeResultCallbackContext: every report is applied in order,
 * and a terminal update is chained after it. Assigning `key` is what the real callback does.
 * A string report throws there and the terminal update is never written.
 */
function judgeRecord() {
    let operation = Promise.resolve();
    const updates: { message?: string, status?: number, key?: string }[] = [];
    const apply = (body: { message?: string, status?: number }) => {
        operation = operation.then(() => {
            body.key = 'next';
            updates.push({ message: body.message, status: body.status, key: body.key });
        });
        return operation;
    };
    return {
        updates,
        report: apply,
        finish(body: { status: number, message?: string }) {
            operation = operation.then(() => {
                body.key = 'end';
                updates.push(body);
            });
            return operation;
        },
    };
}

before(async () => {
    mongod = await MongoMemoryServer.create();
    client = await MongoClient.connect(mongod.getUri());
    database = client.db('retire-script');
    mockModule('../src/service/db', { collection: (name: string) => database.collection(name) });
    mockModule('../src/model/message', {
        FLAG_UNREAD: 1,
        FLAG_I18N: 16,
        send: async (_from: number, to: number) => { sent.push(to); },
    });
    mockModule('../src/model/user', {
        coll: {
            findOne: async ({ _id }: { _id: number }) => (
                _id === 12 ? { _id, uname: 'alice', mail: 'a@b.c' } : null
            ),
        },
        _deleteUserCache(udoc: { _id: number }) { cleared.push(udoc._id); },
    });
    require('../src/script/retireCosmetics').apply({
        addScript: (_name: string, _description: string, validate: typeof script.validate, run: typeof script.run) => {
            script = { validate, run };
            return () => {};
        },
    });
});

beforeEach(async () => {
    sent.length = 0;
    cleared.length = 0;
    await database.collection('reward.wallet').deleteMany({});
    await database.collection('reward.wallet').insertOne({
        _id: 12,
        version: 1,
        balance: 40,
        earned: 100,
        spent: 60,
        owned: ['frame-sprout', 'accent-forest'],
        equipped: { frame: 'frame-sprout', accent: 'accent-forest' },
        claims: [],
        ledger: [{ id: 'buy:frame-sprout', reason: 'frame-sprout', amount: -60, at: '2026-11-02T00:00:00.000Z' }],
    });
});

after(async () => {
    await client?.close();
    await mongod?.stop();
});

async function runLikeAdmin(args: { dryRun?: boolean, confirm?: boolean }) {
    const record = judgeRecord();
    const validated = script.validate(args);
    await script.run(validated, record.report)
        .then((result) => record.finish({ status: 1, message: String(result) }))
        .catch((error: Error) => record.finish({ status: 7, message: error.message }));
    return record.updates;
}

describe('retireCosmetics script', () => {
    it('reports an object so the admin record can leave Waiting', async () => {
        const updates = await runLikeAdmin({ dryRun: true });
        const finished = updates.at(-1);
        assert.equal(finished?.status, 1);
        assert.match(updates.map((update) => update.message).join('\n'), /scanned 1 wallets/);
        assert.match(updates.map((update) => update.message).join('\n'), /refunded 60 coins/);
        assert.match(updates.map((update) => update.message).join('\n'), /Dry run/);
        const wallet = await database.collection('reward.wallet').findOne({ _id: 12 });
        assert.equal(wallet.balance, 40);
        assert.deepEqual(wallet.owned, ['frame-sprout', 'accent-forest']);
        assert.deepEqual(sent, []);
    });

    it('applies once and a second confirm does not refund again', async () => {
        const first = await runLikeAdmin({ confirm: true });
        assert.equal(first.at(-1)?.status, 1);
        assert.match(first.map((update) => update.message).join('\n'), /Applied/);
        const wallet = await database.collection('reward.wallet').findOne({ _id: 12 });
        assert.equal(wallet.balance, 100);
        assert.deepEqual(wallet.owned, ['accent-forest']);
        assert.deepEqual(wallet.equipped, { accent: 'accent-forest' });
        assert.equal(wallet.cosmeticsRetirement.refunded, 60);
        assert.equal(wallet.cosmeticsRetirement.notified, true);
        assert.deepEqual(sent, [12]);
        assert.deepEqual([...new Set(cleared)], [12]);

        sent.length = 0;
        const second = await runLikeAdmin({ confirm: true });
        assert.equal(second.at(-1)?.status, 1);
        assert.match(second.map((update) => update.message).join('\n'), /refunded 0 coins/);
        const again = await database.collection('reward.wallet').findOne({ _id: 12 });
        assert.equal(again.balance, 100);
        assert.deepEqual(sent, []);
    });
});
