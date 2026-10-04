import remarkProblemSamples from './remark-problem-samples';
import type { Root } from 'mdast';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';
import { describe, expect, it } from 'vitest';

function samples(source: string) {
  const processor = unified().use(remarkParse).use(remarkProblemSamples);
  const tree = processor.runSync(processor.parse(source)) as Root;
  const result: { index: string; input: string; output: string }[] = [];
  visit(tree, (node) => {
    if (node.data?.hName !== 'samples') return;
    const props = node.data.hProperties;
    result.push({
      index: String(props?.['data-index']),
      input: decodeURIComponent(String(props?.['data-input'])),
      output: decodeURIComponent(String(props?.['data-output'])),
    });
  });
  return result;
}

function fence(language: string, value: string) {
  return `\`\`\`${language}\n${value}\n\`\`\``;
}

describe('remarkProblemSamples', () => {
  it.each([
    ['input1', 'output1', '3', '6'],
    ['output1', 'input1', '6', '3'],
    ['INPUT1', 'OUTPUT1', '3', '6'],
    ['input01', 'output1', '3', '6'],
  ])(
    'pairs %s and %s with the correct input/output direction',
    (first, second, left, right) => {
      expect(
        samples(`${fence(first, left)}\n\n${fence(second, right)}`)
      ).toEqual([{ index: '1', input: '3', output: '6' }]);
    }
  );

  it.each([
    ['input1', 'output2'],
    ['input1', 'input1'],
    ['output1', 'output1'],
    ['input', 'output'],
    ['input-1', 'output-1'],
    ['cpp', 'output1'],
  ])(
    'keeps incompatible %s and %s fences as ordinary code',
    (first, second) => {
      expect(samples(`${fence(first, '3')}\n\n${fence(second, '6')}`)).toEqual(
        []
      );
    }
  );

  it('preserves consecutive sample pairs without skipping the next pair', () => {
    const source = [
      fence('input1', 'a'),
      fence('output1', 'b'),
      fence('input2', 'c'),
      fence('output2', 'd'),
    ].join('\n\n');
    expect(samples(source)).toEqual([
      { index: '1', input: 'a', output: 'b' },
      { index: '2', input: 'c', output: 'd' },
    ]);
  });

  it('preserves whitespace, Unicode, delimiters, and HTML-like payloads verbatim', () => {
    const input = '\t$x$ <img src=x> & 50% 中文\n\n  last  ';
    const output = String.raw`\(x\) \cr "result"`;
    expect(
      samples(`${fence('input3', input)}\n\n${fence('output3', output)}`)
    ).toEqual([{ index: '3', input, output }]);
  });

  it('preserves an empty side of a sample pair', () => {
    expect(
      samples(`${fence('input1', '')}\n\n${fence('output1', '0')}`)
    ).toEqual([{ index: '1', input: '', output: '0' }]);
  });

  it('does not pair fences separated by visible prose', () => {
    expect(
      samples(
        `${fence('input1', '3')}\n\nExplanation\n\n${fence('output1', '6')}`
      )
    ).toEqual([]);
  });

  it('pairs samples within a blockquote', () => {
    const source = `${fence('input1', '3')}\n\n${fence('output1', '6')}`;
    expect(
      samples(
        source
          .split('\n')
          .map((line) => `> ${line}`)
          .join('\n')
      )
    ).toEqual([{ index: '1', input: '3', output: '6' }]);
  });

  it('does not pair fences from separate blockquotes', () => {
    const quote = (source: string) =>
      source
        .split('\n')
        .map((line) => `> ${line}`)
        .join('\n');
    expect(
      samples(
        `${quote(fence('input1', '3'))}\n\nBetween\n\n${quote(fence('output1', '6'))}`
      )
    ).toEqual([]);
  });
});
