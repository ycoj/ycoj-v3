import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compareCpp, MAX_SOURCE_BYTES, MAX_TOKENS, PlagiarismLimitError } from '../../src/lib/plagiarism/engine';
import { prepareTreeSitterCpp } from '../../src/lib/plagiarism/tree-sitter';

const source = `#include <iostream>
using namespace std;
int main() {
    int n; cin >> n;
    long long total = 0;
    for (int i = 0; i < n; ++i) {
        long long value = i * i;
        total += value;
    }
    cout << total << "// literal, not a comment";
    return 0;
}`;

test('syntax parsing preserves renaming, comments, raw literals, and original evidence lines', () => {
    const renamed = source.replace(/\bn\b/g, 'count').replace(/\bi\b/g, 'index').replace(/\btotal\b/g, 'max')
        .replace('int main()', '// extra line\nint main()');
    const result = compareCpp(prepareTreeSitterCpp(source), prepareTreeSitterCpp(renamed));
    assert.equal(result.similarity, 100);
    assert.deepEqual(result.matches, [{ leftStartLine: 3, leftEndLine: 12, rightStartLine: 4, rightEndLine: 13, tokenCount: 56 }]);
    const raw = source.replace('"// literal, not a comment"', 'R"tag(/* raw string */)tag"');
    assert.equal(prepareTreeSitterCpp(raw).tokenCount, prepareTreeSitterCpp(source).tokenCount);
    assert.ok(compareCpp(prepareTreeSitterCpp(source), prepareTreeSitterCpp(raw)).similarity < 100);
});

test('AST declarators normalize helpers and nested-template variables with familiar library names', () => {
    const program = `int compute(int x){return x*x;} int main(){vector<vector<int>> values(2,vector<int>(3));
        values[0][1]=compute(17);values[1][2]=values[0][1]*3;cout<<values[1][2];return 0;}`;
    const renamed = program.replaceAll('compute', 'count').replaceAll('values', 'array');
    assert.equal(compareCpp(prepareTreeSitterCpp(program), prepareTreeSitterCpp(renamed)).similarity, 100);
});

test('operators, repeated identifier relationships, literals and standard calls remain significant', () => {
    const program = `${source}\nint solve(int a,int b){return std::min(a,b)+a;}`;
    for (const changed of [
        program.replace('std::min', 'std::max'), program.replace('i * i', 'i + i'),
        program.replace('return 0', 'return 1'), program.replace('min(a,b)+a', 'min(a,b)+b'),
        program.replace('cout', 'cerr'),
    ]) {
        assert.ok(compareCpp(prepareTreeSitterCpp(program), prepareTreeSitterCpp(changed)).similarity < 100);
    }
});

test('the C++ grammar recognizes signed exponent literals as one token', () => {
    const parsed = prepareTreeSitterCpp('int main(){double small=1e-3; double large=1e+3; return 0;}');
    assert.ok(parsed.tokens.some((token) => token.value === 'number:1e-3'));
    assert.ok(parsed.tokens.some((token) => token.value === 'number:1e+3'));
});

test('AST features distinguish syntax and retain moved statement evidence', () => {
    const statements = 'total += i * i; total *= 3; cout << total;';
    const left = prepareTreeSitterCpp(source.replace('total += value;', statements));
    const right = prepareTreeSitterCpp(source.replace('total += value;', 'cout << total; total *= 3; total += i * i;'));
    const result = compareCpp(left, right);
    assert.ok(result.scores.structure >= 70);
    assert.ok(result.matches.length > 0);
    const changed = prepareTreeSitterCpp(source.replace('total += value;', 'if (value) total += value;'));
    assert.notDeepEqual(changed.statements, prepareTreeSitterCpp(source).statements);
});

test('recovered syntax reports parse errors and unexpanded preprocessing explicitly', () => {
    const incomplete = prepareTreeSitterCpp(source.slice(0, -1));
    assert.ok(incomplete.warnings.includes('tree-sitter-parse-errors'));
    assert.ok(incomplete.tokenCount > 40);
    assert.ok(prepareTreeSitterCpp(`#define STEP 3\n${source}`).warnings.includes('preprocessor-not-expanded'));
    for (const input of ['', ' \n', '// only a comment']) assert.equal(prepareTreeSitterCpp(input).tokenCount, 0);
});

test('tree-sitter enforces source, token, and elapsed deadline limits', () => {
    for (const [input, options, code] of [
        ['x'.repeat(MAX_SOURCE_BYTES + 1), {}, 'source-too-large'],
        [`int main(){${'x++;'.repeat(MAX_TOKENS / 3 + 1)}}`, {}, 'too-many-tokens'],
        [source, { deadline: Date.now() - 1 }, 'deadline-exceeded'],
    ] as const) {
        assert.throws(() => prepareTreeSitterCpp(input, options), (error: unknown) => error instanceof PlagiarismLimitError && error.code === code);
    }
});
