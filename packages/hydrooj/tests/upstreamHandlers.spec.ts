import assert from 'assert';
import { ObjectId } from 'mongodb';
import { beforeEach, describe, it } from 'node:test';

function mock(request: string, exports: unknown) {
    require.cache[require.resolve(request)] = { exports } as NodeJS.Module;
}

(global as any).Hydro = { model: {}, ui: {} };
const framework = require('@hydrooj/framework');
mock('../src/service/server', framework);
mock('../src/service/db', { collection: () => ({}) });
mock('../src/utils', require('@hydrooj/utils'));
mock('../src/handler/contest', { ContestDetailBaseHandler: framework.Handler });
mock('../src/handler/judge', { postJudge: async () => {} });
for (const name of ['contest', 'discussion', 'domain', 'oplog', 'record', 'solution', 'storage', 'system', 'task']) {
    mock(`../src/model/${name}`, {});
}
mock('../src/model/setting', { langs: {} });
mock('../src/model/record', { STAT_QUERY: {} });
mock('../src/lib/ai/testdata/runtime', {});
mock('../src/lib/ai/testdata/trace', {});

let created: number;
const problem = {
    get: async () => null,
    add: async () => { created++; return 1000; },
};
mock('../src/model/problem', problem);
mock('../src/model/user', { getById: async () => ({ _id: 12 }) });
const { ProblemCreateHandler } = require('../src/handler/problem');
const { RecordMainConnectionHandler } = require('../src/handler/record');
const { OpcountExceededError } = require('../src/error');

beforeEach(() => { created = 0; });

describe('upstream handler regressions', () => {
    it('checks the per-user creation limit before any problem write and preserves successful creation', async () => {
        const calls: unknown[][] = [];
        const limitError = new OpcountExceededError('problem_create', 5, 2);
        let reject = true;
        const handler = Object.assign(Object.create(ProblemCreateHandler.prototype), {
            user: { _id: 12, _files: [] },
            response: {},
            url: () => '/p/1000/files',
            limitRate: async (...args: unknown[]) => {
                calls.push(args);
                if (reject) throw limitError;
            },
        });
        await assert.rejects(handler.post('school', 'A + B', 'Compute A+B.', ''), (error) => error === limitError);
        assert.equal(created, 0);
        assert.deepEqual(calls, [['problem_create', 5, 2, '12']]);
        reject = false;
        await handler.post('school', 'A + B', 'Compute A+B.', '');
        assert.equal(created, 1);
        assert.deepEqual(handler.response.body, { pid: 1000 });
        assert.equal(handler.response.redirect, '/p/1000/files');
    });

    it('filters pretests by the sentinel contest ID, including records without string input', async () => {
        const events: any[] = [];
        const handler = Object.assign(Object.create(RecordMainConnectionHandler.prototype), {
            args: { domainId: 'school' },
            user: { _id: 12 },
            noTemplate: true,
            all: true,
            queueSend: (_rid: string, send: () => Promise<unknown>) => events.push(send()),
        });
        const record = { _id: new ObjectId(), domainId: 'school', uid: 12, pid: 1000, code: 'secret' };
        await handler.onRecordChange({ ...record, contest: new ObjectId('0'.repeat(24)), input: [] });
        assert.equal(events.length, 0);
        await handler.onRecordChange({ ...record, contest: new ObjectId(), input: 'ordinary record' });
        assert.equal(events.length, 1);
        assert.equal((await events[0]).rdoc.input, 'ordinary record');
        handler.pretest = true;
        await handler.onRecordChange({ ...record, contest: new ObjectId('0'.repeat(24)), input: 'private input' });
        const pretest = (await events[1]).rdoc;
        assert.equal(Object.hasOwn(pretest, 'code'), false);
        assert.equal(Object.hasOwn(pretest, 'input'), false);
    });
});
