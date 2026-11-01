import assert from 'assert';
import { MongoClient, ObjectId } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { after, before, beforeEach, describe, it } from 'node:test';
import { STATUS } from '@hydrooj/common';

function mockModule(request: string, exports: unknown) {
    require.cache[require.resolve(request)] = { exports } as NodeJS.Module;
}

let mongod: MongoMemoryServer;
let client: MongoClient;
let database: ReturnType<MongoClient['db']>;
let rewards: typeof import('../src/model/rewards');
const now = new Date('2026-11-05T04:00:00Z');
let checkedIn = false;

before(async () => {
    mongod = await MongoMemoryServer.create();
    client = await MongoClient.connect(mongod.getUri());
    database = client.db('learning-rewards');
    mockModule('../src/context', {});
    mockModule('../src/service/db', { collection: (name: string) => database.collection(name) });
    mockModule('../src/model/document', { coll: database.collection('document'), TYPE_PROBLEM: 10, TYPE_CONTEST: 30 });
    mockModule('../src/model/checkin', { getByDate: async () => checkedIn ? { localDate: '2026-11-05' } : null });
    mockModule('../src/model/builtin', { STATUS });
    mockModule('../src/model/user', { coll: database.collection('user'), _deleteUserCache() {} });
    mockModule('../src/model/record', {
        coll: database.collection('record'),
        RECORD_PRETEST: new ObjectId('000000000000000000000000'),
        RECORD_GENERATE: new ObjectId('000000000000000000000001'),
    });
    rewards = require('../src/model/rewards');
});

beforeEach(async () => {
    await Promise.all(['record', 'document', 'reward.wallet'].map((name) => database.collection(name).deleteMany({})));
    checkedIn = false;
});
after(async () => {
    await client?.close();
    await mongod?.stop();
});

async function submit(date: string, pid: number, status = STATUS.STATUS_ACCEPTED, extra: Record<string, unknown> = {}) {
    const _id = ObjectId.createFromTime(new Date(date).getTime() / 1000);
    await database.collection('record').insertOne({ _id, domainId: 'school', uid: 2, pid, status, ...extra });
}

describe('server-verified reward progress', () => {
    it('counts first passes on three separate days and a genuine comeback, excluding repeated old solves', async () => {
        await submit('2026-10-20T01:00:00Z', 1);
        await submit('2026-11-05T01:00:00Z', 1);
        await submit('2026-11-02T01:00:00Z', 2);
        await submit('2026-11-04T01:00:00Z', 3);
        await submit('2026-11-05T01:01:00Z', 4, STATUS.STATUS_WRONG_ANSWER);
        await submit('2026-11-05T02:00:00Z', 4);
        checkedIn = true;
        const progress = await rewards.getProgress(2, now);
        assert.deepEqual(progress, {
            checkin: 1, 'first-solve': 1, 'three-solves': 1, comeback: 1, 'practice-days': 3, 'eight-solves': 3,
        });
    });

    it('does not reward test runs, generators, hacks, rejudges, other users, or pending and failed submissions', async () => {
        await submit('2026-11-05T00:00:00Z', 1, STATUS.STATUS_ACCEPTED, { contest: new ObjectId('000000000000000000000000') });
        await submit('2026-11-05T00:01:00Z', 2, STATUS.STATUS_ACCEPTED, { contest: new ObjectId('000000000000000000000001') });
        await submit('2026-11-05T00:02:00Z', 3, STATUS.STATUS_ACCEPTED, { hackTarget: new ObjectId() });
        await submit('2026-11-05T00:03:00Z', 4, STATUS.STATUS_ACCEPTED, { rejudged: true });
        await submit('2026-11-05T00:04:00Z', 5, STATUS.STATUS_ACCEPTED, { uid: 3 });
        await submit('2026-11-05T00:05:00Z', 6, STATUS.STATUS_JUDGING);
        await submit('2026-11-05T00:06:00Z', 7, STATUS.STATUS_WRONG_ANSWER);
        assert.equal((await rewards.getProgress(2, now))['eight-solves'], 0);
    });

    it('merges reference problems even when historical records have no source field', async () => {
        await database.collection('document').insertMany([
            { domainId: 'school', docType: 10, docId: 7 },
            { domainId: 'other', docType: 10, docId: 9, reference: { domainId: 'school', pid: 7 } },
        ]);
        await submit('2026-10-20T01:00:00Z', 7);
        await submit('2026-11-05T01:00:00Z', 9, STATUS.STATUS_ACCEPTED, { domainId: 'other' });
        assert.equal((await rewards.getProgress(2, now))['first-solve'], 0);
    });

    it('requires failure before acceptance and switches daily progress at Beijing midnight', async () => {
        await submit('2026-11-04T15:59:59Z', 1);
        await submit('2026-11-04T16:00:00Z', 2);
        await submit('2026-11-04T17:00:00Z', 2, STATUS.STATUS_WRONG_ANSWER);
        const progress = await rewards.getProgress(2, now);
        assert.equal(progress['first-solve'], 1);
        assert.equal(progress.comeback, 0);
        assert.equal(progress['practice-days'], 2);
    });

    it('does not reveal live or hidden contest verdicts through rewards, and includes finished public contests', async () => {
        const live = new ObjectId();
        const hidden = new ObjectId();
        const finished = new ObjectId();
        await database.collection('document').insertMany([
            { domainId: 'school', docType: 30, docId: live, endAt: new Date('2026-11-05T08:00:00Z') },
            { domainId: 'school', docType: 30, docId: hidden, endAt: new Date('2026-11-05T02:00:00Z'), keepScoreboardHidden: true },
            { domainId: 'school', docType: 30, docId: finished, endAt: new Date('2026-11-05T02:00:00Z') },
        ]);
        await submit('2026-11-05T01:00:00Z', 1, STATUS.STATUS_ACCEPTED, { contest: live });
        await submit('2026-11-05T01:01:00Z', 2, STATUS.STATUS_ACCEPTED, { contest: hidden });
        await submit('2026-11-05T01:02:00Z', 3, STATUS.STATUS_ACCEPTED, { contest: finished });
        assert.equal((await rewards.getProgress(2, now))['first-solve'], 1);
        assert.equal((await rewards.getProgress(2, now))['eight-solves'], 1);
    });

    it('initializes one wallet and deducts a purchase once under MongoDB contention', async () => {
        await Promise.all(Array.from({ length: 8 }, () => rewards.act(2, { action: 'buy', id: 'frame-sprout' })));
        const wallet = await database.collection('reward.wallet').findOne({ _id: 2 } as never);
        assert.equal(wallet.balance, 40);
        assert.deepEqual(wallet.owned, ['frame-sprout']);
        assert.equal(wallet.ledger.length, 2);
        await assert.rejects(rewards.act(2, { action: 'buy', id: 'title-explorer' }), /insufficient-coins/);
    });
});
