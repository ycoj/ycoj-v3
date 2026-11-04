import assert from 'assert';
import { ObjectId } from 'mongodb';
import { before, describe, it } from 'node:test';

function mock(request: string, exports: unknown) {
    require.cache[require.resolve(request)] = { exports } as NodeJS.Module;
}

function deferred<T = void>() {
    let resolve: (value: T) => void;
    const promise = new Promise<T>((done) => { resolve = done; });
    return { promise, resolve: (value: T) => resolve(value) };
}

function flush() {
    return Array.from({ length: 8 }, () => Promise.resolve()).reduce((chain) => chain.then(() => undefined), Promise.resolve());
}

(global as any).Hydro = (global as any).Hydro || { model: {}, ui: {} };
const { PERM, PRIV, STATUS } = require('../src/model/builtin');
mock('../src/service/db', { collection: () => ({}) });
mock('../src/service/bus', {
    on() {}, emit() {}, broadcast() {}, async parallel() { return undefined; },
});
mock('../src/service/server', require('@hydrooj/framework'));
mock('../src/model/oplog', { log: async () => {} });
mock('../src/model/storage', { del: async () => {} });
mock('../src/model/system', { get: () => 0 });

const problem = {
    PROJECTION_LIST: [
        '_id', 'domainId', 'docType', 'docId', 'pid', 'owner', 'title',
        'nSubmit', 'nAccept', 'difficulty', 'tag', 'hidden', 'stats',
    ],
    getList: async () => ({}),
    getListStatus: async () => ({}),
};
const user = {
    getById: async () => ({ _id: 3, uname: 'owner' }),
    getListForRender: async () => ({}),
    listGroup: async () => [],
};
mock('../src/model/problem', problem);
mock('../src/model/user', user);

const realTraining = require('../src/model/training');
const state: {
    tdoc: any;
    enroll: () => Promise<Array<{ uid: number }>>;
    getStatus: (domainId: string, docId: ObjectId, uid: number) => Promise<any>;
    setStatus: (domainId: string, docId: ObjectId, uid: number, update: any) => Promise<any>;
} = {
    tdoc: null,
    enroll: async () => [{ uid: 2 }, { uid: 9 }],
    getStatus: async () => ({ enroll: 0, done: false, doneNids: [], donePids: [] }),
    setStatus: async (_domainId, _docId, _uid, update) => ({ enroll: 1, ...update }),
};
mock('../src/model/training', {
    getPids: realTraining.getPids,
    isDone: realTraining.isDone,
    isProgress: realTraining.isProgress,
    isOpen: realTraining.isOpen,
    isInvalid: realTraining.isInvalid,
    isSameProgress: realTraining.isSameProgress,
    get: async () => state.tdoc,
    getStatus: (...args: [string, ObjectId, number]) => state.getStatus(...args),
    setStatus: (...args: [string, ObjectId, number, any]) => state.setStatus(...args),
    getMultiStatus: () => ({
        project: () => ({
            limit: () => ({ toArray: () => state.enroll() }),
        }),
    }),
});
const { TrainingDetailHandler } = require('../src/handler/training');

const heavyFields = ['content', 'html', 'data', 'config', 'additional_file', 'reference'];

function handlerFor(opts: { profile?: boolean, editDomain?: boolean } = {}) {
    const profile = opts.profile !== false;
    const editDomain = opts.editDomain !== false;
    return Object.assign(Object.create(TrainingDetailHandler.prototype), {
        user: {
            _id: 7,
            hasPriv: (priv: number) => profile && priv === PRIV.PRIV_USER_PROFILE,
            hasPerm: (perm: bigint) => editDomain && perm === PERM.PERM_EDIT_DOMAIN,
        },
        ctx: {
            parallel: async () => {},
            setting: { get: (key: string) => key === 'training.enrolled-users' },
        },
        response: { body: {} },
    });
}

describe('training detail', { concurrency: 1 }, () => {
    const tid = new ObjectId();
    let statusWrites = 0;

    before(() => {
        state.tdoc = {
            docId: tid,
            owner: 3,
            description: 'Read (file://guide.pdf) and <img src="file://pic.png">',
            dag: [{ _id: 1, title: 'Basics', requireNids: [], pids: [1000, 1002] }],
        };
        state.enroll = async () => [{ uid: 2 }, { uid: 9 }];
        state.setStatus = async (_domainId, _docId, _uid, update) => {
            statusWrites++;
            return { enroll: 1, ...update };
        };
    });

    it('loads list columns, hides invisible statuses, and skips an unchanged progress write', async () => {
        statusWrites = 0;
        const calls: unknown[][] = [];
        problem.getList = async (...args: unknown[]) => {
            calls.push(args);
            return {
                1000: { docId: 1000, title: 'A + B', tag: ['math'] },
                1002: { docId: 0, pid: '1002', title: '*', tag: [] },
            };
        };
        problem.getListStatus = async () => ({
            1000: { docId: 1000, status: STATUS.STATUS_ACCEPTED },
            1002: { docId: 1002, status: STATUS.STATUS_ACCEPTED },
        });
        state.getStatus = async () => ({
            enroll: 1,
            done: false,
            doneNids: [],
            donePids: [1000],
        });
        const handler = handlerFor();
        await handler.get('system', tid);

        const projection = calls[0][4] as string[];
        assert.deepEqual(calls[0].slice(0, 4), ['system', [1000, 1002], handler.user._id, false]);
        for (const field of ['title', 'tag', 'difficulty', 'maintainer', 'nSubmit']) {
            assert.equal(projection.includes(field), true, field);
        }
        for (const field of heavyFields) assert.equal(projection.includes(field), false, field);
        assert.equal(statusWrites, 0);
        assert.equal(handler.response.body.tsdoc.enroll, 1);
        assert.deepEqual(handler.response.body.missing, [1002]);
        assert.deepEqual(Object.keys(handler.response.body.psdict), ['1000']);
        assert.equal(handler.response.body.pdict[1000].title, 'A + B');
        assert.equal(handler.response.body.nsdict[1].progress, 50);
        assert.equal(handler.response.body.tdoc.description.includes(`(./${tid}/file/guide.pdf)`), true);
        assert.equal(handler.response.body.tdoc.description.includes(`="./${tid}/file/pic.png"`), true);
        assert.deepEqual(handler.response.template, 'training_detail.html');
    });

    it('writes progress only when the solved set changed, ignoring id order', async () => {
        statusWrites = 0;
        problem.getList = async () => ({
            1000: { docId: 1000, title: 'A + B', tag: [] },
            1002: { docId: 1002, title: 'A + C', tag: [] },
        });
        problem.getListStatus = async () => ({
            1002: { docId: 1002, status: STATUS.STATUS_ACCEPTED },
            1000: { docId: 1000, status: STATUS.STATUS_ACCEPTED },
        });
        state.getStatus = async () => ({
            enroll: 1,
            done: true,
            doneNids: [1],
            donePids: [1000, 1002],
        });
        const handler = handlerFor({ editDomain: false });
        await handler.get('system', tid);
        assert.equal(statusWrites, 0);
        assert.equal(handler.response.body.tsdoc.done, true);

        state.getStatus = async () => ({
            enroll: 1,
            done: false,
            doneNids: [],
            donePids: [],
        });
        problem.getListStatus = async () => ({
            1000: { docId: 1000, status: STATUS.STATUS_ACCEPTED },
        });
        await handler.get('system', tid);
        assert.equal(statusWrites, 1);
        assert.deepEqual(handler.response.body.tsdoc.donePids, [1000]);
        assert.equal(handler.response.body.tsdoc.done, false);
        assert.equal(handler.response.body.tsdoc.enroll, 1);
        assert.equal(handler.response.body.nsdict[1].isProgress, true);
        assert.equal(handler.response.body.nsdict[1].isOpen, false);
    });

    it('does not load enrollee profiles or domain groups for a brief page view', async () => {
        const used = { enroll: 0, groups: 0, render: 0 };
        state.enroll = async () => {
            used.enroll++;
            return [{ uid: 2 }];
        };
        user.listGroup = async () => {
            used.groups++;
            return [{ name: 'class' }];
        };
        user.getListForRender = async () => {
            used.render++;
            return { 2: { uname: 'alice' } };
        };
        problem.getList = async () => ({ 1000: { docId: 1000, title: 'A + B', tag: [] } });
        problem.getListStatus = async (_domainId, uid) => {
            assert.equal(uid, 7);
            return {};
        };
        state.getStatus = async () => ({ enroll: 1, done: false, doneNids: [], donePids: [] });
        const handler = handlerFor();
        await handler.get('system', tid, undefined, true);
        assert.deepEqual(used, { enroll: 0, groups: 0, render: 0 });
        assert.deepEqual(handler.response.body.udict, {});
        assert.deepEqual(handler.response.body.groups, []);
        assert.equal(handler.response.body.udoc.uname, 'owner');
        assert.equal(handler.response.body.tsdoc.enroll, 1);
    });

    it('fetches problems, statuses, and enrollee ids together, then renders users', async () => {
        const gate = deferred();
        const started: string[] = [];
        let rendered = false;
        state.enroll = async () => {
            started.push('enroll');
            await gate.promise;
            return [{ uid: 2 }];
        };
        user.getById = async () => {
            started.push('owner');
            await gate.promise;
            return { _id: 3, uname: 'owner' };
        };
        user.listGroup = async () => {
            started.push('groups');
            await gate.promise;
            return [];
        };
        user.getListForRender = async () => {
            rendered = true;
            return { 2: { uname: 'alice' } };
        };
        problem.getList = async () => {
            started.push('problems');
            await gate.promise;
            return { 1000: { docId: 1000, title: 'A + B', tag: [] } };
        };
        problem.getListStatus = async () => {
            started.push('status');
            await gate.promise;
            return {};
        };
        state.getStatus = async () => {
            started.push('previous');
            await gate.promise;
            return { enroll: 0, done: false, doneNids: [], donePids: [] };
        };
        const handler = handlerFor();
        const pending = handler.get('system', tid);
        await flush();
        assert.equal(rendered, false);
        assert.deepEqual(started.sort(), ['enroll', 'groups', 'owner', 'previous', 'problems', 'status']);
        gate.resolve();
        await pending;
        assert.equal(rendered, true);
        assert.equal(handler.response.body.udict[2].uname, 'alice');
    });

    it('uses the caller when that caller cannot open another enrollee profile', async () => {
        const seen: number[] = [];
        problem.getList = async () => ({ 1000: { docId: 1000, title: 'A + B', tag: [] } });
        problem.getListStatus = async (_domainId: string, uid: number) => {
            seen.push(uid);
            return {};
        };
        state.getStatus = async (_domainId: string, _docId: ObjectId, uid: number) => {
            seen.push(uid);
            return { enroll: 0, done: false, doneNids: [], donePids: [] };
        };
        const handler = handlerFor({ profile: false, editDomain: false });
        await handler.get('system', tid, 42);
        assert.equal(seen.includes(42), false);
        assert.equal(seen.length, 2);
        assert.ok(seen.every((uid) => uid === 7));
    });
});
