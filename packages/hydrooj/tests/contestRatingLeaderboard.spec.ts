import assert from 'assert/strict';
import { MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { after, before, beforeEach, describe, it } from 'node:test';

let mongod: MongoMemoryServer;
let client: MongoClient;
let database: ReturnType<MongoClient['db']>;
let ratings: typeof import('../src/model/contestRating');
let hydrate: (udoc: { _id: number, _dudoc: { domainId: string }, contestRating?: unknown }) => Promise<void>;
const invalidated: string[] = [];

function mock(request: string, exports: unknown) {
    require.cache[require.resolve(request)] = { exports } as NodeJS.Module;
}

before(async () => {
    mongod = await MongoMemoryServer.create();
    client = await MongoClient.connect(mongod.getUri());
    database = client.db('contest-rating-leaderboard');
    mock('../src/service/db', { __esModule: true, default: {
        collection: (name: string) => database.collection(name), ensureIndexes: async () => {},
    } });
    mock('../src/model/contest', { getMulti: () => ({ sort: () => ({ toArray: async () => [] }) }) });
    mock('../src/model/record', { __esModule: true, default: {} });
    mock('../src/model/schedule', { __esModule: true, default: {} });
    mock('../src/model/builtin', { STATUS: { STATUS_WAITING: 0, STATUS_FETCHED: 1, STATUS_COMPILING: 2, STATUS_JUDGING: 3 } });
    mock('../src/model/user', { deleteUserCache: (domainId: string) => invalidated.push(domainId) });
    ratings = require('../src/model/contestRating');
    await ratings.apply({
        on: (name: string, callback: typeof hydrate) => { if (name === 'user/get') hydrate = callback; },
        inject: async () => {},
    } as unknown as Parameters<typeof ratings.apply>[0]);
});

after(async () => {
    await client?.close();
    await mongod?.stop();
});

describe('contest rating leaderboard', () => {
    beforeEach(async () => {
        await database.collection('contest.rating').deleteMany({});
        await database.collection('domain.user').deleteMany({});
        const generation = await ratings.settleContestRatings('school');
        await database.collection('contest.rating').insertMany([
            ...[0, 1, 2, 3, 4, 5, 6, 7].map((uid) => ({
                _id: `${generation}:user:${uid}`, domainId: 'school', generation,
                user: { rating: uid < 4 ? 2000 : 1500, peak: 2100, contests: 3, provisional: false, history: [{ title: 'Private title' }] },
            })),
            { _id: 'old:user:8', domainId: 'school', generation: 'old', user: { rating: 3000, contests: 10 } },
            { _id: `${generation}:user:9`, domainId: 'school', generation, user: { rating: 9999, contests: 0 } },
        ]);
        await database.collection('domain.user').insertMany([
            ...[0, 1, 2, 3, 4, 5, 8, 9, 10].map((uid) => ({ domainId: 'school', uid, join: true, rp: 0 })),
            { domainId: 'school', uid: 6, join: false, rp: 100 },
            { domainId: 'other', uid: 7, join: true, rp: 500 },
        ]);
    });

    it('sorts globally by rating then UID and counts only visible joined rated users', async () => {
        const first = await ratings.getRatingLeaderboard('school', 1, 2, [3], 5);
        assert.deepEqual(first.entries.map((entry) => entry.uid), [2, 4]);
        assert.equal(first.ucount, 3);
        assert.equal(first.upcount, 2);
        assert.equal(first.selfRank, 3);
        assert.deepEqual(first.entries[0].contestRating, { rating: 2000, peak: 2100, contests: 3, provisional: false });
        const second = await ratings.getRatingLeaderboard('school', 2, 2, [3], 4);
        assert.deepEqual(second.entries.map((entry) => entry.uid), [5]);
        assert.equal(second.selfRank, 2);
    });

    it('keeps hidden, unjoined and unrated viewers unranked and updates visibility immediately', async () => {
        for (const uid of [0, 1, 3, 6, 7, 8, 9, 10, undefined]) {
            // eslint-disable-next-line no-await-in-loop
            assert.equal((await ratings.getRatingLeaderboard('school', 1, 2, [3], uid)).selfRank, null);
        }
        const visible = await ratings.getRatingLeaderboard('school', 1, 10, [], 3);
        assert.deepEqual(visible.entries.map((entry) => entry.uid), [2, 3, 4, 5]);
        assert.equal(visible.selfRank, 2);
    });

    it('returns an empty result for another domain and for an out-of-range page without losing totals', async () => {
        assert.deepEqual(await ratings.getRatingLeaderboard('other', 1, 20, [], 2), { entries: [], ucount: 0, upcount: 0, selfRank: null });
        const later = await ratings.getRatingLeaderboard('school', 20, 2, [3], 2);
        assert.deepEqual(later.entries, []);
        assert.equal(later.ucount, 3);
        assert.equal(later.selfRank, 1);
    });

    it('hydrates username summaries without contest history and invalidates user caches on publication', async () => {
        const displayUser = { _id: 2, _dudoc: { domainId: 'school' }, contestRating: null };
        await hydrate(displayUser);
        assert.deepEqual(displayUser.contestRating, { rating: 2000, peak: 2100, contests: 3, provisional: false });
        assert.equal(await ratings.getPublishedUserRating('other', 2), null);
        assert.ok(invalidated.includes('school'));
        const count = invalidated.length;
        await ratings.settleContestRatings('school');
        assert.equal(invalidated.length, count);
    });
});
