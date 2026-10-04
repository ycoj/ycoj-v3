import rehypeCodeBlocks from './rehype-code-blocks';
import type { Element, ElementContent, Root } from 'hast';
import { toHtml } from 'hast-util-to-html';
import { unified } from 'unified';
import { describe, expect, it } from 'vitest';

function codeBlock(language: string, value: string): Element {
  return {
    type: 'element',
    tagName: 'pre',
    properties: {},
    children: [
      {
        type: 'element',
        tagName: 'code',
        properties: language ? { className: [`language-${language}`] } : {},
        children: [{ type: 'text', value }],
      },
    ],
  };
}

function textOf(nodes: ElementContent[]): string {
  return nodes
    .map((node) =>
      node.type === 'text'
        ? node.value
        : node.type === 'element'
          ? textOf(node.children)
          : ''
    )
    .join('');
}

async function highlight(...blocks: Element[]) {
  const tree: Root = { type: 'root', children: blocks };
  await unified().use(rehypeCodeBlocks).run(tree);
  return blocks;
}

describe('rehypeCodeBlocks', () => {
  it.each([
    ['cpp', true, true],
    ['cpp|line-numbers', true, true],
    ['cpp|no-line-numbers', false, true],
    ['text', false, false],
    ['text|line-numbers', true, false],
    ['unknown-language', false, false],
    ['unknown-language|line-numbers', true, false],
    ['', false, false],
  ])(
    'applies numbering and highlighting independently for %j',
    async (language, numbered, highlighted) => {
      const block = codeBlock(language, 'int a;\nint b;\n');
      await highlight(block);
      const html = toHtml(block);
      expect(html.match(/class="code-line"/g) ?? []).toHaveLength(
        numbered ? 2 : 0
      );
      expect(html.includes('class="pl-k"')).toBe(highlighted);
      expect(html).not.toContain('|line-numbers');
      expect(html).not.toContain('|no-line-numbers');
      expect(textOf(block.children)).toBe('int a;\nint b;\n');
    }
  );

  it('preserves whitespace and multiline highlight tokens when numbering lines', async () => {
    const source = '/* first\n   second */\n\n\tint a = 1;  \n';
    const block = codeBlock('cpp', source);
    await highlight(block);
    const html = toHtml(block);
    expect(html.match(/class="code-line"/g)).toHaveLength(4);
    expect(html.match(/class="pl-c"/g)).toHaveLength(2);
    expect(textOf(block.children)).toBe(source);
  });

  it('keeps numbering choices local across mixed blocks and concurrent processors', async () => {
    const numbered = codeBlock('cpp', 'int a;\nint b;\n');
    const skipped = codeBlock('cpp|no-line-numbers', 'int c;\n');
    const plain = codeBlock('text|line-numbers', 'one\ntwo\n');
    await Promise.all([highlight(numbered, skipped), highlight(plain)]);
    expect(toHtml(numbered).match(/class="code-line"/g)).toHaveLength(2);
    expect(toHtml(skipped)).not.toContain('class="code-line"');
    expect(toHtml(skipped)).toContain('class="pl-k"');
    expect(toHtml(plain).match(/class="code-line"/g)).toHaveLength(2);
    expect(textOf(plain.children)).toBe('one\ntwo\n');
  });

  it('does not add line numbers to an empty block or inline code', async () => {
    const empty = codeBlock('cpp', '');
    const inline: Element = {
      type: 'element',
      tagName: 'code',
      properties: {},
      children: [{ type: 'text', value: '$x$' }],
    };
    await highlight(empty, inline);
    expect(toHtml(empty)).not.toContain('class="code-line"');
    expect(toHtml(inline)).toBe('<code>$x$</code>');
  });
});
