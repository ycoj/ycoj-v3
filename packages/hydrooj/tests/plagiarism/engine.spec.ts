import assert from 'assert';
import { performance } from 'perf_hooks';
import { describe, it } from 'node:test';
import {
    compareCpp, MAX_SOURCE_BYTES, MAX_TOKENS, PlagiarismLimitError, prepareCpp,
} from '../../src/lib/plagiarism';

const core = `
    long long answer = 0;
    for (int i = 0; i < n; i++) {
        long long prefix = 0;
        for (int j = i; j < n; j++) {
            prefix += a[j];
            if (prefix % 3 == 0) answer += j - i + 1;
        }
    }
`;
const input = 'int n; cin >> n; vector<int> a(n); for (int k = 0; k < n; k++) cin >> a[k];';
const original = `#include <bits/stdc++.h>
using namespace std;
int main() {
    ${input}
    ${core}
    cout << answer << endl;
    return 0;
}`;

function similarity(left: string, right: string) {
    return compareCpp(prepareCpp(left), prepareCpp(right));
}

describe('C++ plagiarism evidence', () => {
    it('detects exact copying and consistent identifier renaming without executing the programs', () => {
        const renamed = original.replace(/\bn\b/g, 'length').replace(/\ba\b/g, 'values')
            .replace(/\bi\b/g, 'first').replace(/\bj\b/g, 'last').replace(/\banswer\b/g, 'total');
        assert.equal(similarity(original, original).similarity, 100);
        assert.equal(similarity(original, renamed).similarity, 100);
    });

    it('normalizes common library names when they are declared as variables, in either direction', () => {
        const squares = `#include <iostream>
using namespace std;
long long solve(int n) {
    long long total = 0;
    for(int i = 0; i < n; i++) {
        long long value = 1LL * i * i;
        total += value;
    }
    return total;
}
int main() {
    int n;
    cin >> n;
    cout << solve(n) << endl;
    return 0;
}`;
        for (const name of ['count', 'min', 'max', 'size', 'array']) {
            const renamed = squares.replace(/\bn\b/g, name).replace(/\bi\b/g, 'index')
                .replace(/\btotal\b/g, 'sum').replace(/\bvalue\b/g, 'entry');
            assert.equal(similarity(squares, renamed).similarity, 100, name);
            assert.equal(similarity(renamed, squares).similarity, 100, name);
        }
        const allNames = squares.replace(/\bn\b/g, 'count').replace(/\bi\b/g, 'min')
            .replace(/\btotal\b/g, 'max').replace(/\bvalue\b/g, 'array');
        assert.equal(similarity(squares, allNames).similarity, 100);
    });

    it('normalizes library-named helpers and declarators after nested template types', () => {
        const custom = 'long long compute(int a,int b){long long result=a*a+b*b;return result;}';
        const helperProgram = `${custom} int main(){int x,y;cin>>x>>y;cout<<compute(x,y);return 0;}`;
        assert.equal(similarity(helperProgram, helperProgram.replace(/\bcompute\b/g, 'count')).similarity, 100);
        const templated = `int main(){vector<vector<int>> values(2,vector<int>(3));
            values[0][1]=17;values[1][2]=values[0][1]*3;cout<<values[1][2];return 0;}`;
        assert.equal(similarity(templated, templated.replace(/\bvalues\b/g, 'array')).similarity, 100);
    });

    it('prepares repetitive comparisons without treating greater-than operators as unbounded template scans', () => {
        const source = `int main(){int count;int x;cin>>x>>count;${'if(x > count) x += 1;'.repeat(2000)}cout<<x;return 0;}`;
        const started = performance.now();
        const analyzed = prepareCpp(source);
        assert(performance.now() - started < 2000);
        const renamed = prepareCpp(source.replace(/\bcount\b/g, 'threshold'));
        assert.equal(compareCpp(analyzed, renamed).similarity, 100);
    });

    it('keeps explicitly qualified standard operations distinct even when names are shadowed elsewhere', () => {
        const operation = (name: string) => `int main(){int count=3;vector<int> values(20);
            for(int i=0;i<20;i++) values[i]=i%count;
            auto answer=std::${name}(values.begin(),values.end(),3);cout<<answer;return 0;}`;
        const counted = prepareCpp(operation('count'));
        for (const operationName of ['sort', 'min', 'max']) {
            const different = compareCpp(counted, prepareCpp(operation(operationName)));
            assert(different.similarity < 100, operationName);
        }
        const minMax = 'int main(){int a,b;cin>>a>>b;for(int i=0;i<20;i++)a+=std::min(a,b);cout<<a;return 0;}';
        assert(similarity(minMax, minMax.replace('std::min', 'std::max')).similarity < 100);
    });

    it('ignores comments and unused constant scalar declarations inserted inside the core', () => {
        const padded = original.replace('prefix += a[j];', '// explanation\n int distraction = 123;\n prefix += a[j];')
            .replace('long long answer = 0;', '/* arbitrary comments */\n const int unused = -123;\n long long answer = 0;');
        const result = similarity(original, padded);
        assert.equal(result.similarity, 100);
        assert(result.warnings.includes('unused-scalar-ignored'));
    });

    it('finds the unchanged algorithm after helper extraction and renamed arguments', () => {
        const helper = core.replace(/\bn\b/g, 'length').replace(/\ba\b/g, 'values')
            .replace(/\bi\b/g, 'start').replace(/\bj\b/g, 'finish').replace(/\banswer\b/g, 'result');
        const extracted = `#include <bits/stdc++.h>
using namespace std;
long long calculate(vector<int>& values, int length) { ${helper} return result; }
int main() { ${input} cout << calculate(a, n) << endl; return 0; }`;
        const result = similarity(original, extracted);
        assert(result.similarity >= 70, JSON.stringify(result));
        assert(result.matches.some((match) => match.tokenCount >= 40));
    });

    it('recognizes independent core blocks moved into a different order', () => {
        const sum = 'long long sum = 0; for(int i = 0; i < n; i++) { sum += a[i] * (i + 1); }';
        const maximum = 'int largest = -100000; for(int j = 0; j < n; j++) { if(a[j] > largest) largest = a[j]; }';
        const first = `int main(){${input} ${sum} ${maximum} cout << sum << largest; return 0;}`;
        const second = `int main(){${input} ${maximum} ${sum} cout << sum << largest; return 0;}`;
        const result = similarity(first, second);
        assert(result.similarity >= 80, JSON.stringify(result));
        assert.equal(result.scores.structure, 100);
        assert(result.matches.some((match) => match.tokenCount >= 16));
    });

    it('retains useful evidence when for loops are rewritten as while loops', () => {
        const rewrittenCore = core.replace('for (int i = 0; i < n; i++) {', 'int i = 0; while (i < n) {')
            .replace('for (int j = i; j < n; j++) {', 'int j = i; while (j < n) {')
            .replace('answer += j - i + 1;', 'answer += j - i + 1; j++;')
            .replace('        }\n    }', '        }\n        i++;\n    }');
        const rewritten = original.replace(core, rewrittenCore);
        const result = similarity(original, rewritten);
        assert(result.similarity >= 50, JSON.stringify(result));
        assert(result.matches.length > 0);
    });

    it('does not mistake shared headers and input boilerplate for a copied solution', () => {
        const unrelated = `#include <bits/stdc++.h>
using namespace std;
int main() { ${input}
    sort(a.begin(), a.end());
    int result = 1000000000;
    for(int p = 1; p < n; p++) result = min(result, a[p] - a[p - 1]);
    cout << result << endl; return 0;
}`;
        assert(similarity(original, unrelated).similarity < 65);
        assert(similarity('#include <iostream>\nusing namespace std;', '#include <vector>\nusing namespace std;').similarity === 0);
        const short = similarity('int main(){return 0;}', 'int main(){return 0;}');
        assert(short.similarity <= 55);
        assert(short.warnings.includes('short-source'));
    });

    it('preserves identifier equality, operators, library calls, and literal values', () => {
        const relations = (expression: string) => `int main(){ int a,b; cin>>a>>b;
            while(a < 987654) { ${expression} a += b; b += a; if (a % 17 == 3) b ^= a; } cout << b; }`;
        const differentRelations = similarity(relations('a = a + b;'), relations('a = a + a;'));
        assert(differentRelations.similarity < 90, JSON.stringify(differentRelations));
        const changed = original.replace('% 3 == 0', '% 7 != 0').replace('j - i + 1', 'j * i + 2');
        assert(similarity(original, changed).similarity < 90);
        assert(similarity(original, original.replace('cin', 'printf')).similarity < 100);
    });

    it('keeps string contents distinct from comments and maps evidence to original source lines', () => {
        const quoted = original.replace('cout << answer', 'cout << R"tag(/* literal */ // literal)tag" << answer');
        assert(similarity(quoted, quoted.replace('/* literal */', 'other content')).similarity < 100);
        const renamedWithLines = `// comment\n\n${original.replace('prefix +=', 'pre\\\nfix +=')}`;
        const result = similarity(original, renamedWithLines);
        assert.equal(result.similarity, 100);
        assert.equal(result.matches[0].leftStartLine, 3);
        assert.equal(result.matches[0].rightStartLine, 5);
        assert(result.matches[0].rightEndLine > result.matches[0].leftEndLine);
    });

    it('warns explicitly about preprocessing and incomplete lexical input', () => {
        assert(prepareCpp('#define LOOP for\nint main(){return 0;}').warnings.includes('preprocessor-not-expanded'));
        assert(prepareCpp('int main(){ /* unfinished').warnings.includes('incomplete-comment'));
    });

    it('rejects bounded-input and elapsed-deadline violations without reporting truncated scores', () => {
        assert.throws(() => prepareCpp(' '.repeat(MAX_SOURCE_BYTES + 1)), (error: unknown) => (
            error instanceof PlagiarismLimitError && error.code === 'source-too-large'
        ));
        assert.throws(() => prepareCpp(';'.repeat(MAX_TOKENS + 1)), (error: unknown) => (
            error instanceof PlagiarismLimitError && error.code === 'too-many-tokens'
        ));
        const prepared = prepareCpp(original);
        assert.throws(() => prepareCpp(original, { deadline: Date.now() - 1 }), (error: unknown) => (
            error instanceof PlagiarismLimitError && error.code === 'deadline-exceeded'
        ));
        assert.throws(() => compareCpp(prepared, prepared, { deadline: Date.now() - 1 }), (error: unknown) => (
            error instanceof PlagiarismLimitError && error.code === 'deadline-exceeded'
        ));
    });

    it('compares pathological repeated tokens within the per-pair limit', () => {
        const left = prepareCpp(`int main(){int x=0;${'x += x + 1;'.repeat(3000)} cout<<x;}`);
        const right = prepareCpp(`int main(){int y=0;${'y += y + 1;'.repeat(2999)} y-=2;cout<<y;}`);
        const start = performance.now();
        const result = compareCpp(left, right);
        assert(result.similarity > 95);
        assert(performance.now() - start < 2000);
    });

    it('finishes all 760 representative comparisons of a 20-participant four-problem event', () => {
        const start = performance.now();
        let maximum = 0;
        let comparisons = 0;
        for (let problem = 0; problem < 4; problem++) {
            const programs = Array.from({ length: 20 }, (_, participant) => prepareCpp(original
                .replace('% 3 == 0', `% ${3 + problem} == ${participant % 3}`)
                .replace(/\banswer\b/g, `result${participant}`)
                .replace('cout << answer', `int padding${participant} = ${participant}; cout << answer`)));
            for (let i = 0; i < programs.length; i++) {
                for (let j = i + 1; j < programs.length; j++) {
                    const pairStart = performance.now();
                    compareCpp(programs[i], programs[j]);
                    maximum = Math.max(maximum, performance.now() - pairStart);
                    comparisons++;
                }
            }
        }
        assert.equal(comparisons, 760);
        assert(maximum < 2000);
        assert(performance.now() - start < 5 * 60 * 1000);
    });
});
