import assert from 'assert';
import { createHash } from 'crypto';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { after, before, beforeEach, describe, it } from 'node:test';

function mockModule(request: string, exports: unknown) {
    require.cache[require.resolve(request)] = { exports } as NodeJS.Module;
}

class NotFoundError extends Error { }
Object.assign(global, { Hydro: { model: {} } });
mockModule('../src/context', {});
mockModule('../src/error', { NotFoundError });
mockModule('../src/logger', { Logger: class { debug() { } info() { } success() { } } });
mockModule('../src/model/schedule', {});
mockModule('../src/model/system', {});
mockModule('../src/service/db', { collection: () => null });
mockModule('../src/utils', { md5: (value: string) => createHash('md5').update(value).digest('hex') });

const storageService = require('../src/service/storage');
const { StorageModel } = require('../src/model/storage');
let mongod: MongoMemoryServer;
let client: MongoClient;
let directory: string;
let localStore: any;

async function startStore(config: Record<string, unknown>) {
    let store;
    await storageService.apply({
        inject: async () => undefined,
        provide: (_name: string, value: unknown) => { store = value; },
    }, config);
    return store;
}

async function readAvatar(target: string) {
    const chunks: Buffer[] = [];
    for await (const chunk of await StorageModel.getAvatar(target)) chunks.push(chunk);
    return Buffer.concat(chunks).toString();
}

before(async () => {
    mongod = await MongoMemoryServer.create();
    client = await MongoClient.connect(mongod.getUri());
    StorageModel.coll = client.db('avatar-storage').collection('storage');
    directory = await mkdtemp(join(tmpdir(), 'ycoj-avatar-storage-'));
});

beforeEach(async () => {
    await StorageModel.coll.deleteMany({});
    localStore = await startStore({
        type: 'file', path: directory, secret: 'test-secret', endPointForUser: '/fs/', endPointForJudge: '/fs/',
    });
});

after(async () => {
    await client?.close();
    await mongod?.stop();
    if (directory) await rm(directory, { recursive: true, force: true });
});

describe('avatar storage authorization', () => {
    it('uses a stable query-free URL and a new object URL after an upload replaces the avatar', async () => {
        const path = 'user/7/.avatar.png';
        await StorageModel.put(path, Buffer.from('first avatar'), 7);
        const first = await StorageModel.getAvatarDownloadLink(path);
        assert.match(first, /^\/fs\/storage\/avatar\/[a-z0-9]+\/[a-z0-9]+\.png$/);
        assert.equal(await StorageModel.getAvatarDownloadLink(path), first);
        const firstTarget = first.split('/storage/avatar/')[1];
        assert.equal(await readAvatar(firstTarget), 'first avatar');

        await StorageModel.put(path, Buffer.from('second avatar'), 7);
        const second = await StorageModel.getAvatarDownloadLink(path);
        assert.notEqual(second, first);
        assert.equal(await readAvatar(second.split('/storage/avatar/')[1]), 'second avatar');
        await assert.rejects(readAvatar(firstTarget), NotFoundError);
    });

    it('denies private image blobs, missing objects, and malformed paths', async () => {
        await StorageModel.put('user/7/private.png', Buffer.from('private image'), 7);
        const privateFile = await StorageModel.coll.findOne({ path: 'user/7/private.png' });
        await assert.rejects(readAvatar(privateFile._id), NotFoundError);
        await assert.rejects(StorageModel.getAvatarDownloadLink('user/7/private.png'), NotFoundError);
        await assert.rejects(StorageModel.getAvatarDownloadLink('user/7/.avatar.png'), NotFoundError);
        await Promise.all(['abc/missing.png', '../secret.png', 'abc/../secret.png', '/abc/image.png', 'abc/image.txt']
            .map((target) => assert.rejects(readAvatar(target), NotFoundError)));
    });

    it('allows linked avatar blobs and revokes origin access when the last avatar reference is deleted', async () => {
        await StorageModel.put('user/7/.avatar.jpeg', Buffer.from('shared avatar'), 7);
        const original = await StorageModel.getAvatarDownloadLink('user/7/.avatar.jpeg');
        await StorageModel.copy('user/7/.avatar.jpeg', 'user/8/.avatar.jpeg');
        assert.equal(await StorageModel.getAvatarDownloadLink('user/8/.avatar.jpeg'), original);
        await StorageModel.del(['user/7/.avatar.jpeg']);
        const target = original.split('/storage/avatar/')[1];
        assert.equal(await readAvatar(target), 'shared avatar');
        await StorageModel.del(['user/8/.avatar.jpeg']);
        await assert.rejects(readAvatar(target), NotFoundError);
    });

    it('does not expose the alias ID of a linked avatar', async () => {
        await StorageModel.put('user/7/.avatar.png', Buffer.from('avatar'), 7);
        const aliasId = await StorageModel.copy('user/7/.avatar.png', 'user/8/.avatar.png');
        await assert.rejects(readAvatar(aliasId), NotFoundError);
    });

    it('keeps private file links signed and expiring', async () => {
        const link = new URL(await localStore.signDownloadLink('abc/private.txt', 'notes.txt', false, 'user'), 'https://oj.example');
        assert.equal(link.pathname, '/fs/storage');
        assert.equal(link.searchParams.get('filename'), 'notes.txt');
        const target = link.searchParams.get('target');
        const expire = link.searchParams.get('expire');
        const secret = link.searchParams.get('secret');
        assert.ok(Number(expire) > Date.now());
        assert.equal(await localStore.isLinkValid(`${target}/${expire}/${secret}`), true);
        assert.equal(await localStore.isLinkValid(`abc/other.txt/${expire}/${secret}`), false);
    });

    it('supports CDN base paths and the default origin without query parameters', async () => {
        for (const [endpoint, expected] of [
            ['https://cdn.example/assets/', 'https://cdn.example/assets/storage/avatar/abc/image.png'],
            ['/assets/', '/assets/storage/avatar/abc/image.png'],
            ['', '/storage/avatar/abc/image.png'],
        ]) {
            // Each configuration replaces the storage service proxy.
            // eslint-disable-next-line no-await-in-loop
            const store = await startStore({ type: 'file', path: directory, secret: 'test-secret', endPointForUser: endpoint });
            // eslint-disable-next-line no-await-in-loop
            assert.equal(await store.getAvatarDownloadLink('abc/image.png'), expected);
        }
    });

    it('retains signed S3 downloads for remote storage', async () => {
        const remote = await startStore({
            type: 's3', endPoint: 'https://s3.example', accessKey: 'test-access-key', secretKey: 'test-secret-key',
            region: 'us-east-1', bucket: 'test', pathStyle: true, endPointForUser: '/fs/', endPointForJudge: '/fs/',
        });
        const link = new URL(await remote.getAvatarDownloadLink('abc/image.png'), 'https://oj.example');
        assert.equal(link.pathname, '/fs/test/abc/image.png');
        assert.ok(link.searchParams.get('X-Amz-Signature'));
        assert.equal(link.searchParams.get('X-Amz-Expires'), '1800');
    });
});
