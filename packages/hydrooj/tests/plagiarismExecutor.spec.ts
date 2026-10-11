import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { test } from 'node:test';
import { runPlagiarismComparisons } from '../src/lib/plagiarismExecutor';

const code = `#include <bits/stdc++.h>
using namespace std;
int main() {
    int n; cin >> n;
    vector<int> values(n);
    for(int i = 0; i < n; ++i) cin >> values[i];
    sort(values.begin(), values.end());
    long long answer = 0;
    for(int i = 0; i < n; ++i) answer += values[i] * (i + 1);
    cout << answer << '\\n';
    return 0;
}`;

test('isolated comparisons report progress, compare only the same problem, and finish below two seconds', async () => {
    const controller = new AbortController();
    const progress: { completedPairs: number, totalPairs: number }[] = [];
    const started = performance.now();
    const result = await runPlagiarismComparisons([
        { rid: 'a', pid: 1, code },
        { rid: 'b', pid: 1, code: code.replaceAll('values', 'numbers') },
        { rid: 'c', pid: 2, code },
    ], controller.signal, async (value) => { progress.push(value); });
    assert.equal(result.prepared.length, 3);
    assert.equal(result.skipped.length, 0);
    assert.equal(result.pairs.length, 1);
    assert.equal(result.pairs[0].leftRid, 'a');
    assert.equal(result.pairs[0].rightRid, 'b');
    assert.ok(result.pairs[0].similarity >= 85);
    assert.deepEqual(progress.at(-1), { completedPairs: 1, totalPairs: 1 });
    assert.ok(performance.now() - started < 2000);
});

test('aborted comparisons reject without starting a worker', async () => {
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(runPlagiarismComparisons([], controller.signal), /aborted/);
});

test('active worker termination releases CPU work and rejects promptly', async () => {
    const controller = new AbortController();
    const result = runPlagiarismComparisons(Array.from({ length: 80 }, (_, index) => ({
        rid: String(index), pid: index % 4, code,
    })), controller.signal);
    controller.abort();
    await assert.rejects(result, /aborted/);
});

test('progress persistence failures fail the job rather than return an incomplete success', async () => {
    const controller = new AbortController();
    await assert.rejects(runPlagiarismComparisons([
        { rid: 'a', pid: 1, code }, { rid: 'b', pid: 1, code },
    ], controller.signal, async () => { throw new Error('Database unavailable.'); }), /Database unavailable/);
});

test('a full contest with large sources fits the isolated heap and leaves the main event loop responsive', async () => {
    const sources = Array.from({ length: 80 }, (_, index) => {
        const statements = Array.from({ length: 6200 }, (_entry, statement) => `x+=${statement + index * 10000};`).join('');
        const source = `int main(){long long x=0;${statements}cout<<x;}`;
        assert.ok(Buffer.byteLength(source) <= 65536);
        return { rid: String(index), pid: Math.floor(index / 20), code: source };
    });
    let ticks = 0;
    let finalProgress: { completedPairs: number, totalPairs: number } | undefined;
    const interval = setInterval(() => { ticks++; }, 25);
    const started = performance.now();
    try {
        const result = await runPlagiarismComparisons(sources, new AbortController().signal, (progress) => { finalProgress = progress; });
        assert.equal(result.prepared.length, 80);
        assert.equal(result.skipped.length, 0);
        assert.equal(result.pairs.length, 760);
        assert.deepEqual(finalProgress, { completedPairs: 760, totalPairs: 760 });
        assert.ok(ticks >= 2);
        assert.ok(performance.now() - started < 300000);
    } finally {
        clearInterval(interval);
    }
});
