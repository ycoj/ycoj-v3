import assert from 'assert';
import { ObjectId } from 'mongodb';
import { beforeEach, describe, it } from 'node:test';

function mock(request: string, exports: unknown) {
    require.cache[require.resolve(request)] = { exports } as NodeJS.Module;
}

const tid = new ObjectId();
const otherTid = new ObjectId();
type Submission = { _id: ObjectId; domainId: string; contest: ObjectId; pid: number; status: number; files?: { hack: string } };
let submissions: Submission[] = [];
let invalidPid: number | null = null;
let referencePid: number | null = null;
const calls: unknown[][] = [];
class ProblemConfigError extends Error { }
mock('../src/error', { ProblemConfigError });
mock('../src/model/builtin', { STATUS: { STATUS_CANCELED: 9 }, PERM: { PERM_EDIT_CONTEST: 1n } });
mock('../src/model/problem', {
    get: async (_domainId: string, pid: number) => ({
        config: pid === invalidPid ? 'invalid config' : {},
        ...(pid === referencePid ? { reference: { domainId: 'source', pid: 99 } } : {}),
    }),
});
mock('../src/model/record', {
    getMulti: (domainId: string, query: { contest: ObjectId; status: { $ne: number }; 'files.hack': { $exists: boolean } }) => ({
        project: () => ({
            toArray: async () => submissions.filter((r) => r.domainId === domainId
                && r.contest.equals(query.contest) && r.status !== query.status.$ne
                && (r.files?.hack !== undefined) === query['files.hack'].$exists),
        }),
    }),
    submissionPriority: async (...args: unknown[]) => { calls.push(['priority', ...args]); return -100; },
    reset: async (...args: unknown[]) => { calls.push(['reset', ...args]); },
    judge: async (...args: unknown[]) => { calls.push(['judge', ...args]); },
});
mock('../src/handler/contest/base', { ContestDetailBaseHandler: class { } });
const { rejudgeContest } = require('../src/model/contest/rejudge');
const { ContestManagementBaseHandler } = require('../src/handler/contest/managementBase');

function submission(pid: number, values: Partial<Submission> = {}): Submission {
    return { _id: new ObjectId(), domainId: 'system', contest: tid, pid, status: 1, ...values };
}

beforeEach(() => { submissions = []; invalidPid = null; referencePid = null; calls.length = 0; });

describe('contest rejudge', () => {
    it('queues only eligible records in the selected contest/domain, grouped by problem', async () => {
        const a = submission(1);
        const b = submission(2);
        const c = submission(1);
        submissions = [a, b, c, submission(1, { contest: otherTid }), submission(1, { domainId: 'other' }),
            submission(1, { status: 9 }), submission(1, { files: { hack: 'input' } })];
        assert.equal(await rejudgeContest('system', tid, 42), 3);
        assert.deepEqual(calls, [
            ['priority', 42, -10065],
            ['reset', 'system', [a._id, c._id], true],
            ['judge', 'system', [a._id, c._id], -100, { detail: false }, { rejudge: true }],
            ['reset', 'system', [b._id], true],
            ['judge', 'system', [b._id], -100, { detail: false }, { rejudge: true }],
        ]);
    });

    it('does not reset any results if a submitted problem has invalid configuration', async () => {
        submissions = [submission(1), submission(2)];
        invalidPid = 2;
        await assert.rejects(rejudgeContest('system', tid, 42), ProblemConfigError);
        assert.deepEqual(calls, []);
    });

    it('returns zero without touching the queue for an empty contest', async () => {
        assert.equal(await rejudgeContest('system', tid, 42), 0);
        assert.deepEqual(calls, []);
    });

    it('validates a referenced problem source before resetting results', async () => {
        submissions = [submission(1)];
        referencePid = 1;
        invalidPid = 99;
        await assert.rejects(rejudgeContest('system', tid, 42), ProblemConfigError);
        assert.deepEqual(calls, []);
        invalidPid = null;
        assert.equal(await rejudgeContest('system', tid, 42), 1);
    });

    for (const role of ['owner', 'maintainer', 'editor', 'attendee']) {
        it(`${role === 'attendee' ? 'rejects' : 'allows'} ${role} through the management permission gate`, async () => {
            const handler = Object.assign(Object.create(ContestManagementBaseHandler.prototype), {
                tdoc: {},
                user: { own: () => role === 'owner' || role === 'maintainer' },
                checkPerm: (perm: bigint) => {
                    assert.equal(perm, 1n);
                    if (role !== 'editor') throw new Error('Permission denied');
                },
            });
            if (role === 'attendee') await assert.rejects(handler.prepare(), /Permission denied/);
            else await handler.prepare();
        });
    }
});
