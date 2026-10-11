import assert from 'assert';
import { Readable } from 'stream';
import { type Collection, MongoClient, ObjectId } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { PlagiarismRequest, PlagiarismSnapshot } from '../../src/lib/plagiarism/contest/types';
import type { PlagiarismComparisonOutput, PlagiarismProgress, PlagiarismSourceInput } from '../../src/lib/plagiarism/executor';
import type { PlagiarismMethod } from '../../src/lib/plagiarism/method';

function mock(request: string, exports: unknown) {
    require.cache[require.resolve(request)] = { exports } as NodeJS.Module;
}

Object.assign(global, { Hydro: { model: {}, ui: {} }, app: { get: () => undefined } });
mock('../../src/service/db', { collection: () => null });
mock('../../src/service/server', require('@hydrooj/framework'));
mock('../../src/model/builtin', {
    STATUS: { STATUS_CANCELED: 9 }, PERM: { PERM_EDIT_CONTEST: 1n, PERM_EDIT_CONTEST_SELF: 2n }, PERMS: [],
});

let recordCollection: Collection;
let statusCollection: typeof recordCollection;
let tdoc: { owner: number, maintainer: number[], pids: number[], beginAt: Date, endAt: Date };
mock('../../src/model/record', {
    get coll() { return recordCollection; },
    getMulti: (domainId: string, query: object) => recordCollection.find({ domainId, ...query }),
});
mock('../../src/model/contest', {
    get: async () => tdoc,
    isDone: (doc: typeof tdoc) => doc.endAt.getTime() <= Date.now(),
    getMultiStatus: (domainId: string, query: object) => statusCollection.find({ domainId, ...query }),
});
mock('../../src/model/problem', {
    getList: async (_domainId: string, pids: number[]) => Object.fromEntries(pids.map((pid) => [pid, { title: `Problem ${pid}` }])),
});
mock('../../src/model/user', {
    getList: async (_domainId: string, uids: number[]) => Object.fromEntries(uids.map((uid) => [uid, { uname: `user${uid}` }])),
});
mock('../../src/model/storage', { get: async () => Readable.from(['int main() { return 0; }']) });

const { ContestPlagiarismStore, PLAGIARISM_TASK_INDEXES, PLAGIARISM_TASK_TYPE, PLAGIARISM_TIMEOUT_MS, PLAGIARISM_RETENTION_MS } =
    require('../../src/lib/plagiarism/contest/store');
const { ContestPlagiarismJobs } = require('../../src/lib/plagiarism/contest/jobs');
const { loadPlagiarismSnapshot, readSubmissionSource } = require('../../src/lib/plagiarism/contest/snapshot');
const { ContestPlagiarismHandler, ContestPlagiarismJobHandler, ContestPlagiarismSourceHandler, resolvePlagiarismContest } =
    require('../../src/handler/contestPlagiarism');
const { PermissionError, ContestNotEndedError, NotFoundError, ValidationError } = require('../../src/error');

let mongod: MongoMemoryServer;
let client: MongoClient;
const tid = new ObjectId();
const request: PlagiarismRequest = {
    domainId: 'test', contestId: tid.toHexString(), actorUid: 1,
    beginAt: '2026-01-01T00:00:00.000Z', endAt: '2026-01-01T01:00:00.000Z', pids: [1, 2],
};

let databaseReady: Promise<void>;
function startDatabase() {
    databaseReady ??= (async () => {
        mongod = await MongoMemoryServer.create({ binary: { version: '7.0.24' } });
        client = await MongoClient.connect(mongod.getUri());
    })();
    return databaseReady;
}
after(async () => {
    await client?.close();
    await mongod?.stop();
});
function prepareContest() {
    tdoc = {
        owner: 1, maintainer: [2], pids: [1, 2],
        beginAt: new Date(request.beginAt), endAt: new Date(request.endAt),
    };
}
function prepareCollections() {
    const database = client.db(new ObjectId().toHexString());
    recordCollection = database.collection('record');
    statusCollection = database.collection('status');
    prepareContest();
}

function ridAt(minutes: number, sequence: number) {
    const seconds = new Date(request.beginAt).getTime() / 1000 + minutes * 60;
    return new ObjectId(`${seconds.toString(16).padStart(8, '0')}${sequence.toString(16).padStart(16, '0')}`);
}

function submission(uid: number, pid: number, minutes: number, extra: object = {}) {
    return {
        _id: ridAt(minutes, uid * 100 + pid), domainId: 'test', contest: tid, uid, pid,
        lang: 'cc.cc17', code: `int main() { int value = ${uid}; return value; }`, status: 1, ...extra,
    };
}

async function freshStore(capacity = 4) {
    const coll = client.db(new ObjectId().toHexString()).collection('background_task');
    await coll.createIndexes(PLAGIARISM_TASK_INDEXES);
    return new ContestPlagiarismStore(coll, capacity);
}

function fixtureSnapshot(): PlagiarismSnapshot {
    return {
        sources: [1, 2].map((uid) => ({
            rid: ridAt(10, uid).toHexString(), uid, pid: 1, language: 'cc.cc17',
            submittedAt: new Date(request.beginAt).toISOString(), code: `int main() { return ${uid}; }`,
        })),
        skippedSubmissions: [], participantCount: 2,
        problems: [{ pid: 1, title: 'Addition' }, { pid: 2, title: 'Multiplication' }],
        users: { 1: { _id: 1, uname: 'one' }, 2: { _id: 2, uname: 'two' } },
    };
}

async function compareFixture(
    sources: PlagiarismSourceInput[], _signal: AbortSignal,
    progress?: (value: PlagiarismProgress) => void | Promise<void>,
) {
    const result: PlagiarismComparisonOutput = {
        prepared: sources.map((item) => ({ rid: item.rid, tokenCount: 60, warnings: [] })),
        skipped: [], elapsedMs: 1,
        pairs: sources.length > 1 ? [{
            pid: sources[0].pid, leftRid: sources[0].rid, rightRid: sources[1].rid, similarity: 90,
            scores: { token: 90, structure: 80, fingerprint: 90 },
            matches: [{ leftStartLine: 1, leftEndLine: 1, rightStartLine: 1, rightEndLine: 1, tokenCount: 60 }],
            warnings: [],
        }] : [],
    };
    await progress?.({ completedPairs: result.pairs.length, totalPairs: result.pairs.length });
    return result;
}

describe('contest plagiarism snapshots', () => {
    before(startDatabase);
    beforeEach(prepareCollections);
    it('selects the latest C++ source per user/problem inside the contest and ignores revisions, canceled records, and hacks', async () => {
        const latest = submission(1, 1, 20);
        const second = submission(2, 1, 15);
        const unsupported = submission(3, 2, 10, { lang: 'py' });
        await recordCollection.insertMany([
            submission(1, 1, 5), latest, second, unsupported,
            submission(1, 1, 25, { lang: 'py' }),
            submission(1, 1, 30, { status: 9 }),
            submission(1, 1, 35, { files: { hack: 'input' } }),
            submission(1, 1, 40, { hackTarget: new ObjectId() }),
            submission(4, 1, -1), submission(5, 1, 61),
            submission(6, 1, 10, { contest: new ObjectId() }),
            submission(7, 1, 10, { domainId: 'other' }),
            submission(8, 3, 10),
        ]);
        const snapshot = await loadPlagiarismSnapshot(request, new AbortController().signal);
        assert.deepEqual(snapshot.sources.map((item) => item.rid).sort(), [latest._id.toHexString(), second._id.toHexString()].sort());
        assert.deepEqual(snapshot.skippedSubmissions, [{
            rid: unsupported._id.toHexString(), uid: 3, pid: 2, reason: 'Only C++ submissions are supported.',
        }]);
        assert.equal(snapshot.participantCount, 3);
        assert.equal(snapshot.problems[0].title, 'Problem 1');
    });

    it('rejects an oversized contest explicitly instead of omitting participants or problems', async () => {
        await statusCollection.insertMany(Array.from({ length: 21 }, (_, uid) => ({ domainId: 'test', docId: tid, attend: 1, uid })));
        await assert.rejects(loadPlagiarismSnapshot(request, new AbortController().signal), /at most 20 participants/);
        await assert.rejects(loadPlagiarismSnapshot({ ...request, pids: [1, 2, 3, 4, 5] }, new AbortController().signal), /at most four problems/);
    });
});

describe('contest plagiarism source loading', () => {
    it('reads file-backed source and reports missing or oversized code without reading unbounded streams', async () => {
        const signal = new AbortController().signal;
        assert.equal(await readSubmissionSource({ files: { code: 'file-id#main.cpp' } }, signal, async (path: string) => {
            assert.equal(path, 'submission/file-id');
            return Readable.from(['int main()', '{return 0;}']);
        }), 'int main(){return 0;}');
        await assert.rejects(readSubmissionSource({ code: '' }, signal), /empty or unavailable/);
        await assert.rejects(readSubmissionSource({ code: 'x'.repeat(65_537) }, signal), /64 KiB/);
        const large = Readable.from(['x'.repeat(70_000)]);
        await assert.rejects(readSubmissionSource({ files: { code: 'large#main.cpp' } }, signal, async () => large), /64 KiB/);
        assert.equal(large.destroyed, true);
        await assert.rejects(readSubmissionSource(
            { files: { code: 'invalid-utf8#main.cpp' } }, signal, async () => Readable.from([Buffer.alloc(65_536, 0xFF)]),
        ), /64 KiB/);
    });

    it('aborts while a stored-source connection is still opening', async () => {
        const controller = new AbortController();
        const opened = new Promise<Readable>(() => undefined);
        const pending = readSubmissionSource({ files: { code: 'slow#main.cpp' } }, controller.signal, () => opened);
        controller.abort();
        await assert.rejects(pending, /aborted/);
    });
});

describe('persistent contest plagiarism jobs', () => {
    before(startDatabase);
    for (const count of [17, 100, 101]) {
        it(`retains up to 100 evidence regions in source order for ${count} matches`, async () => {
            const store = await freshStore();
            const matches = Array.from({ length: count }, (_, index) => ({
                leftStartLine: index + 1, leftEndLine: index + 1,
                rightStartLine: index + 2, rightEndLine: index + 2, tokenCount: 20 + index,
            }));
            const jobs = new ContestPlagiarismJobs({
                store, loadSnapshot: async () => fixtureSnapshot(),
                compare: async (sources, signal) => {
                    const comparison = await compareFixture(sources, signal);
                    comparison.pairs[0].matches = matches;
                    return comparison;
                },
            });
            const admitted = await jobs.submit(request);
            await jobs.drain();
            const done = await jobs.get(admitted.jobId, request);
            assert.equal(done.status, 'completed');
            assert.deepEqual(done.result.pairs[0].matches, matches.slice(0, 100));
            assert.equal(done.result.pairs[0].warnings.includes('evidence-regions-limited'), count > 100);
        });
    }
    for (const method of ['tree-sitter', 'heuristic'] as const) {
        it(`persists and executes the selected ${method} method across managers and reruns`, async () => {
            const store = await freshStore();
            let executed: PlagiarismMethod;
            let release: () => void;
            const blocked = new Promise<void>((resolve) => { release = resolve; });
            const jobs = new ContestPlagiarismJobs({
                store, loadSnapshot: async () => fixtureSnapshot(),
                compare: async (sources, signal, progress, selected) => {
                    executed = selected;
                    await blocked;
                    return compareFixture(sources, signal, progress);
                },
            });
            const admitted = await jobs.submit({ ...request, method });
            assert.equal(admitted.method, method);
            const reused = await jobs.submit({ ...request, method: method === 'heuristic' ? 'tree-sitter' : 'heuristic' });
            assert.equal(reused.jobId, admitted.jobId);
            assert.equal(reused.method, method);
            release();
            await jobs.drain();
            const other = new ContestPlagiarismJobs({ store });
            const done = await other.latest(request);
            assert.equal(executed, method);
            assert.equal(done.method, method);
            assert.equal(done.result.method, method);
            assert.equal(done.result.version, method === 'tree-sitter' ? 'cpp-tree-sitter-v1' : 'cpp-lexical-v1');
            const rerun = await jobs.submit({ ...request, method: method === 'heuristic' ? 'tree-sitter' : 'heuristic' });
            assert.notEqual(rerun.jobId, admitted.jobId);
            assert.notEqual(rerun.method, method);
            await jobs.drain();
        });
    }
    it('persists reports and immutable snapshots accessible to other authorized managers and workers', async () => {
        const store = await freshStore();
        const snapshot = fixtureSnapshot();
        const jobs = new ContestPlagiarismJobs({ store, loadSnapshot: async () => snapshot, compare: compareFixture });
        const admitted = await jobs.submit(request);
        assert.equal(admitted.status, 'pending');
        assert.equal(admitted.method, 'tree-sitter');
        assert.ok(admitted.createdAt);
        await jobs.drain();
        const other = new ContestPlagiarismJobs({ store, compare: compareFixture });
        const done = await other.get(admitted.jobId, request);
        assert.equal(done.status, 'completed');
        assert.equal(done.result.comparedPairs, 1);
        assert.equal(done.result.submissionCount, 2);
        assert.equal(done.result.problems[1].comparedPairs, 0);
        assert.deepEqual(done.progress, { completedPairs: 1, totalPairs: 1 });
        assert.equal(JSON.stringify(done).includes('int main'), false);
        const source = await other.source(admitted.jobId, request, snapshot.sources[0].rid);
        assert.equal(source.code, snapshot.sources[0].code);
        assert.equal(await other.get(admitted.jobId, { domainId: 'other', contestId: request.contestId }), null);
        assert.equal(await other.source(
            admitted.jobId, { domainId: 'test', contestId: new ObjectId().toHexString() }, snapshot.sources[0].rid,
        ), null);
        assert.equal(await other.source(admitted.jobId, request, new ObjectId().toHexString()), null);
    });

    it('deduplicates simultaneous contest starts and runs the comparison exactly once', async () => {
        const store = await freshStore();
        let resolve: (value: PlagiarismComparisonOutput) => void;
        const blocked = new Promise<PlagiarismComparisonOutput>((done) => { resolve = done; });
        let calls = 0;
        let notifyStarted: () => void;
        const started = new Promise<void>((resolveStarted) => { notifyStarted = resolveStarted; });
        const jobs = new ContestPlagiarismJobs({
            store,
            loadSnapshot: async () => fixtureSnapshot(),
            compare: async () => {
                calls++;
                notifyStarted();
                return blocked;
            },
        });
        const starts = await Promise.all(Array.from({ length: 8 }, (_, actorUid) => jobs.submit({ ...request, actorUid })));
        assert.ok(starts.every(Boolean));
        assert.equal(new Set(starts.map((item) => item.jobId)).size, 1);
        await started;
        resolve(await compareFixture(fixtureSnapshot().sources, new AbortController().signal));
        await jobs.drain();
        assert.equal(calls, 1);
        assert.equal(await store.coll.countDocuments({ type: PLAGIARISM_TASK_TYPE }), 1);
    });

    it('admits different contests in the same domain and enforces the shared capacity atomically', async () => {
        const store = await freshStore(2);
        const submit = (contestId: string) => store.submit(
            PLAGIARISM_TASK_TYPE, store.owner({ domainId: 'test', contestId }), { ...request, contestId },
        );
        const ids = await Promise.all(Array.from({ length: 8 }, () => submit(new ObjectId().toHexString())));
        assert.equal(ids.filter(Boolean).length, 2);
        await store.claim(ids.find(Boolean), PLAGIARISM_TASK_TYPE);
        await store.finish(ids.find(Boolean), PLAGIARISM_TASK_TYPE, { error: 'test failure' }, PLAGIARISM_RETENTION_MS);
        assert.ok(await submit(new ObjectId().toHexString()));
    });

    it('clears source snapshots on failure and refuses pending, failed, or expired source reads', async () => {
        const store = await freshStore();
        const snapshot = fixtureSnapshot();
        const jobs = new ContestPlagiarismJobs({
            store, loadSnapshot: async () => snapshot,
            compare: async () => { throw new Error('private implementation error'); },
        });
        const admitted = await jobs.submit(request);
        assert.equal(await jobs.source(admitted.jobId, request, snapshot.sources[0].rid), null);
        await jobs.drain();
        const failed = await jobs.get(admitted.jobId, request);
        assert.equal(failed.status, 'failed');
        assert.equal(failed.error.includes('private implementation'), false);
        assert.equal((await store.get(admitted.jobId, PLAGIARISM_TASK_TYPE, store.owner(request))).payload.sources, undefined);
        assert.equal(await jobs.source(admitted.jobId, request, snapshot.sources[0].rid), null);
        await store.coll.updateOne({ jobId: admitted.jobId }, { $set: { expiresAt: new Date(0) } });
        assert.equal(await jobs.get(admitted.jobId, request), null);
    });

    it('reclaims jobs abandoned by a worker and releases contest/capacity locks and source snapshots', async () => {
        const store = await freshStore(1);
        const id = await store.submit(PLAGIARISM_TASK_TYPE, store.owner(request), request);
        await store.claim(id, PLAGIARISM_TASK_TYPE);
        await store.updatePayload(id, { sources: fixtureSnapshot().sources });
        await store.coll.updateOne({ jobId: id }, { $set: { claimedAt: new Date(Date.now() - PLAGIARISM_TIMEOUT_MS - 1000) } });
        await store.reclaimStalled(PLAGIARISM_TASK_TYPE, PLAGIARISM_TIMEOUT_MS, PLAGIARISM_RETENTION_MS);
        const stale = await store.get(id, PLAGIARISM_TASK_TYPE, store.owner(request));
        assert.equal(stale.status, 'failed');
        assert.equal(stale.payload.sources, undefined);
        assert.ok(await store.submit(PLAGIARISM_TASK_TYPE, store.owner(request), request));
    });

    it('releases completed contest locks atomically and repairs legacy orphaned terminal locks during sweeps', async () => {
        const store = await freshStore(1);
        const jobs = new ContestPlagiarismJobs({ store, loadSnapshot: async () => fixtureSnapshot(), compare: compareFixture });
        const admitted = await jobs.submit(request);
        await jobs.drain();
        const completed = await store.get(admitted.jobId, PLAGIARISM_TASK_TYPE, store.owner(request));
        assert.equal(completed.activeContest, undefined);
        assert.equal(completed.ownerSlot, undefined);
        assert.equal(completed.globalSlot, undefined);
        await store.coll.updateOne({ jobId: admitted.jobId }, { $set: { activeContest: true } });
        const rerun = await jobs.submit(request);
        assert.ok(rerun);
        assert.notEqual(rerun.jobId, admitted.jobId);
        await jobs.drain();
    });
});

function fakeUser(uid: number, editor = false, selfEditor = uid === 1 || uid === 2) {
    return { _id: uid, own: (doc: typeof tdoc) => doc.owner === uid || doc.maintainer.includes(uid), editor, selfEditor };
}

function makeHandler(HandlerClass: { prototype: object }, user = fakeUser(1), jobs = {}) {
    return Object.assign(Object.create(HandlerClass.prototype), {
        user,
        args: { domainId: 'test' },
        ctx: { get: () => jobs },
        request: { params: { tid: tid.toHexString(), jobId: 'job', rid: ridAt(10, 1).toHexString() }, query: {}, body: {} },
        response: {},
        checkPerm: (perm: bigint) => {
            if (!(perm === 2n ? user.selfEditor : user.editor)) throw new PermissionError(perm);
        },
    });
}

describe('contest plagiarism HTTP permissions', () => {
    beforeEach(prepareContest);
    for (const uid of [1, 2, 99]) {
        for (const editor of [false, true]) {
            for (const selfEditor of [false, true]) {
                it(`checks the applicable permission for uid=${uid}, editor=${editor}, selfEditor=${selfEditor}`, async () => {
                    const handler = makeHandler(ContestPlagiarismHandler, fakeUser(uid, editor, selfEditor));
                    if (uid === 99 ? editor : selfEditor) {
                        await assert.doesNotReject(resolvePlagiarismContest(handler, 'test', tid));
                    } else {
                        await assert.rejects(resolvePlagiarismContest(handler, 'test', tid), PermissionError);
                    }
                });
            }
        }
    }
    for (const uid of [1, 2, 3]) {
        it(`allows ${uid === 1 ? 'owner' : uid === 2 ? 'maintainer' : 'contest editor'} after the contest ends`, async () => {
            const handler = makeHandler(ContestPlagiarismHandler, fakeUser(uid, uid === 3), { latest: async () => null });
            await handler.get({ domainId: 'test' });
            assert.equal(handler.response.body.job, null);
            assert.equal(handler.response.type, 'application/json');
        });
    }
    for (const HandlerClass of [ContestPlagiarismHandler, ContestPlagiarismJobHandler, ContestPlagiarismSourceHandler]) {
        it(`rejects participants before ${HandlerClass.name} accesses jobs or source code`, async () => {
            const jobs = new Proxy({}, { get: () => { throw new Error('Job store must not be accessed.'); } });
            const handler = makeHandler(HandlerClass, fakeUser(99), jobs);
            await assert.rejects(handler.get({ domainId: 'test' }), PermissionError);
        });
    }
    it('rejects even managers before the global contest end time', async () => {
        tdoc.endAt = new Date(Date.now() + 60_000);
        const handler = makeHandler(ContestPlagiarismHandler);
        await assert.rejects(resolvePlagiarismContest(handler, 'test', tid), ContestNotEndedError);
        await assert.rejects(handler.post({ domainId: 'test' }), ContestNotEndedError);
    });
    it('starts an asynchronous job with 202 and immutable contest-window fields', async () => {
        const handler = makeHandler(ContestPlagiarismHandler, fakeUser(1), {
            submit: async (payload: PlagiarismRequest) => {
                assert.equal(payload.contestId, tid.toHexString());
                assert.equal(payload.beginAt, request.beginAt);
                assert.equal(payload.actorUid, 1);
                assert.equal(payload.method, 'tree-sitter');
                return { jobId: 'job', status: 'pending', createdAt: request.endAt };
            },
        });
        await handler.post({ domainId: 'test' });
        assert.equal(handler.response.status, 202);
        assert.equal(handler.response.body.status, 'pending');
    });
    for (const method of ['heuristic', 'tree-sitter', 'invalid']) {
        it(`validates method=${method} before admitting a job`, async () => {
            let called = false;
            const handler = makeHandler(ContestPlagiarismHandler, fakeUser(1), {
                submit: async (payload: PlagiarismRequest) => {
                    called = true;
                    assert.equal(payload.method, method);
                    return { jobId: 'job', method, status: 'pending', createdAt: request.endAt };
                },
            });
            handler.request.body = { method };
            if (method === 'invalid') {
                assert.throws(() => handler.post({ domainId: 'test', method }), ValidationError);
                assert.equal(called, false);
            } else {
                await handler.post({ domainId: 'test', method });
                assert.equal(handler.response.body.method, method);
            }
        });
    }
    it('uses route-only ObjectId validation and returns 404 for absent snapshot sources', async () => {
        const handler = makeHandler(ContestPlagiarismSourceHandler, fakeUser(1), { source: async () => null });
        await assert.rejects(handler.get({ domainId: 'test' }), NotFoundError);
        handler.request.params.rid = 'not-an-id';
        assert.throws(() => handler.get({ domainId: 'test' }), ValidationError);
    });
});
