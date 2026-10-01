import assert from 'assert';
import { readFileSync } from 'fs';
import { MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { after, before, beforeEach, describe, it } from 'node:test';
import nunjucks from 'nunjucks';
import path from 'path';

let mongod: MongoMemoryServer;
let client: MongoClient;
let colls: any;
let userModel: any;
let RankHandler: any;
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
        countUserInDomain: (domainId: string, query: any = {}) => dudocs.countDocuments({ domainId, ...query }),
    });
    Object.assign(global, { Hydro: { model: {}, ui: {}, module: { hash: {} } } });
    ({ leaderboardUidClause } = require('../src/lib/rankVisibility'));
    userModel = require('../src/model/user').default;
    mock('../src/model/user', {
        ...require('../src/model/user'),
        __esModule: true,
        default: {
            getRankHiddenUids: () => userModel.getRankHiddenUids(),
            getList: async (domainId: string, uids: number[]) => {
                const docs = await dudocs.find({ domainId, uid: { $in: uids } }).toArray();
                return Object.fromEntries(docs.map((doc: any) => [doc.uid, { ...doc, _id: doc.uid }]));
            },
        },
    });
    mock('../src/service/server', require('@hydrooj/framework'));
    for (const name of ['discussion', 'message', 'oplog']) mock(`../src/model/${name}`, {});
    await require('../src/handler/domain').apply({
        Route: (name: string, _url: string, HandlerClass: any) => { if (name === 'ranking') RankHandler = HandlerClass; },
        inject: async () => undefined,
    });
});

after(async () => {
    await client?.close();
    await mongod?.stop();
});

describe('current-user displayed rank', () => {
    beforeEach(async () => {
        await colls.user.deleteMany({});
        await colls['domain.user'].deleteMany({});
        await colls.user.insertMany([
            { _id: 2 }, { _id: 3, hideRank: true }, { _id: 4 }, { _id: 5 },
        ]);
        await colls['domain.user'].insertMany([
            { domainId: 'system', uid: 0, rp: 999, join: true },
            { domainId: 'system', uid: 1, rp: 998, join: true },
            { domainId: 'system', uid: 2, rp: 500, rank: 1, join: true },
            { domainId: 'system', uid: 3, rp: 400, rank: 2, join: true },
            // Insert ties in reverse UID order to catch an unstable sort.
            { domainId: 'system', uid: 5, rp: 300, rank: 3, join: true },
            { domainId: 'system', uid: 4, rp: 300, rank: 3, join: true },
            { domainId: 'system', uid: 6, rp: 800, join: false },
            { domainId: 'system', uid: 7, rp: 0, join: true },
            { domainId: 'other', uid: 4, rp: 1000, join: true },
        ]);
    });

    async function ranking(uid = 4, page = 1, pageSize = 2, hasProfile = true, hideRank = false) {
        const handler = Object.assign(Object.create(RankHandler.prototype), {
            user: { _id: uid, rank: 3, rp: 300, hideRank, hasPriv: () => hasProfile },
            ctx: { setting: { get: () => pageSize } },
            response: {},
            paginate: async (cursor: any, currentPage: number) => {
                const count = await colls['domain.user'].countDocuments(cursor.cursorFilter);
                return [await cursor.skip((currentPage - 1) * (pageSize || 20)).limit(pageSize || 20).toArray(),
                    Math.ceil(count / (pageSize || 20)), count];
            },
        });
        await handler.get('system', page);
        return handler;
    }

    function renderedRanks(handler: any) {
        class Loader extends nunjucks.Loader {
            getSource(name: string) {
                const src = name === 'layout/basic.html' ? '{% block content %}{% endblock %}'
                    : name === 'ranking.html'
                        ? readFileSync(path.resolve(__dirname, '../../ui-default/templates/ranking.html'), 'utf8')
                        : '{% macro render() %}{% endmacro %}';
                return { src, path: name, noCache: true };
            }
        }
        const env = new nunjucks.Environment(new Loader());
        env.addFilter('markdownInline', (text) => text);
        const html = env.render('ranking.html', {
            ...handler.response.body, handler, PRIV: require('../src/model/builtin').PRIV,
            model: { rp: {} }, _: (text: string) => text,
            user: { render_inline: (udoc: any) => String(udoc._id) },
        });
        return [...html.matchAll(/<td class="col--rank">(.*?)<\/td>/g)].map((match) => match[1]);
    }

    it('matches the on-page list position and leaves all stored ranks unchanged', async () => {
        const beforeDocs = await colls['domain.user'].find({}).toArray();
        const handler = await ranking();
        assert.equal(handler.response.body.selfRank, 2);
        assert.deepEqual(renderedRanks(handler), ['2', '1', '2']);
        assert.equal(handler.user.rank, 3);
        assert.deepEqual(await colls['domain.user'].find({}).toArray(), beforeDocs);
    });

    it('calculates an off-page position using the same filters and RP tie-breaker', async () => {
        const handler = await ranking(5);
        assert.equal(handler.response.body.selfRank, 3);
        assert.deepEqual(renderedRanks(handler), ['3', '1', '2']);
        const laterPage = await ranking(5, 2);
        assert.equal(laterPage.response.body.selfRank, 3);
        assert.deepEqual(renderedRanks(laterPage), ['3', '3']);
        assert.equal((await ranking(4, 2)).response.body.selfRank, 2);
    });

    it('uses the default page size consistently in the template', async () => {
        assert.deepEqual(renderedRanks(await ranking(4, 1, 0)), ['2', '1', '2', '3']);
    });

    it('omits the self-row for hidden users and guests', async () => {
        const hidden = await ranking(3, 1, 2, true, true);
        assert.equal(hidden.response.body.selfRank, null);
        assert.deepEqual(renderedRanks(hidden), ['1', '2']);
        const guest = await ranking(0, 1, 2, false);
        assert.equal(guest.response.body.selfRank, null);
        assert.deepEqual(renderedRanks(guest), ['1', '2']);
    });

    it('shows a dash for users outside the filtered leaderboard', async () => {
        for (const uid of [1, 6, 7, 8]) {
            // eslint-disable-next-line no-await-in-loop
            const handler = await ranking(uid);
            assert.equal(handler.response.body.selfRank, null);
            assert.deepEqual(renderedRanks(handler), ['-', '1', '2']);
        }
    });

    it('updates the displayed position as soon as an opt-out is cleared', async () => {
        assert.equal((await ranking()).response.body.selfRank, 2);
        await colls.user.updateOne({ _id: 3 }, { $set: { hideRank: false } });
        const handler = await ranking(4, 2);
        assert.equal(handler.response.body.selfRank, 3);
        assert.deepEqual(renderedRanks(handler), ['3', '3', '4']);
    });
});

describe('leaderboard opt-out', () => {
    before(async () => {
        await colls.user.deleteMany({});
        await colls['domain.user'].deleteMany({});
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
