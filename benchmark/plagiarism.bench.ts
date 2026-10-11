import { bench, describe } from 'vitest';
import { compareCpp, MAX_SOURCE_BYTES, prepareCpp } from '../packages/hydrooj/src/lib/plagiarism';

// An accepted solution written the way contestants usually structure a contest submission.
function solution(problem: number, participant: number) {
    return `#include <bits/stdc++.h>
using namespace std;
int main() {
    int n; cin >> n; vector<int> values(n);
    for (int position = 0; position < n; position++) cin >> values[position];
    long long result${participant} = 0;
    for (int first = 0; first < n; first++) {
        long long prefix = 0;
        for (int last = first; last < n; last++) {
            prefix += values[last];
            if (prefix % ${3 + problem} == ${participant % 3}) result${participant} += last - first + 1;
        }
    }
    cout << result${participant} << endl;
    return 0;
}`;
}

// A problem holds at most 20 representatives, so every event compares the same 4 x 20 shape.
const event = Array.from({ length: 4 }, (_, problem) => (
    Array.from({ length: 20 }, (_, participant) => prepareCpp(solution(problem, participant)))
));

// A near-copy with a changed constant and operator, so it cannot take the canonical fast path.
const modified = prepareCpp(solution(0, 0).replace('% 3 == 0', '% 7 != 0'));

const unrelated = prepareCpp(`#include <bits/stdc++.h>
using namespace std;
int main() {
    int n; cin >> n; vector<int> a(n);
    for (int i = 0; i < n; i++) cin >> a[i];
    sort(a.begin(), a.end());
    int result = 1000000000;
    for (int p = 1; p < n; p++) result = min(result, a[p] - a[p - 1]);
    cout << result << endl;
    return 0;
}`);

// Long sources with few repeated features stress the size of every prepared feature bag.
function longSource() {
    let source = 'int main(){long long value=0;';
    for (let i = 0; i < 3500; i++) source += `value+=${i + 100000};`;
    source += 'cout<<value;}';
    if (Buffer.byteLength(source) > Math.min(MAX_SOURCE_BYTES, 64 * 1024)) throw new Error('long source exceeded the intended size');
    return source;
}

// Repetitive tokens maximize fingerprint occurrences without creating a quadratic cross-product.
const repetitiveLeft = prepareCpp(`int main(){int x=0;${'x += x + 1;'.repeat(3000)}cout<<x;}`);
const repetitiveRight = prepareCpp(`int main(){int y=0;${'y += y + 1;'.repeat(2999)}y-=2;cout<<y;}`);

describe('hydrooj/plagiarism', () => {
    bench('prepareCpp typical solution', () => {
        prepareCpp(solution(0, 0));
    });

    bench('prepareCpp 64 KiB unique-token source', () => {
        prepareCpp(longSource());
    });

    bench('prepareCpp repetitive source', () => {
        prepareCpp(`int main(){int x=0;${'x += x + 1;'.repeat(3000)}cout<<x;}`);
    });

    bench('compareCpp identical submissions', () => {
        compareCpp(event[0][0], event[0][0]);
    });

    bench('compareCpp near copy with changed constant', () => {
        compareCpp(event[0][0], modified);
    });

    bench('compareCpp unrelated algorithms', () => {
        compareCpp(event[0][0], unrelated);
    });

    bench('compareCpp pathological repeated tokens', () => {
        compareCpp(repetitiveLeft, repetitiveRight);
    });

    bench('compareCpp 20-participant four-problem event (760 pairs)', () => {
        for (const submissions of event) {
            for (let left = 0; left < submissions.length; left++) {
                for (let right = left + 1; right < submissions.length; right++) {
                    compareCpp(submissions[left], submissions[right]);
                }
            }
        }
    });
});
