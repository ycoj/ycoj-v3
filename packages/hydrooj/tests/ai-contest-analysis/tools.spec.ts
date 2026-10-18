import assert from 'assert';
import { describe, it } from 'node:test';
import { createContestAnalysisTools } from '../../src/lib/ai/contest-analysis/tools';
import type { ContestAnalysisSnapshot } from '../../src/lib/ai/contest-analysis/types';

async function fixture(content?: string) {
    const { Type } = await import('@earendil-works/pi-ai');
    const snapshot: ContestAnalysisSnapshot = {
        version: 1,
        generatedAt: '2026-10-18T00:00:00.000Z',
        title: '',
        instructions: '',
        contests: [{
            tid: 'aaa', title: 'R1', rule: 'oi', beginAt: '', endAt: '', durationMs: 0,
            registeredCount: 0, participantCount: 0, difficultyGradient: [0], tagOverlap: [],
            scoreStats: { count: 0, mean: 0, median: 0, max: 0, min: 0, buckets: [] },
            problems: [{
                pid: 1001, title: '最短路', content, difficulty: 0, tags: [], maxScore: 100,
                submissionCount: 0, attemptCount: 0, acceptCount: 0, averageScore: 0, scoreBuckets: [],
            }],
        }],
        students: [],
        tags: [],
    };
    const tools = createContestAnalysisTools(Type, { snapshot });
    return {
        get: (name: string) => tools.find((tool) => tool.name === name),
        snapshot,
    };
}

async function read(tool: any, params: Record<string, any>) {
    const result = await tool.execute('call', params);
    assert.equal(result.details.truncated, false);
    return JSON.parse(result.content[0].text);
}

describe('contest analysis statement access', () => {
    it('makes descriptions available without metadata or adding statements to bulk summaries', async () => {
        const content = '求带权有向图中的最短路。\n约束：n <= 100000，m <= 200000，边权非负。';
        const { get, snapshot } = await fixture(content);
        const statement = await read(get('get_problem_statement'), { tid: 'aaa', pid: 1001 });
        assert.equal(statement.content, content);
        assert.equal(statement.nextOffset, null);
        const contest = await read(get('get_contest'), { tid: 'aaa' });
        const list = await read(get('list_problems'), {});
        for (const problem of [contest.problems[0], list.problems[0]]) {
            assert.equal(problem.content, undefined);
            assert.equal(problem.difficulty, 0);
            assert.deepEqual(problem.tags, []);
        }
        assert.equal(snapshot.contests[0].problems[0].content, content);
    });

    it('pages through long statements without losing constraints at the end or truncating JSON', async () => {
        const content = `${'说明\n"\\\u0000'.repeat(2000)}\n数据范围：n <= 100000。`;
        const { get } = await fixture(content);
        let offset = 0;
        let collected = '';
        for (;;) {
            // Each page starts at the offset returned by the previous read.
            // eslint-disable-next-line no-await-in-loop
            const page = await read(get('get_problem_statement'), { tid: 'aaa', pid: 1001, offset });
            assert.equal(page.offset, offset);
            assert.equal(page.totalLength, content.length);
            collected += page.content;
            if (page.nextOffset === null) break;
            assert.ok(page.nextOffset > offset);
            offset = page.nextOffset;
        }
        assert.equal(collected, content);
    });

    it('rejects contests and problems outside the scope and invalid offsets', async () => {
        const { get } = await fixture('statement');
        const tool = get('get_problem_statement');
        await Promise.all([{ tid: 'bbb', pid: 1001 }, { tid: 'aaa', pid: 9999 }].map(
            (params) => assert.rejects(tool.execute('call', params), /not part of this analysis/),
        ));
        await Promise.all([-1, 0.5, 10].map(
            (offset) => assert.rejects(tool.execute('call', { tid: 'aaa', pid: 1001, offset }), /Statement offset/),
        ));
    });

    it('returns an empty statement for unavailable content and older snapshots', async () => {
        const { get } = await fixture();
        const page = await read(get('get_problem_statement'), { tid: 'aaa', pid: 1001 });
        assert.equal(page.content, '');
        assert.equal(page.totalLength, 0);
        assert.equal(page.nextOffset, null);
    });
});
