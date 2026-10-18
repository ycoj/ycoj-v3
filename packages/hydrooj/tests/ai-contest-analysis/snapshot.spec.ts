import assert from 'assert';
import { ObjectId } from 'mongodb';
import { describe, it } from 'node:test';

function mock(request: string, exports: unknown) {
    require.cache[require.resolve(request)] = { exports } as NodeJS.Module;
}

mock('../../src/service/db', {});
const contestModel: any = { get: undefined, getMultiStatus: undefined };
const problemModel: any = { PROJECTION_CONTEST_DETAIL: ['docId', 'title', 'content'] };
mock('../../src/model/contest', contestModel);
mock('../../src/model/problem', { __esModule: true, default: problemModel });
mock('../../src/model/user', { default: {} });

type SnapshotModule = typeof import('../../src/lib/ai/contest-analysis/snapshot');
const { collectContestAnalysisData, computeContestAnalysisSnapshot } = require('../../src/lib/ai/contest-analysis/snapshot') as SnapshotModule;

const STATUS_ACCEPTED = 1;
const STATUS_WRONG_ANSWER = 2;

function tdoc(tid: ObjectId, title: string, pids: number[], score?: Record<number, number>) {
    const beginAt = new Date('2026-09-01T00:00:00Z');
    const endAt = new Date('2026-09-01T04:00:00Z');
    return {
        docId: tid, title, rule: 'oi', pids, beginAt, endAt, attend: 0, duration: 4, score,
    } as any;
}

function pdoc(pid: number, title: string, difficulty: number, tag: string[]) {
    return { docId: pid, title, difficulty, tag } as any;
}

function journalEntry(pid: number, score: number, status: number, minutes: number) {
    return {
        rid: new ObjectId(), pid, score, status, time: minutes * 60 * 1000,
    } as any;
}

function detail(pid: number, score: number, status: number) {
    return {
        pid,
        score,
        status,
        rid: new ObjectId('665f00000000000000000001'),
    };
}

describe('contest analysis snapshot', () => {
    it('collects statements and existing metadata and preserves missing metadata as unknown', async () => {
        const tid = new ObjectId('665f000000000000000000aa');
        const docs = [
            { ...pdoc(1001, '排序', 3, ['排序']), content: '将 n 个整数按升序排列。' },
            { docId: 1002, title: '最短路', content: '求带权有向图中的最短路，n <= 100000。' },
        ];
        contestModel.get = async () => tdoc(tid, 'R1', [1001, 1002]);
        contestModel.getMultiStatus = () => ({ sort: () => ({ toArray: async () => [] }) });
        problemModel.getList = async (domainId, pids, includeHidden, includeReferenced, projection) => {
            assert.equal(domainId, 'school');
            assert.deepEqual(pids, [1001, 1002]);
            assert.equal(includeHidden, true);
            assert.equal(includeReferenced, true);
            assert.ok(projection.includes('content'));
            assert.ok(projection.includes('tag'));
            assert.ok(projection.includes('difficulty'));
            return Object.fromEntries(docs.map((doc) => [doc.docId, Object.fromEntries(
                Object.entries(doc).filter(([field]) => projection.includes(field)),
            )]));
        };
        const raw = await collectContestAnalysisData('school', [tid]);
        const snapshot = computeContestAnalysisSnapshot(raw);
        const [known, unknown] = snapshot.contests[0].problems;
        assert.equal(known.content, docs[0].content);
        assert.deepEqual(known.tags, ['排序']);
        assert.equal(known.difficulty, 3);
        assert.equal(unknown.content, docs[1].content);
        assert.deepEqual(unknown.tags, []);
        assert.equal(unknown.difficulty, 0);
    });

    it('aggregates contest, problem, student and tag statistics from scoreboards', () => {
        const tid = new ObjectId('665f000000000000000000aa');
        const raw = [{
            tdoc: tdoc(tid, 'R1', [1001, 1002]),
            pdocs: [pdoc(1001, '访问', 3, ['排序', '贪心']), pdoc(1002, '数点', 7, ['动态规划'])],
            students: [
                {
                    uid: 1,
                    score: 140,
                    journal: [
                        journalEntry(1001, 100, STATUS_ACCEPTED, 30),
                        journalEntry(1002, 40, STATUS_WRONG_ANSWER, 60),
                        journalEntry(1002, 30, STATUS_WRONG_ANSWER, 70),
                    ],
                    detail: { 1001: detail(1001, 100, STATUS_ACCEPTED), 1002: detail(1002, 40, STATUS_WRONG_ANSWER) },
                },
                {
                    uid: 2,
                    score: 100,
                    journal: [journalEntry(1001, 100, STATUS_ACCEPTED, 20)],
                    detail: { 1001: detail(1001, 100, STATUS_ACCEPTED) },
                },
                {
                    uid: 3,
                    score: 0,
                    journal: [],
                    detail: {},
                },
            ],
        }];

        const snapshot = computeContestAnalysisSnapshot(raw, { title: '联合分析' });
        assert.equal(snapshot.title, '联合分析');
        assert.equal(snapshot.contests.length, 1);

        const contest = snapshot.contests[0];
        assert.equal(contest.tid, tid.toHexString());
        assert.equal(contest.participantCount, 3);
        assert.deepEqual(contest.difficultyGradient, [3, 7]);
        assert.equal(contest.scoreStats.max, 140);
        assert.equal(contest.scoreStats.median, 100);
        assert.equal(contest.scoreStats.mean, 80);
        assert.deepEqual(contest.scoreStats.buckets, [1, 0, 2, 0]);

        const [first, second] = contest.problems;
        assert.equal(first.acceptCount, 2);
        assert.equal(first.attemptCount, 2);
        assert.equal(first.submissionCount, 2);
        assert.equal(first.averageScore, 100);
        assert.equal(second.acceptCount, 0);
        assert.equal(second.attemptCount, 1);
        assert.equal(second.submissionCount, 2);
        assert.equal(second.averageScore, 40);
        assert.equal(second.scoreBuckets[4], 1);
        assert.equal(first.scoreBuckets[10], 2);

        assert.deepEqual(contest.tagOverlap, []);

        assert.equal(snapshot.students.length, 3);
        const student = snapshot.students.find((item) => item.uid === 1)!;
        assert.equal(student.contests.length, 1);
        assert.equal(student.contests[0].score, 140);
        assert.deepEqual(student.contests[0].solved, [1001]);
        assert.equal(student.totals.solvedCount, 1);
        assert.equal(student.totals.problemCount, 2);
        assert.equal(student.totals.attendedCount, 1);
        assert.deepEqual(
            student.tags.map((tag) => ({ tag: tag.tag, attempted: tag.attempted, solved: tag.solved, partial: tag.partial })),
            [
                { tag: '动态规划', attempted: 1, solved: 0, partial: 1 },
                { tag: '排序', attempted: 1, solved: 1, partial: 0 },
                { tag: '贪心', attempted: 1, solved: 1, partial: 0 },
            ],
        );

        const idle = snapshot.students.find((item) => item.uid === 3)!;
        assert.equal(idle.totals.attendedCount, 0);
        assert.equal(idle.contests[0].score, 0);

        const tags = Object.fromEntries(snapshot.tags.map((tag) => [tag.tag, tag]));
        assert.equal(tags['排序'].attemptCount, 2);
        assert.equal(tags['排序'].solveCount, 2);
        assert.equal(tags['排序'].solveRate, 1);
        assert.equal(tags['动态规划'].attemptCount, 1);
        assert.equal(tags['动态规划'].solveRate, 0);
        assert.equal(tags['动态规划'].studentCount, 1);
        // Weakest solve rate first.
        assert.equal(snapshot.tags[0].tag, '动态规划');
    });

    it('weights scores by the contest problem score configuration', () => {
        const tid = new ObjectId('665f000000000000000000bb');
        const raw = [{
            tdoc: tdoc(tid, 'R2', [2001], { 2001: 50 }),
            pdocs: [pdoc(2001, '半权题', 5, ['数学'])],
            students: [{
                uid: 9,
                score: 50,
                journal: [journalEntry(2001, 100, STATUS_ACCEPTED, 10)],
                detail: { 2001: detail(2001, 100, STATUS_ACCEPTED) },
            }],
        }];
        const snapshot = computeContestAnalysisSnapshot(raw);
        const problem = snapshot.contests[0].problems[0];
        assert.equal(problem.maxScore, 50);
        assert.equal(problem.acceptCount, 1);
        assert.equal(problem.averageScore, 50);
        assert.equal(snapshot.students[0].contests[0].score, 50);
        assert.equal(snapshot.students[0].contests[0].problems[0].accepted, true);
    });
});
