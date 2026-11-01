import assert from 'assert';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, it } from 'node:test';

require.cache[require.resolve('../src/utils')] = {
    exports: require('@hydrooj/utils'),
} as NodeJS.Module;

(global as any).Hydro = {};
const storageModule = require('../src/service/storage');

describe('upstream local storage regression', () => {
    it('copies to disk without returning an unused stream, while preserving stream reads', async () => {
        const directory = await mkdtemp(join(tmpdir(), 'hydro-upstream-storage-'));
        try {
            let storage: any;
            await storageModule.apply({
                inject: async () => {},
                provide: (_name: string, service: unknown) => { storage = service; },
            }, { type: 'file', path: directory, endPoint: '/fs/', endPointForUser: '/fs/', endPointForJudge: '/fs/' });
            const expected = Buffer.from('testdata\n');
            await writeFile(join(directory, 'source.in'), expected);
            for (let i = 0; i < 32; i++) {
                const result = await storage.get('source.in', join(directory, 'cached.in')); // eslint-disable-line no-await-in-loop
                if (result !== null) result?.destroy();
                assert.equal(result, null);
            }
            assert.deepEqual(await readFile(join(directory, 'cached.in')), expected);
            const chunks: Buffer[] = [];
            for await (const chunk of await storage.get('source.in')) chunks.push(chunk);
            assert.deepEqual(Buffer.concat(chunks), expected);
            await assert.rejects(storage.get('missing.in'), /File not found/);
        } finally {
            await rm(directory, { recursive: true, force: true });
        }
    });
});
