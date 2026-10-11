import assert from 'assert';
import os from 'os';
import { performance } from 'perf_hooks';
import { compareCpp, MAX_SOURCE_BYTES, prepareCpp } from './index';

interface Measurement { name: string, pairs: number, elapsedMs: number, slowestPairMs: number, peakHeapMiB: number }

function runEvent(name: string, program: (problem: number, participant: number) => string): Measurement {
    const start = performance.now();
    let slowestPairMs = 0;
    let pairs = 0;
    let peakHeapMiB = 0;
    for (let problem = 0; problem < 4; problem++) {
        const submissions = Array.from({ length: 20 }, (_, participant) => prepareCpp(program(problem, participant)));
        for (let left = 0; left < submissions.length; left++) {
            for (let right = left + 1; right < submissions.length; right++) {
                const pairStart = performance.now();
                compareCpp(submissions[left], submissions[right]);
                slowestPairMs = Math.max(slowestPairMs, performance.now() - pairStart);
                pairs++;
            }
        }
        peakHeapMiB = Math.max(peakHeapMiB, process.memoryUsage().heapUsed / 1024 / 1024);
    }
    const elapsedMs = performance.now() - start;
    assert.equal(pairs, 760);
    assert(slowestPairMs < 2000);
    assert(elapsedMs < 300000);
    return { name, pairs, elapsedMs, slowestPairMs, peakHeapMiB };
}

function typicalProgram(problem: number, participant: number) {
    return `#include <bits/stdc++.h>
using namespace std;
int main() {
    int n; cin >> n; vector<int> values(n);
    for(int position = 0; position < n; position++) cin >> values[position];
    long long result${participant} = 0;
    for(int first = 0; first < n; first++) {
        long long prefix = 0;
        for(int last = first; last < n; last++) {
            prefix += values[last];
            if(prefix % ${3 + problem} == ${participant % 3}) result${participant} += last - first + 1;
        }
    }
    cout << result${participant} << endl; return 0;
}`;
}

function longProgram(problem: number, participant: number) {
    let source = 'int main(){long long value=0;';
    for (let i = 0; i < 3500; i++) source += `value+=${i + problem * 100000 + participant * 10000};`;
    source += 'cout<<value;}';
    assert(Buffer.byteLength(source) <= Math.min(MAX_SOURCE_BYTES, 64 * 1024));
    return source;
}

const measurements = [runEvent('Typical contest solutions', typicalProgram), runEvent('Long unique-token sources (up to 64 KiB each)', longProgram)];
const repeatedLeft = prepareCpp(`int main(){int x=0;${'x += x + 1;'.repeat(3000)}cout<<x;}`);
const repeatedRight = prepareCpp(`int main(){int y=0;${'y += y + 1;'.repeat(2999)}y-=2;cout<<y;}`);
const repeatStart = performance.now();
compareCpp(repeatedLeft, repeatedRight);
const repeatedPairMs = performance.now() - repeatStart;
assert(repeatedPairMs < 2000);
console.log(JSON.stringify({
    engine: 'cpp-lexical-v1',
    node: process.version,
    platform: `${os.platform()} ${os.arch()}`,
    cpu: os.cpus()[0]?.model,
    measurements,
    repeatedPairMs,
}, null, 2));
