import assert from 'assert/strict';
import { ObjectId } from 'mongodb';
import { beforeEach, describe, it } from 'node:test';

function mock(request: string, exports: unknown) {
    require.cache[require.resolve(request)] = { exports } as NodeJS.Module;
}
interface Fixture { docId: ObjectId; domainId: string; title: string; rated: boolean; rule: string; beginAt: Date; endAt: Date;
    pids: number[]; ratingPopulation: string; lockAt?: Date; unlocked?: boolean; keepScoreboardHidden?: boolean; }
interface Status { uid: number, rank: number, attend: number, unrank?: boolean, journal: { pid: number }[] }
let contests: Fixture[] = [];
let statuses = new Map<string, Status[]>();
let pending = new Set<string>();
const rows = new Map<string, Record<string, unknown>>();
const collection = {
    async findOne(query: { _id: string }) { return structuredClone(rows.get(query._id)) || null; },
    async insertMany(data: Record<string, unknown>[]) { for (const row of data) rows.set(row._id as string, structuredClone(row)); },
    async replaceOne(query: { _id: string, fingerprint: unknown }, row: Record<string, unknown>) {
        const existing = rows.get(query._id);
        if (existing && existing.fingerprint !== query.fingerprint) return { matchedCount: 0, upsertedCount: 0 };
        rows.set(query._id, { ...structuredClone(row), _id: query._id });
        return { matchedCount: existing ? 1 : 0, upsertedCount: existing ? 0 : 1 };
    },
};
mock('../src/service/db', { __esModule: true, default: { collection: () => collection } });
mock('../src/model/schedule', { __esModule: true, default: {} });
mock('../src/model/user', { deleteUserCache: () => {} });
mock('../src/model/builtin', { STATUS: { STATUS_WAITING: 0, STATUS_FETCHED: 1, STATUS_COMPILING: 2, STATUS_JUDGING: 3 } });
mock('../src/model/record', { __esModule: true, default: {
    getMulti: (_domainId: string, query: { contest: ObjectId }) => ({
        limit: () => ({ toArray: async () => pending.has(query.contest.toHexString()) ? [{}] : [] }),
    }),
} });
mock('../src/model/contest', {
    getMulti: (domainId: string) => ({ sort: () => ({ toArray: async () => contests.filter((c) => c.domainId === domainId && c.rated)
        .sort((a, b) => +a.endAt - +b.endAt || a.docId.toHexString().localeCompare(b.docId.toHexString())) }) }),
    getMultiStatus: (_domainId: string, query: { docId: ObjectId }) => ({ sort: () =>
        (statuses.get(query.docId.toHexString()) || []).filter((s) => s.attend > 0 && !s.unrank && s.uid > 0 && s.journal.length) }),
    RULES: { oi: { statusSort: {}, ranked: async (_tdoc: Fixture, data: Status[]) => data.map((s) => [s.rank, s]) } },
});
const {
    getContestRating, getUserRating, ratingContestEligible,
} = require('../src/model/contestRating') as typeof import('../src/model/contestRating');

function addContest(index: number, domainId = 'school') {
    const fixture: Fixture = { docId: new ObjectId(index.toString(16).padStart(24, '0')), domainId,
        title: `Contest ${index}`, rated: true, rule: 'oi', beginAt: new Date(Date.UTC(2020, 0, index, 8)),
        endAt: new Date(Date.UTC(2020, 0, index, 10)), pids: [1], ratingPopulation: 'primary' };
    contests.push(fixture);
    statuses.set(fixture.docId.toHexString(), Array.from({ length: 3 }, (_, i) => ({ uid: i + 1, rank: i + 1, attend: 1, journal: [{ pid: 1 }] })));
    return fixture;
}

describe('contest rating publication and replay', () => {
    beforeEach(() => {
        contests = [];
        statuses = new Map();
        pending = new Set();
        rows.clear();
    });

    it('publishes once and keeps the same result on repeated and concurrent reads', async () => {
        const c = addContest(1);
        const first = await getContestRating('school', c.docId.toHexString());
        const count = rows.size;
        const repeated = await Promise.all([getContestRating('school', c.docId.toHexString()), getContestRating('school', c.docId.toHexString())]);
        assert.equal(first.status, 'settled');
        assert.deepEqual(repeated, [first, first]);
        assert.equal(rows.size, count);
        assert.equal((await getUserRating('school', 1)).contests, 1);
    });

    it('replays all contests, corrects changed ranks, and preserves prior snapshots', async () => {
        for (let i = 1; i <= 12; i++) addContest(i);
        const before = await getUserRating('school', 1);
        assert.equal(before.contests, 12);
        const size = rows.size;
        const last = contests.at(-1);
        statuses.get(last.docId.toHexString())[0].rank = 4;
        const after = await getUserRating('school', 1);
        assert.ok(after.rating < before.rating);
        assert.equal(after.contests, 12);
        assert.ok(rows.size > size);
    });

    it('waits for judging, excludes unranked users, and removes disabled contests on replay', async () => {
        const c = addContest(1);
        pending.add(c.docId.toHexString());
        assert.equal((await getContestRating('school', c.docId.toHexString())).status, 'pending');
        assert.equal(await getUserRating('school', 1), null);
        pending.clear();
        statuses.get(c.docId.toHexString())[2].unrank = true;
        const settled = await getContestRating('school', c.docId.toHexString());
        assert.equal(settled.changes.length, 2);
        assert.equal(await getUserRating('school', 3), null);
        c.rated = false;
        assert.equal(await getUserRating('school', 1), null);
    });

    it('keeps domains isolated and withholds hidden or locked results', async () => {
        const c = addContest(1, 'private');
        assert.equal(await getUserRating('school', 1), null);
        c.lockAt = c.endAt;
        assert.equal(ratingContestEligible(c), false);
        assert.equal(await getUserRating('private', 1), null);
        c.unlocked = true;
        assert.equal(ratingContestEligible(c), true);
        c.keepScoreboardHidden = true;
        assert.equal(ratingContestEligible(c), false);
    });
});
