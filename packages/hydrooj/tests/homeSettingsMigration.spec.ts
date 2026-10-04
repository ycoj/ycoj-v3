import assert from 'assert';
import { MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { after, before, it } from 'node:test';

function mock(request: string, exports: unknown) {
    require.cache[require.resolve(request)] = { exports } as NodeJS.Module;
}

Object.assign(global, { Hydro: { model: {}, ui: {} } });

for (const name of [
    'builtin', 'contest', 'discussion', 'document', 'domain', 'message', 'problem', 'record',
    'schedule', 'solution', 'storage', 'system', 'task', 'training', 'user',
]) mock(`../src/model/${name}`, {});
mock('../src/pipelineUtils', {});
mock('../src/welcome', {});

let mongod: MongoMemoryServer;
let client: MongoClient;
let users;
let migration: () => Promise<boolean>;

before(async () => {
    mongod = await MongoMemoryServer.create();
    client = await MongoClient.connect(mongod.getUri());
    const database = client.db('hide-rank-migration');
    users = database.collection('user');
    mock('../src/service/db', { collection: (name: string) => database.collection(name) });
    const { coreScripts } = require('../src/upgrade');
    migration = coreScripts.find((script) => script?.name === '_99_100');
    assert.equal(typeof migration, 'function');
});

after(async () => {
    await client?.close();
    await mongod?.stop();
});

it('clears every existing leaderboard opt-out, preserves other values, and can be rerun safely', async () => {
    const original = [
        { _id: 2, uname: 'student', hideRank: true, rp: 100, rpInfo: { problem: 100 } },
        { _id: 3, uname: 'admin', hideRank: true, role: 'root', rp: 200 },
        { _id: 4, uname: 'visible', hideRank: false, rp: 300 },
        { _id: 5, uname: 'legacy', rp: 400 },
    ];
    await users.insertMany(original);
    assert.equal(await migration(), true);
    const expected = original.map((doc) => (doc.hideRank === true ? { ...doc, hideRank: false } : doc));
    assert.deepEqual(await users.find({}).sort({ _id: 1 }).toArray(), expected);
    assert.equal(await users.countDocuments({ hideRank: true }), 0);
    assert.equal(await migration(), true);
    assert.deepEqual(await users.find({}).sort({ _id: 1 }).toArray(), expected);
});
