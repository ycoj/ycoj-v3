import assert from 'assert';
import { MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { after, before, describe, it } from 'node:test';

let mongod: MongoMemoryServer;
let client: MongoClient;
let colls: any;
let userModel: any;
let leaderboardUidClause: typeof import('../src/lib/rankVisibility').leaderboardUidClause;

function mock(request: string, exports: any) {
    require.cache[require.resolve(request)] = { exports } as NodeJS.Module;
}

/** Composes the clause the way a leaderboard query does, to prove it filters real documents. */
async function listingQuery(domainId: string) {
    return { domainId, ...leaderboardUidClause(await userModel.getRankHiddenUids()), rp: { $gt: 0 }, join: true };
}

before(async () => {
    mongod = await MongoMemoryServer.create();
    client = await MongoClient.connect(mongod.getUri());
    const db = client.db('rank-visibility-test');
    const dudocs = db.collection('domain.user');
    await db.collection('user').createIndex(
        { hideRank: 1 },
        { name: 'hideRank', partialFilterExpression: { hideRank: true } },
    );
    await dudocs.createIndex({ domainId: 1, uid: 1 }, { name: 'uid', unique: true });
    colls = {
        user: db.collection('user'),
        vuser: db.collection('vuser'),
        'user.group': db.collection('user.group'),
        'domain.user': dudocs,
    };
    mock('../src/service/db', { collection: (name: string) => colls[name] ?? db.collection(name) });
    mock('../src/service/bus', { on() {}, async parallel() { return undefined; } });
    mock('../src/model/domain', {
        collUser: dudocs,
        getMultiUserInDomain: (domainId: string, query: any = {}) => dudocs.find({ domainId, ...query }),
        getDomainUser: async () => ({}),
    });
    Object.assign(global, { Hydro: { model: {}, ui: {}, module: { hash: {} } } });
    ({ leaderboardUidClause } = require('../src/lib/rankVisibility'));
    userModel = require('../src/model/user').default;
});

after(async () => {
    await client?.close();
    await mongod?.stop();
});

describe('leaderboard opt-out', () => {
    before(async () => {
        await colls.user.insertMany([
            { _id: 2, uname: 'visible', hideRank: false },
            { _id: 3, uname: 'optedout', hideRank: true },
            { _id: 4, uname: 'legacy' },
        ]);
        await colls['domain.user'].insertMany([
            { domainId: 'system', uid: 0, rp: 999, join: true },
            { domainId: 'system', uid: 1, rp: 998, join: true },
            { domainId: 'system', uid: 2, rp: 500, rpInfo: { problem: 500 }, rank: 1, join: true },
            { domainId: 'system', uid: 3, rp: 400, rpInfo: { problem: 400 }, rank: 2, join: true },
            { domainId: 'system', uid: 4, rp: 300, rpInfo: { problem: 300 }, rank: 3, join: true },
            { domainId: 'other', uid: 3, rp: 1000, join: true },
        ]);
    });

    it('collects only the users who actually opted in', async () => {
        assert.deepEqual(await userModel.getRankHiddenUids(), [3]);
    });

    it('omits the opted-out user from the listing and the pagination totals', async () => {
        const listed = await colls['domain.user'].find(await listingQuery('system')).sort({ rp: -1 }).toArray();
        assert.deepEqual(listed.map((dudoc: any) => dudoc.uid), [2, 4]);
        assert.equal(await colls['domain.user'].countDocuments(await listingQuery('system')), 2);
    });

    it('keeps calculating RP and the stored rank for the opted-out user', async () => {
        const stored = await colls['domain.user'].findOne({ domainId: 'system', uid: 3 });
        assert.equal(stored.rp, 400);
        assert.deepEqual(stored.rpInfo, { problem: 400 });
        assert.equal(stored.rank, 2);
    });

    it('restores the user as soon as the setting is turned off', async () => {
        await colls.user.updateOne({ _id: 3 }, { $set: { hideRank: false } });
        assert.deepEqual(await userModel.getRankHiddenUids(), []);
        const listed = await colls['domain.user'].find(await listingQuery('system')).sort({ rp: -1 }).toArray();
        assert.deepEqual(listed.map((dudoc: any) => dudoc.uid), [2, 3, 4]);
    });

    it('leaves the query shape untouched when nobody opted out', () => {
        assert.deepEqual(leaderboardUidClause([]), { uid: { $gt: 1 } });
    });

    it('keeps the system-account floor alongside the opt-out clause', () => {
        assert.deepEqual(leaderboardUidClause([7, 9]), { uid: { $gt: 1, $nin: [7, 9] } });
    });
});
