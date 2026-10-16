import assert from 'assert';
import { describe, it } from 'node:test';
import type { CreateToolAgentOptions } from '../../src/lib/ai/agent';
import type { ContestAnalysisPayload, ContestAnalysisSnapshot } from '../../src/lib/ai/contest-analysis/types';

function mock(request: string, exports: unknown) {
    require.cache[require.resolve(request)] = { exports } as NodeJS.Module;
}

Object.assign(global, { Hydro: { model: {}, ui: {} }, app: { get: () => undefined } });
mock('../../src/service/db', { collection: () => null });
mock('../../src/lib/ai/contest-analysis/snapshot', {
    buildContestAnalysisSnapshot: async () => null,
});
mock('../../src/lib/ai/contest-analysis/runtime', {
    getContestAnalysisConfig: () => ({
        enabled: true,
        profileId: 'provider-1:model-1',
        apiType: 'openai-responses',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-5',
        apiKey: 'test-key',
        reasoning: true,
        thinkingLevel: 'high',
        contextTokens: 128_000,
        maxTokens: 32_000,
    }),
    validateContestAnalysisConfig: () => undefined,
});

type JobsModule = typeof import('../../src/lib/ai/contest-analysis/jobs');
const { ContestAnalysisJobs } = require('../../src/lib/ai/contest-analysis/jobs') as JobsModule;

function snapshotFixture(): ContestAnalysisSnapshot {
    const problems = [{
        pid: 1001,
        title: '访问',
        difficulty: 3,
        tags: ['排序'],
        maxScore: 100,
        submissionCount: 2,
        attemptCount: 2,
        acceptCount: 1,
        averageScore: 60,
        scoreBuckets: [],
    }];
    return {
        version: 1,
        generatedAt: '2026-10-16T00:00:00.000Z',
        title: '联合分析',
        instructions: '',
        contests: [{
            tid: '665f000000000000000000aa',
            title: 'R1',
            rule: 'oi',
            beginAt: '2026-09-01T00:00:00.000Z',
            endAt: '2026-09-01T04:00:00.000Z',
            durationMs: 14_400_000,
            registeredCount: 2,
            participantCount: 2,
            problems,
            difficultyGradient: [3],
            tagOverlap: [],
            scoreStats: {
                count: 2, mean: 60, median: 60, max: 100, min: 20, buckets: [0, 0, 2],
            },
        }],
        tags: [{
            tag: '排序',
            problemCount: 1,
            contestCount: 1,
            attemptCount: 2,
            studentCount: 2,
            solveCount: 1,
            solveRate: 0.5,
            scoreRate: 60,
            problems: [{
                tid: '665f000000000000000000aa', pid: 1001, title: '访问', difficulty: 3, solveRate: 0.5,
            }],
        }],
        students: [1, 2].map((uid) => ({
            uid,
            uname: `user${uid}`,
            displayName: `User ${uid}`,
            contests: [],
            totals: {
                score: 0, maxScore: 100, contestCount: 1, attendedCount: 1,
                solvedCount: 0, problemCount: 1, averageScore: 0, medianRank: uid,
            },
            tags: [{
                tag: '排序', attempted: 1, solved: 0, partial: 0, failed: 1,
            }],
        })),
    };
}

const payload: ContestAnalysisPayload = {
    domain: 'system',
    jobId: 'job-1',
    tids: ['665f000000000000000000aa'],
    title: '联合分析',
    instructions: '',
    includeStudents: true,
    actorUid: 1,
    language: 'zh',
    profileId: 'provider-1:model-1',
    stage: 'waiting',
    progress: 0,
    events: [],
    scope: {
        title: '联合分析',
        contests: [{
            tid: '665f000000000000000000aa',
            title: 'R1',
            beginAt: '2026-09-01T00:00:00.000Z',
            problemCount: 1,
            participantCount: 2,
        }],
        problemCount: 1,
        studentCount: 2,
    },
};

function createStore() {
    const updates: Partial<ContestAnalysisPayload>[] = [];
    return {
        updates,
        async updatePayload(_id: string, value: Partial<ContestAnalysisPayload>) {
            updates.push(value);
        },
        async findJob() {
            return { payload: { cancelRequested: false } };
        },
    };
}

function overviewPayload() {
    return {
        summary: '班级整体表现平稳。',
        keywords: ['整体偏难'],
        weakPoints: [],
        difficultyComment: '难度偏高。',
        balanceComment: '覆盖均衡。',
        highlights: [],
        recommendations: [],
    };
}

function studentPayload() {
    return [1, 2].map((uid) => ({
        uid,
        level: 'average',
        summary: '需要加强。',
        strengths: [],
        weaknesses: [],
        recurringIssues: [],
        focusTags: [],
        contestComments: [],
        actionPlan: [],
    }));
}

function submissionFor(options: CreateToolAgentOptions) {
    if (options.tools.some((tool) => tool.name === 'submit_overall_analysis')) {
        return {
            overview: overviewPayload(),
            contests: [{
                tid: '665f000000000000000000aa',
                summary: '第一场',
                difficultyComment: '',
                balanceComment: '',
                problemComments: [],
            }],
        };
    }
    return { students: studentPayload() };
}

describe('contest analysis job runner', () => {
    it('runs the overview and per-batch student turns, then returns the merged report', async () => {
        const store = createStore();
        const prompts: CreateToolAgentOptions[] = [];
        const jobs = new ContestAnalysisJobs({
            store: store as any,
            buildSnapshot: async () => snapshotFixture(),
            createAgent: async (options) => {
                prompts.push(options);
                return {
                    async prompt() {
                        const submit = options.tools.find((tool) => tool.name.startsWith('submit_'));
                        assert.ok(submit, 'a submit tool must be registered');
                        await submit.execute('call-1', submissionFor(options), undefined as any);
                        return 'done';
                    },
                    abort() { },
                };
            },
        } as any);

        const result = await (jobs as any).run(payload, new AbortController().signal);
        assert.equal(prompts.length, 2);
        assert.deepEqual(result.report.students.map((item: any) => item.uid), [1, 2]);
        assert.equal(result.report.contests.length, 1);
        assert.equal(result.report.overview.keywords[0], '整体偏难');
        assert.equal(store.updates.at(-1)?.progress, 100);
        assert.equal(store.updates.at(-1)?.stage, 'done');
        assert.ok(store.updates.some((update) => update.stage === 'students'));
    });

    it('repairs an invalid submission before failing', async () => {
        const store = createStore();
        let attempts = 0;
        const jobs = new ContestAnalysisJobs({
            store: store as any,
            buildSnapshot: async () => snapshotFixture(),
            createAgent: async (options) => ({
                async prompt() {
                    attempts++;
                    const submit = options.tools.find((tool) => tool.name.startsWith('submit_'));
                    if (options.tools.some((tool) => tool.name === 'submit_overall_analysis')) {
                        const invalid = attempts === 1;
                        await submit!.execute('call-1', {
                            overview: {
                                ...overviewPayload(),
                                weakPoints: [],
                            },
                            contests: [{
                                tid: invalid ? 'unknown' : '665f000000000000000000aa',
                                summary: '第一场',
                                difficultyComment: '',
                                balanceComment: '',
                                problemComments: [],
                            }],
                        }, undefined as any);
                    } else {
                        await submit!.execute('call-1', { students: studentPayload() }, undefined as any);
                    }
                    return 'done';
                },
                abort() { },
            }),
        } as any);

        const result = await (jobs as any).run(payload, new AbortController().signal);
        assert.equal(attempts, 3);
        assert.equal(result.report.contests[0].tid, '665f000000000000000000aa');
    });

    it('fails when the agent never submits a report', async () => {
        const store = createStore();
        const jobs = new ContestAnalysisJobs({
            store: store as any,
            buildSnapshot: async () => snapshotFixture(),
            createAgent: async () => ({
                async prompt() {
                    return 'no tool call';
                },
                abort() { },
            }),
        } as any);

        await assert.rejects(
            () => (jobs as any).run(payload, new AbortController().signal),
            /submit_overall_analysis/,
        );
    });
});
