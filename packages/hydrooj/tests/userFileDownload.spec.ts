import assert from 'assert';
import { beforeEach, describe, it } from 'node:test';
import { shouldBlockUnverifiedAccess } from '../src/lib/realname';

function mockModule(request: string, exports: unknown) {
    const filename = require.resolve(request);
    require.cache[filename] = { exports } as NodeJS.Module;
}

class AccessDeniedError extends Error { }
class NotFoundError extends Error { }
mockModule('../src/context', {});
mockModule('../src/error', { AccessDeniedError, NotFoundError });
mockModule('../src/model/builtin', { PRIV: {} });
mockModule('../src/model/system', {});
mockModule('../src/model/user', {});
const downloads: unknown[][] = [];
const avatarDownloads: string[] = [];
const logs: unknown[][] = [];
let avatarExists = true;
mockModule('../src/model/oplog', { log: async (...args: unknown[]) => { logs.push(args); } });
mockModule('../src/model/storage', {
    getMeta: async () => ({ size: 10 }),
    signDownloadLink: async (...args: unknown[]) => {
        downloads.push(args);
        return 'https://storage.example/signed-image';
    },
    getAvatarDownloadLink: async (target: string) => {
        avatarDownloads.push(target);
        return '/fs/storage/avatar/abc/image.jpeg';
    },
    getAvatar: async (target: string) => {
        if (!avatarExists) throw new NotFoundError(target);
        avatarDownloads.push(target);
        return Buffer.from('avatar');
    },
});
mockModule('../src/service/server', {
    Handler: class { constructor(public args: Record<string, unknown>) { } },
    param: () => (_target: unknown, _name: string, descriptor: PropertyDescriptor) => descriptor,
    post: () => (_target: unknown, _name: string, descriptor: PropertyDescriptor) => descriptor,
    route: require('@hydrooj/framework/decorators').route,
    requireSudo: (_target: unknown, _name: string, descriptor: PropertyDescriptor) => descriptor,
    Types: require('@hydrooj/framework/validator').Types,
});
mockModule('../src/service/storage', {});
mockModule('../src/utils', {});

const { AvatarStorageHandler, FSDownloadHandler, StorageHandler } = require('../src/handler/misc');

function createHandler(filename: string, uid = 0, files: string[] = []) {
    const handler = new FSDownloadHandler({ filename });
    handler.user = { _id: uid, _files: files.map((name) => ({ name })) };
    handler.response = { headers: {}, addHeader(name: string, value: string) { this.headers[name] = value; } };
    return handler;
}

beforeEach(() => {
    downloads.length = 0;
    avatarDownloads.length = 0;
    logs.length = 0;
    avatarExists = true;
});

describe('user file download access', () => {
    for (const filename of ['.avatar.jpg', '.avatar.jpeg', '.avatar.png']) {
        it(`serves ${filename} publicly without an attachment disposition`, async () => {
            const handler = createHandler(filename);
            await handler.get('system', 7, filename);
            assert.equal(handler.response.redirect, '/fs/storage/avatar/abc/image.jpeg');
            assert.deepEqual(avatarDownloads, [`user/7/${filename}`]);
            assert.deepEqual(downloads, []);
            assert.equal(handler.response.headers['Cache-Control'], 'public, max-age=0, must-revalidate');
            assert.equal(logs.length, 1);
            assert.equal(shouldBlockUnverifiedAccess({ _id: 2, priv: 4, realnameStatus: 'none' }, handler), false);
        });
    }

    for (const filename of ['notes.txt', '.avatar.gif', '.avatar.jpeg.bak', 'avatar.png']) {
        it(`denies public access to ${filename}`, async () => {
            const handler = createHandler(filename);
            await assert.rejects(handler.get('system', 7, filename), AccessDeniedError);
            assert.equal(downloads.length, 0);
            assert.equal(avatarDownloads.length, 0);
            assert.equal(shouldBlockUnverifiedAccess({ _id: 2, priv: 4, realnameStatus: 'none' }, handler), true);
        });
    }

    it('allows listed owner files with the requested disposition', async () => {
        const handler = createHandler('notes.txt', 7, ['notes.txt']);
        await handler.get('system', 7, 'notes.txt');
        await handler.get('system', 7, 'notes.txt', true);
        assert.deepEqual(downloads, [
            ['user/7/notes.txt', 'notes.txt', false, 'user'],
            ['user/7/notes.txt', undefined, false, 'user'],
        ]);
    });

    it('denies unlisted owner files and other users listed files', async () => {
        await assert.rejects(createHandler('notes.txt', 7).get('system', 7, 'notes.txt'), AccessDeniedError);
        await assert.rejects(createHandler('notes.txt', 2, ['notes.txt']).get('system', 7, 'notes.txt'), AccessDeniedError);
        assert.equal(downloads.length, 0);
    });
});

describe('avatar storage responses', () => {
    it('uses only route parameters when query parameters attempt to select another object', async () => {
        const handler = new AvatarStorageHandler({});
        handler.args.domainId = 'system';
        handler.request = { params: { prefix: 'abc', filename: 'image.png' } };
        handler.response = { addHeader: () => undefined };
        await handler.get({ domainId: 'system', prefix: 'private', filename: 'secret.png', target: 'private/secret.png' });
        assert.deepEqual(avatarDownloads, ['abc/image.png']);
    });

    it('serves avatar bytes inline with an explicit public cache lifetime', async () => {
        const handler = new AvatarStorageHandler({});
        handler.response = { headers: {}, addHeader(name: string, value: string) { this.headers[name] = value; } };
        await handler.get({}, 'abc', 'image.jpeg');
        assert.deepEqual(handler.response.body, Buffer.from('avatar'));
        assert.equal(handler.response.type, 'image/jpeg');
        assert.equal(handler.response.disposition, undefined);
        assert.equal(handler.response.headers['Cache-Control'], 'public, max-age=86400, immutable');
        assert.equal(shouldBlockUnverifiedAccess({ _id: 2, priv: 4, realnameStatus: 'none' }, handler), false);
    });

    it('does not add public caching when avatar authorization fails', async () => {
        avatarExists = false;
        const handler = new AvatarStorageHandler({});
        handler.response = { addHeader: () => assert.fail('failed requests must not be cached') };
        await assert.rejects(handler.get({}, 'abc', 'image.jpeg'), NotFoundError);
    });

    it('continues to reject expired or invalid private storage signatures', async () => {
        const handler = new StorageHandler({});
        handler.ctx = { get: () => ({ isLinkValid: async () => false }) };
        await assert.rejects(handler.get({}, 'abc/private.txt', '', Date.now() - 1, 'invalid'), AccessDeniedError);
        await assert.rejects(handler.get({}, 'abc/private.txt', '', Date.now() + 10000, 'invalid'), AccessDeniedError);
    });
});
