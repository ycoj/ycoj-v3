import assert from 'assert';
import { describe, it } from 'node:test';
import {
    ContestAnalysisReportError, createScopeIndex, normalizeContestReports, normalizeOverviewReport,
    normalizeStudentReports,
} from '../../src/lib/ai/contest-analysis/report';
import type { ContestAnalysisSnapshot } from '../../src/lib/ai/contest-analysis/types';

function snapshotFixture(): ContestAnalysisSnapshot {
    return {
        version: 1,
        generatedAt: '2026-10-16T00:00:00.000Z',
        title: '联合分析',
        instructions: '',
        contests: [
            {
                tid: 'aaa',
                title: 'R1',
                rule: 'oi',
                beginAt: '2026-09-01T00:00:00.000Z',
                endAt: '2026-09-01T04:00:00.000Z',
                durationMs: 14_400_000,
                registeredCount: 2,
                participantCount: 2,
                problems: [{
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
                }],
                difficultyGradient: [3],
                tagOverlap: [],
                scoreStats: {
                    count: 2, mean: 60, median: 60, max: 100, min: 20, buckets: [],
                },
            },
            {
                tid: 'bbb',
                title: 'R2',
                rule: 'oi',
                beginAt: '2026-09-08T00:00:00.000Z',
                endAt: '2026-09-08T04:00:00.000Z',
                durationMs: 14_400_000,
                registeredCount: 1,
                participantCount: 1,
                problems: [{
                    pid: 1002,
                    title: '数点',
                    difficulty: 7,
                    tags: ['动态规划'],
                    maxScore: 100,
                    submissionCount: 1,
                    attemptCount: 1,
                    acceptCount: 0,
                    averageScore: 0,
                    scoreBuckets: [],
                }],
                difficultyGradient: [7],
                tagOverlap: [],
                scoreStats: {
                    count: 1, mean: 0, median: 0, max: 0, min: 0, buckets: [],
                },
            },
        ],
        tags: [],
        students: [
            {
                uid: 1,
                uname: 'alice',
                displayName: 'Alice',
                contests: [],
                totals: {
                    score: 0, maxScore: 0, contestCount: 2, attendedCount: 1,
                    solvedCount: 0, problemCount: 1, averageScore: 0, medianRank: 0,
                },
                tags: [],
            },
            {
                uid: 2,
                uname: 'bob',
                displayName: 'Bob',
                contests: [],
                totals: {
                    score: 0, maxScore: 0, contestCount: 2, attendedCount: 2,
                    solvedCount: 0, problemCount: 2, averageScore: 0, medianRank: 0,
                },
                tags: [],
            },
        ],
    };
}

const overview = {
    summary: '班级整体表现平稳。',
    keywords: ['整体偏难'],
    weakPoints: [{
        tag: '动态规划',
        severity: 'high',
        summary: 'DP 题目失分集中。',
        evidence: 'R2 数点 0/1 满分。',
        contests: ['bbb'],
        advice: '安排 DP 专项训练。',
    }],
    difficultyComment: '难度梯度前高后低。',
    balanceComment: '知识点存在重叠。',
    highlights: ['基础题稳定'],
    recommendations: ['加强 DP'],
};

describe('contest analysis report normalization', () => {
    const scope = createScopeIndex(snapshotFixture());

    it('accepts a complete submission and keeps the analyzed order', () => {
        const normalized = normalizeOverviewReport(overview, scope);
        assert.equal(normalized.weakPoints[0].severity, 'high');
        // Contest ids are rewritten to titles for readability.
        assert.deepEqual(normalized.weakPoints[0].contests, ['R2']);

        const contests = normalizeContestReports([
            { tid: 'bbb', summary: '第二场', difficultyComment: '', balanceComment: '', problemComments: [{ pid: 1002, comment: '偏难' }] },
            { tid: 'aaa', summary: '第一场', difficultyComment: '', balanceComment: '', problemComments: [] },
        ], scope);
        assert.deepEqual(contests.map((item) => item.tid), ['aaa', 'bbb']);

        const students = normalizeStudentReports([
            {
                uid: 2,
                level: 'weak',
                summary: '需要加强',
                strengths: [],
                weaknesses: ['DP'],
                recurringIssues: [],
                focusTags: ['动态规划'],
                contestComments: [],
                actionPlan: [],
            },
            {
                uid: 1,
                level: 'excellent',
                summary: '表现稳定',
                strengths: [],
                weaknesses: [],
                recurringIssues: [],
                focusTags: [],
                contestComments: [{ tid: 'aaa', comment: '稳定' }],
                actionPlan: [],
            },
        ], scope, [1, 2]);
        assert.deepEqual(students.map((item) => item.uid), [1, 2]);

        const fallback = normalizeStudentReports([{
            uid: 1,
            level: 'unknown-level',
            summary: 's',
            strengths: [],
            weaknesses: [],
            recurringIssues: [],
            focusTags: [],
            contestComments: [],
            actionPlan: [],
        },
        {
            uid: 2,
            level: 'good',
            summary: 's',
            strengths: [],
            weaknesses: [],
            recurringIssues: [],
            focusTags: [],
            contestComments: [],
            actionPlan: [],
        }], scope, [1, 2]);
        assert.equal(fallback.find((item) => item.uid === 1)?.level, 'average');
    });

    it('rejects unknown ids and incomplete batches', () => {
        assert.throws(
            () => normalizeContestReports([{ tid: 'zzz', summary: 'x' }], scope),
            ContestAnalysisReportError,
        );
        assert.throws(
            () => normalizeContestReports([
                { tid: 'aaa', summary: 'x', problemComments: [{ pid: 1002, comment: 'x' }] },
                { tid: 'bbb', summary: 'x' },
            ], scope),
            ContestAnalysisReportError,
        );
        assert.throws(
            () => normalizeStudentReports([{
                uid: 42,
                level: 'good',
                summary: 'x',
                strengths: [],
                weaknesses: [],
                recurringIssues: [],
                focusTags: [],
                contestComments: [],
                actionPlan: [],
            }], scope, [1, 2]),
            ContestAnalysisReportError,
        );
        assert.throws(
            () => normalizeOverviewReport({ ...overview, summary: '' }, scope),
            ContestAnalysisReportError,
        );
    });

    it('trims long text and drops empty list items', () => {
        const normalized = normalizeOverviewReport({
            ...overview,
            summary: 'x'.repeat(5_000),
            highlights: ['ok', '   ', 'y'.repeat(600)],
        }, scope);
        assert.equal(normalized.summary.length, 4_001);
        assert.equal(normalized.highlights.length, 2);
        assert.equal(normalized.highlights[1].length, 401);
    });
});
