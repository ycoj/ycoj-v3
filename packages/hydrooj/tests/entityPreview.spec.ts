import assert from 'assert';
import { ObjectId } from 'mongodb';
import { describe, it } from 'node:test';

const {
    buildContestPreview, buildHomeworkPreview, buildProblemPreview, buildTrainingPreview,
    clipExcerpt, CONTEST_PREVIEW_FIELDS, previewOmitsHeavyFields, PROBLEM_PREVIEW_FIELDS,
    scheduleStatus, TRAINING_EXCERPT_SAMPLE,
} = require('../src/lib/entityPreview');

const now = Date.parse('2026-06-01T12:00:00.000Z');
const tid = new ObjectId('665f00000000000000000001');

describe('entity preview builders', () => {
    it('keeps problem, contest, and training reads off statements and testdata', () => {
        assert.equal(previewOmitsHeavyFields(PROBLEM_PREVIEW_FIELDS), true);
        assert.equal(previewOmitsHeavyFields(CONTEST_PREVIEW_FIELDS), true);
        assert.equal(PROBLEM_PREVIEW_FIELDS.includes('content'), false);
        assert.equal(CONTEST_PREVIEW_FIELDS.includes('content'), false);
    });

    it('builds a short problem preview from list fields', () => {
        const preview = buildProblemPreview('P1000', {
            docId: 1000,
            pid: 'P1000',
            title: 'A + B',
            difficulty: 3,
            tag: ['math', 'implementation', 'dp', 'graph'],
            nAccept: 12,
            nSubmit: 40,
            hidden: false,
            content: '# statement',
            data: [{ name: '1.in' }],
            config: 'type: default',
        });
        assert.deepEqual(preview, {
            kind: 'problem',
            id: 'P1000',
            pid: 'P1000',
            title: 'A + B',
            difficulty: 3,
            tags: ['math', 'implementation', 'dp'],
            nAccept: 12,
            nSubmit: 40,
            hidden: false,
        });
        assert.equal('content' in preview, false);
    });

    it('classifies contest time and keeps homework on its deadline', () => {
        const contest = buildContestPreview({
            docId: tid,
            title: 'Weekly',
            rule: 'oi',
            beginAt: new Date('2026-06-02T12:00:00.000Z'),
            endAt: new Date('2026-06-02T17:00:00.000Z'),
            attend: 24,
            pids: [1, 2, 3],
            rated: true,
            content: 'long statement',
        }, now);
        assert.equal(contest.status, 'pending');
        assert.equal(contest.problemCount, 3);
        assert.equal(contest.rated, true);
        assert.equal('content' in contest, false);

        const running = scheduleStatus(
            new Date('2026-06-01T00:00:00.000Z'),
            new Date('2026-06-01T18:00:00.000Z'),
            now,
        );
        assert.equal(running, 'running');

        const homework = buildHomeworkPreview({
            docId: tid,
            title: 'Week 1',
            rule: 'homework',
            beginAt: new Date('2026-05-01T00:00:00.000Z'),
            endAt: new Date('2026-06-20T00:00:00.000Z'),
            penaltySince: new Date('2026-06-08T15:59:00.000Z'),
            attend: 18,
            pids: [1],
        }, now);
        assert.equal(homework.status, 'running');
        assert.equal(homework.deadline, '2026-06-08T15:59:00.000Z');
    });

    it('clips the training summary and reports stored enrollment progress', () => {
        assert.equal(clipExcerpt('  line   one \n line two  '), 'line one line two');
        assert.equal(clipExcerpt('a'.repeat(200)).endsWith('…'), true);
        assert.equal(clipExcerpt('a'.repeat(200)).length, 141);

        const preview = buildTrainingPreview({
            docId: tid,
            title: 'Dynamic Programming',
            excerpt: 'Knapsack and LIS.',
            attend: 30,
            dag: [
                { pids: [1, 2] },
                { pids: [2, 3] },
            ],
            description: 'full description',
            content: 'full summary',
        }, { enroll: 1, donePids: [1, 9] });
        assert.equal(preview.excerpt, 'Knapsack and LIS.');
        assert.equal(preview.sectionCount, 2);
        assert.equal(preview.problemCount, 3);
        assert.equal(preview.enrolled, true);
        assert.equal(preview.progress, 33);
        assert.equal('description' in preview, false);

        const guest = buildTrainingPreview({
            docId: tid,
            title: 'Dynamic Programming',
            dag: [{ pids: [1] }],
        }, null);
        assert.equal(guest.enrolled, false);
        assert.equal(guest.progress, null);
    });
});

function mock(request: string, exports: unknown) {
    require.cache[require.resolve(request)] = { exports } as NodeJS.Module;
}

const state: {
    problem: any;
    contest: any;
    training: any;
    status: any;
    groups: string[];
    problemArgs: unknown[];
    contestArgs: unknown[];
    trainingProject: unknown;
    statusReads: number;
    statusWrites: number;
    fullTrainingReads: number;
} = {
    problem: null,
    contest: null,
    training: null,
    status: null,
    groups: [],
    problemArgs: [],
    contestArgs: [],
    trainingProject: null,
    statusReads: 0,
    statusWrites: 0,
    fullTrainingReads: 0,
};

mock('../src/service/db', { collection: () => ({}) });
mock('../src/service/server', require('@hydrooj/framework'));
mock('../src/model/problem', {
    get: async (...args: unknown[]) => {
        state.problemArgs.push(args);
        return state.problem;
    },
});
mock('../src/model/training', {
    get: async () => {
        state.fullTrainingReads += 1;
        throw new Error('preview must not load the full training document');
    },
    setStatus: async () => {
        state.statusWrites += 1;
        throw new Error('preview must not write training progress');
    },
    getStatus: async () => {
        state.statusReads += 1;
        return state.status;
    },
});
mock('../src/model/user', {
    listGroup: async () => state.groups.map((name) => ({ name })),
});
mock('../src/model/document', {
    TYPE_CONTEST: 30,
    TYPE_TRAINING: 40,
    get: async (...args: unknown[]) => {
        state.contestArgs.push(args);
        return state.contest;
    },
    coll: {
        find: () => ({
            project: (projection: unknown) => {
                state.trainingProject = projection;
                return {
                    limit: () => ({
                        toArray: async () => (state.training ? [state.training] : []),
                    }),
                };
            },
        }),
    },
});

(global as any).Hydro = (global as any).Hydro || { model: {}, ui: {} };
const { PERM } = require('../src/model/builtin');
const { PermissionError, NotAssignedError, ContestNotFoundError } = require('../src/error');
const { loadEntityPreview } = require('../src/handler/entityPreview');

function caller(options: { perms?: bigint[], groups?: string[], id?: number, ownerOf?: boolean } = {}) {
    const perms = new Set(options.perms || []);
    const id = options.id ?? 7;
    return {
        domain: { _id: 'system' },
        user: {
            _id: id,
            group: options.groups || [],
            own: (doc: { owner?: number, maintainer?: number[] }) => doc.owner === id || (doc.maintainer || []).includes(id),
            hasPerm: (perm: bigint) => perms.has(perm),
        },
        checkPerm: (...required: bigint[]) => {
            if (!required.some((perm) => perms.has(perm))) throw new PermissionError(...required);
        },
    };
}

describe('entity preview loader', () => {
    it('reads a problem with the light projection and hides it without permission', async () => {
        state.problem = {
            docId: 1000,
            pid: 'P1000',
            owner: 3,
            title: 'A + B',
            difficulty: 1,
            tag: ['math'],
            nAccept: 2,
            nSubmit: 5,
            hidden: true,
            content: 'secret',
        };
        state.problemArgs = [];
        const visible = await loadEntityPreview(
            caller({ perms: [PERM.PERM_VIEW_PROBLEM, PERM.PERM_VIEW_PROBLEM_HIDDEN] }),
            { kind: 'problem', id: 'P1000' },
        );
        assert.equal(visible.hidden, true);
        assert.equal(visible.title, 'A + B');
        assert.deepEqual(state.problemArgs[0][2], PROBLEM_PREVIEW_FIELDS);
        await assert.rejects(
            () => loadEntityPreview(caller({ perms: [PERM.PERM_VIEW_PROBLEM] }), { kind: 'problem', id: 'P1000' }),
            PermissionError,
        );
        const owned = await loadEntityPreview(caller({ perms: [PERM.PERM_VIEW_PROBLEM], id: 3 }), { kind: 'problem', id: 'P1000' });
        assert.equal(owned.pid, 'P1000');
    });

    it('rejects an unassigned contest and does not load its statement', async () => {
        state.contest = {
            docId: tid,
            title: 'Weekly',
            rule: 'oi',
            beginAt: new Date('2026-06-02T00:00:00.000Z'),
            endAt: new Date('2026-06-02T05:00:00.000Z'),
            attend: 4,
            pids: [1, 2],
            owner: 1,
            assign: ['class-a'],
            content: 'statement',
        };
        state.groups = ['class-b'];
        state.contestArgs = [];
        await assert.rejects(
            () => loadEntityPreview(caller({ perms: [PERM.PERM_VIEW_CONTEST] }), { kind: 'contest', id: tid.toHexString() }),
            NotAssignedError,
        );
        assert.deepEqual(state.contestArgs[0][3], CONTEST_PREVIEW_FIELDS);
        state.groups = ['class-a'];
        const preview = await loadEntityPreview(
            caller({ perms: [PERM.PERM_VIEW_CONTEST] }),
            { kind: 'contest', id: tid.toHexString() },
        );
        assert.equal(preview.kind, 'contest');
        assert.equal(preview.title, 'Weekly');
        await assert.rejects(
            () => loadEntityPreview(
                caller({ perms: [PERM.PERM_VIEW_HOMEWORK] }),
                { kind: 'homework', id: tid.toHexString() },
            ),
            ContestNotFoundError,
        );
    });

    it('samples a training summary and stored progress without the detail loader', async () => {
        state.training = {
            docId: tid,
            title: 'Dynamic Programming',
            excerpt: 'Knapsack.',
            attend: 9,
            dag: [{ pids: [1, 2] }, { pids: [3] }],
        };
        state.status = { enroll: 1, donePids: [1] };
        state.statusReads = 0;
        state.statusWrites = 0;
        state.fullTrainingReads = 0;
        state.trainingProject = null;
        const preview = await loadEntityPreview(
            caller({ perms: [PERM.PERM_VIEW_TRAINING] }),
            { kind: 'training', id: tid.toHexString() },
        );
        assert.equal(preview.kind, 'training');
        assert.equal(preview.excerpt, 'Knapsack.');
        assert.equal(preview.problemCount, 3);
        assert.equal(preview.progress, 33);
        assert.equal(state.statusReads, 1);
        assert.equal(state.statusWrites, 0);
        assert.equal(state.fullTrainingReads, 0);
        const projection = state.trainingProject as Record<string, unknown>;
        assert.equal(projection.content, undefined);
        assert.equal(projection.description, undefined);
        assert.equal(projection.files, undefined);
        assert.deepEqual(projection.excerpt, {
            $substrCP: [{ $ifNull: ['$content', ''] }, 0, TRAINING_EXCERPT_SAMPLE],
        });
    });
});
