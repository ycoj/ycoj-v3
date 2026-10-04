import assert from 'assert';
import { beforeEach, describe, it } from 'node:test';
import { shouldBlockUnverifiedAccess } from '../src/lib/realname';

function mockModule(request: string, exports: unknown) {
    const filename = require.resolve(request);
    require.cache[filename] = { exports } as NodeJS.Module;
}

class AccessDeniedError extends Error { }
mockModule('../src/context', {});
mockModule('../src/error', { AccessDeniedError });
mockModule('../src/model/builtin', { PRIV: {} });
mockModule('../src/model/system', {});
mockModule('../src/model/user', {});
const downloads: unknown[][] = [];
const logs: unknown[][] = [];
mockModule('../src/model/oplog', { log: async (...args: unknown[]) => { logs.push(args); } });
mockModule('../src/model/storage', {
    getMeta: async () => ({ size: 10 }),
    signDownloadLink: async (...args: unknown[]) => {
        downloads.push(args);
        return 'https://storage.example/signed-image';
    },
});
mockModule('../src/service/server', {
    Handler: class { constructor(public args: Record<string, unknown>) { } },
    param: () => (_target: unknown, _name: string, descriptor: PropertyDescriptor) => descriptor,
    post: () => (_target: unknown, _name: string, descriptor: PropertyDescriptor) => descriptor,
    requireSudo: (_target: unknown, _name: string, descriptor: PropertyDescriptor) => descriptor,
    Types: new Proxy({}, { get: () => () => ({}) }),
});
mockModule('../src/service/storage', {});
mockModule('../src/utils', {});

const { FSDownloadHandler } = require('../src/handler/misc');

function createHandler(filename: string, uid = 0, files: string[] = []) {
    const handler = new FSDownloadHandler({ filename });
    handler.user = { _id: uid, _files: files.map((name) => ({ name })) };
    handler.response = { addHeader: () => undefined };
    return handler;
}

beforeEach(() => {
    downloads.length = 0;
    logs.length = 0;
});

describe('user file download access', () => {
    for (const filename of ['.avatar.jpg', '.avatar.jpeg', '.avatar.png']) {
        it(`serves ${filename} publicly without an attachment disposition`, async () => {
            const handler = createHandler(filename);
            await handler.get('system', 7, filename);
            assert.equal(handler.response.redirect, 'https://storage.example/signed-image');
            assert.deepEqual(downloads, [[`user/7/${filename}`, undefined, false, 'user']]);
            assert.equal(logs.length, 1);
            assert.equal(shouldBlockUnverifiedAccess({ _id: 2, priv: 4, realnameStatus: 'none' }, handler), false);
        });
    }

    for (const filename of ['notes.txt', '.avatar.gif', '.avatar.jpeg.bak', 'avatar.png']) {
        it(`denies public access to ${filename}`, async () => {
            const handler = createHandler(filename);
            await assert.rejects(handler.get('system', 7, filename), AccessDeniedError);
            assert.equal(downloads.length, 0);
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
