import remarkLatex, { parseLatexText } from './remark-latex';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';
import { describe, expect, it } from 'vitest';

const parser = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkLatex)
  .freeze();

function formulas(source: string) {
  const result: string[] = [];
  visit(parser.parse(source), 'latex', (node) => {
    result.push(node.value);
  });
  return result;
}

describe('LaTeX syntax', () => {
  it.each([
    String.raw`a \\ b`,
    String.raw`a \cr b`,
    String.raw`a \\\\ b`,
    String.raw`a\\\%b`,
    String.raw`\frac{a}{b}`,
    String.raw`a*b + a~b~c + x_i + a<b>c`,
    String.raw`a\*b + x\_i + a\<b`,
    String.raw`\text{<script>alert(1)</script>}`,
    String.raw`\text{cost $5} + \{x\}`,
    'a\\\nb',
  ])('preserves TeX verbatim: %s', (value) => {
    expect(formulas(`$${value}$`)).toEqual([value]);
    expect(formulas(`$$${value}$$`)).toEqual([value]);
    expect(formulas(`\\(${value}\\)`)).toEqual([value]);
  });

  it('keeps complete multiline formulas opaque to Markdown block syntax', () => {
    const value = '\na\n=\nb\n\n+c\n';
    expect(formulas(`$$${value}$$`)).toEqual([value]);
    expect(parser.parse(`$$${value}$$`).children).toHaveLength(1);
    expect(formulas('$$a\n=\nb$$')).toEqual(['a\n=\nb']);
  });

  it('supports formulas inside quotes, lists, tables, and emphasis', () => {
    expect(
      formulas('> $x$\n\n- \\(y\\)\n\n| value |\n| --- |\n| $z$ |\n\n**$w$**')
    ).toEqual(['x', 'y', 'z', 'w']);
    expect(formulas('> $$\n> a\n> =\n> b\n> $$')).toEqual(['\na\n=\nb\n']);
  });

  it.each([
    String.raw`$x`,
    String.raw`$$x`,
    String.raw`\(x and f(x)`,
    String.raw`\$x\$`,
    String.raw`\$$x\$$`,
    '`$a \\\\ b$`',
    '``$x$ ` $y$``',
    '    $x$',
    '\t$x$',
    '```latex\n$x$\n```',
    '~~~latex\n$x$\n~~~',
    '```text\n~~~\n$x$\n```',
    '````markdown\n```latex\n$x$\n```\n````',
  ])(
    'keeps unmatched delimiters, escaped delimiters, and code literal: %s',
    (source) => {
      expect(formulas(source)).toEqual([]);
    }
  );

  it('does not consume headings after an unterminated display formula', () => {
    const tree = parser.parse('$$\nnever closed\n\n# Still a heading');
    expect(formulas('$$\nnever closed\n\n# Still a heading')).toEqual([]);
    expect(tree.children.at(-1)).toMatchObject({ type: 'heading', depth: 1 });
  });

  it('recognizes formulas between escaped backticks', () => {
    expect(formulas('\\`$x$\\`')).toEqual(['x']);
  });

  it.each([
    '$x$$y$',
    '$$x$$$$y$$',
    '$x$$$y$$',
    '$$x$$$y$',
    String.raw`\(x\)\(y\)`,
  ])(
    'recognizes adjacent formulas without separating whitespace: %s',
    (source) => {
      expect(formulas(source)).toEqual(['x', 'y']);
    }
  );

  it('keeps Markdown links, images, entities, and container markers inside TeX literal', () => {
    const value =
      '\\text{[link](https://example.com) ![image](x) &amp;\n:::info\n:::\n}';
    const tree = parser.parse(`Before $${value}$ after`);
    expect(formulas(`Before $${value}$ after`)).toEqual([value]);
    expect(tree.children[0]).toMatchObject({
      type: 'paragraph',
      children: [
        { type: 'text', value: 'Before ' },
        { type: 'latex', value },
        { type: 'text', value: ' after' },
      ],
    });
  });

  it('resumes Markdown parsing immediately after each formula', () => {
    const tree = parser.parse('$x$**bold** and \\(y\\)[link](/page)');
    expect(formulas('$x$**bold** and \\(y\\)[link](/page)')).toEqual([
      'x',
      'y',
    ]);
    expect(tree.children[0]).toMatchObject({
      type: 'paragraph',
      children: [
        { type: 'latex', value: 'x' },
        { type: 'strong', children: [{ type: 'text', value: 'bold' }] },
        { type: 'text', value: ' and ' },
        { type: 'latex', value: 'y' },
        { type: 'link', url: '/page' },
      ],
    });
  });

  it.each(['\n', '\r\n', '\r'])(
    'preserves multiline TeX with %j line endings and closing whitespace',
    (ending) => {
      const value = `${ending}a \\\\${ending}b${ending}`;
      expect(formulas(`$$${value}$$ \t`)).toEqual([value]);
    }
  );

  it('finds formulas after an unmatched opening without swallowing later blocks', () => {
    expect(formulas('Unclosed \\(x\n\n# Heading $y$\n\n$$z$$')).toEqual([
      'y',
      'z',
    ]);
    expect(
      parser.parse('Unclosed \\(x\n\n# Heading $y$').children[1]
    ).toMatchObject({
      type: 'heading',
      depth: 1,
    });
  });
});

describe('parseLatexText', () => {
  it('reports exact source spans for adjacent formulas surrounded by literal text', () => {
    const source = String.raw`Before $x_1$$y^2$ / \(z\) / $$w$$ after`;
    const parsed = parseLatexText(source);
    expect(parsed.map((node) => node.value)).toEqual(['x_1', 'y^2', 'z', 'w']);
    expect(
      parsed.map((node) =>
        source.slice(node.position?.start.offset, node.position?.end.offset)
      )
    ).toEqual(['$x_1$', '$y^2$', String.raw`\(z\)`, '$$w$$']);
  });

  it('preserves unmatched and escaped delimiters alongside valid formulas', () => {
    const parsed = parseLatexText(String.raw`\$literal\$ / $x$ / \(unclosed`);
    expect(parsed.map((node) => node.value)).toEqual(['x']);
  });
});
