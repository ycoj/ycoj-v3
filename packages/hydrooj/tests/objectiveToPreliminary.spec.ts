import assert from 'assert';
import { describe, it } from 'node:test';
import { ValidationError } from '../src/error';
import { objectiveConfig, objectiveToPreliminary } from '../src/lib/objectiveToPreliminary';

const statement = '# 单选题\n\n1. 哪个正确？ {{ select(1) }}\n\n- **A**\n- $B$\n\n2. 判断 {{ select(2-1) }}\n\n- 正确\n- 错误';
const config = { type: 'objective', answers: { 1: ['B', 2], '2-1': ['A', 1.5] } };

describe('objective to preliminary conversion', () => {
    it('preserves question order, Markdown options, answers and half-point scores', () => {
        const definition = objectiveToPreliminary('CSP-J', statement, config);
        assert.equal(definition.title, 'CSP-J');
        const questions = definition.sections[0].questions;
        assert.deepEqual(questions.map((q) => [q.id, q.answer, q.score]), [['q-1', 'B', 2], ['q-2-1', 'A', 1.5]]);
        assert.match(questions[0].prompt, /哪个正确/);
        assert.match(questions[1].prompt, /判断/);
        assert.equal(questions[0].type, 'choice');
        if (questions[0].type === 'choice') assert.equal(questions[0].options[0].text, '**A**');
        assert.doesNotMatch(JSON.stringify(definition), /\{\{ select/);
    });

    it('reads YAML configuration and maps dropdown values to option IDs', () => {
        const definition = objectiveToPreliminary('下拉题', '选择 {{ dropdown(1)[是,否] }}', 'type: objective\nanswers:\n  1: [否, 2]');
        assert.equal(definition.sections[0].questions[0].answer, 'B');
        assert.deepEqual(objectiveConfig('['), {});
    });

    it('keeps shared program passages, multiline options and trailing content', () => {
        const content = '```cpp\n{{ input(99) }}\n```\n\n题目 {{ select(1) }}\n\n- 第一行\n  第二行\n- 另一个选项\n\n结束说明';
        const result = objectiveToPreliminary('阅读程序', content, { type: 'objective', answers: { 1: ['A', 2] } });
        const question = result.sections[0].questions[0];
        assert.match(question.prompt, /```cpp\n\{\{ input\(99\) \}\}/);
        assert.match(question.prompt, /结束说明/);
        if (question.type === 'choice') assert.equal(question.options[0].text, '第一行\n第二行');
    });

    it('preserves inline code examples without treating them as answer controls', () => {
        const result = objectiveToPreliminary('Test', '`{{ input(9) }}` 示例\n题目 {{ select(1) }}\n- A\n- B', {
            type: 'objective', answers: { 1: ['A', 2] },
        });
        assert.match(result.sections[0].questions[0].prompt, /`\{\{ input\(9\) \}\}`/);
    });

    for (const [name, content, answers] of [
        ['multiple choice', '{{ multiselect(1) }}\n- A\n- B', { 1: [['A'], 2] }],
        ['text input', '{{ input(1) }}', { 1: ['text', 2] }],
        ['missing options', '{{ select(1) }}', { 1: ['A', 2] }],
        ['missing answer', '{{ select(1) }}\n- A\n- B', {}],
        ['invalid answer', '{{ select(1) }}\n- A\n- B', { 1: ['C', 2] }],
        ['invalid score', '{{ select(1) }}\n- A\n- B', { 1: ['A', 0.3] }],
        ['unmatched answers', '{{ select(1) }}\n- A\n- B', { 1: ['A', 2], 2: ['B', 2] }],
        ['alternative scores', '{{ select(1) }}\n- A\n- B', { 1: { A: 2, B: 1 } }],
        ['duplicate IDs', '{{ select(1) }}\n- A\n- B\n\n{{ select(1) }}\n- A\n- B', { 1: ['A', 2] }],
    ] as const) {
        it(`rejects ${name} without silently losing grading data`, () => {
            assert.throws(() => objectiveToPreliminary('Test', content, { type: 'objective', answers }), ValidationError);
        });
    }
});
