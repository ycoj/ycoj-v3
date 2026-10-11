import { bench, describe } from 'vitest';
import { compareCpp, prepareCpp } from '../packages/hydrooj/src/lib/plagiarism';

// Keep CI fixtures small enough for CodSpeed simulation and the engine's real-time deadline.
// Full-size sources and the 760-pair event are covered by packages/hydrooj/src/lib/plagiarism/benchmark.ts.
const statementCount = 128;
const repeatedStatements = 128;

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

// Two problems with five representatives each exercise the event loop over 20 pairs.
const event = Array.from({ length: 2 }, (_, problem) => (
    Array.from({ length: 5 }, (_, participant) => prepareCpp(solution(problem, participant)))
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

// Distinct constants exercise feature bags without a full-size stress fixture.
function uniqueTokenSource() {
    let source = 'int main(){long long value=0;';
    for (let i = 0; i < statementCount; i++) source += `value+=${i + 100000};`;
    source += 'cout<<value;}';
    return source;
}

const uniqueSource = uniqueTokenSource();
const repetitiveSource = `int main(){int x=0;${'x += x + 1;'.repeat(repeatedStatements)}cout<<x;}`;

// Repetitive tokens maximize fingerprint occurrences without creating a quadratic cross-product.
const repetitiveLeft = prepareCpp(repetitiveSource);
const repetitiveRight = prepareCpp(`int main(){int y=0;${'y += y + 1;'.repeat(repeatedStatements - 1)}y-=2;cout<<y;}`);

describe('hydrooj/plagiarism', () => {
    bench('prepareCpp typical solution', () => {
        prepareCpp(solution(0, 0));
    });

    bench('prepareCpp unique-token source (128 statements)', () => {
        prepareCpp(uniqueSource);
    });

    bench('prepareCpp repetitive source (128 statements)', () => {
        prepareCpp(repetitiveSource);
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

    bench('compareCpp repeated tokens (128 statements)', () => {
        compareCpp(repetitiveLeft, repetitiveRight);
    });

    bench('compareCpp five-participant two-problem event (20 pairs)', () => {
        for (const submissions of event) {
            for (let left = 0; left < submissions.length; left++) {
                for (let right = left + 1; right < submissions.length; right++) {
                    compareCpp(submissions[left], submissions[right]);
                }
            }
        }
    });
});
