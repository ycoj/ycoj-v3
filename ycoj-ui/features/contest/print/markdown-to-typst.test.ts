import type { MarkdownToTypstOptions } from './markdown-to-typst';
import { markdownToTypst } from './markdown-to-typst';
import { compileMdast, type CompileContext } from './mdast-to-typst';
import type { Root } from 'mdast';
import { describe, expect, it } from 'vitest';

function options(
  files: Record<string, string> = {},
  problemId = 7
): MarkdownToTypstOptions {
  return {
    problemId,
    scope: { kind: 'problem', tid: '7', problemId },
    resolveFile: (name) => files[name] ?? null,
  };
}

function freshContext(problemId = 7): CompileContext {
  return {
    problemId,
    scope: { kind: 'problem', tid: '7', problemId },
    resolveFile: () => null,
    out: [],
    assets: [],
    diagnostics: [],
    definitions: new Map(),
    footnotes: new Map(),
    expandingFootnotes: new Set(),
    assetPaths: new Map(),
  };
}

describe('markdownToTypst', () => {
  it.each([
    ['Hello **world**', '#par[#"Hello "#strong[#"world"]]\n\n'],
    ['*a* ~~b~~', '#par[#emph[#"a"]#" "#strike[#"b"]]\n\n'],
    ['# Title', '#heading(level: 1, [#"Title"])\n\n'],
    ['### Sub', '#heading(level: 3, [#"Sub"])\n\n'],
    ['`x++`', '#par[#raw(block: false, lang: "txt", "x++")]\n\n'],
    ['```cpp\nint a;\n```', '#raw(block: true, lang: "cpp", "int a;")\n\n'],
    ['```py\nx = 1\n```', '#raw(block: true, lang: "python", "x = 1")\n\n'],
    [
      '```input1\n1 2\n```\n\n```output1\n3\n```',
      '#heading(level: 2, [#"样例输入 1"])\n#raw(block: true, lang: "txt", "1 2")\n#heading(level: 2, [#"样例输出 1"])\n#raw(block: true, lang: "txt", "3")\n\n',
    ],
    [
      '```input2\n4\n```',
      '#heading(level: 2, [#"样例输入 2"])\n#raw(block: true, lang: "txt", "4")\n\n',
    ],
    ['```unknownlang\nx\n```', '#raw(block: true, lang: "txt", "x")\n\n'],
    ['```\nx\n```', '#raw(block: true, lang: "txt", "x")\n\n'],
    ['- a\n- b', '#list(\n[#"a"],\n[#"b"],\n)\n\n'],
    ['3. x\n4. y', '#enum(start: 3,\n[#"x"],\n[#"y"],\n)\n\n'],
    [
      '- [x] done\n- [ ] todo',
      '#list(\n[#sym.ballot.x #" "#"done"],\n[#sym.ballot #" "#"todo"],\n)\n\n',
    ],
    ['> quoted', '#quote(block: true)[\n#par[#"quoted"]\n]\n\n'],
    ['a\n\n---\n\nb', '#par[#"a"]\n#print-rule()\n#par[#"b"]\n\n'],
    ['a  \nb', '#par[#"a"#linebreak()#"b"]\n\n'],
    [
      'inline $a+b$ math',
      '#par[#"inline "#print-math(block: false, "a+b")#" math"]\n\n',
    ],
    ['$$\nx+y\n$$', '#print-math(block: true, "x+y")\n\n'],
    [
      '| a | b |\n| :- | -: |\n| 1 | 2 |',
      '#figure(table(columns: 2, align: (left + horizon, right + horizon,),\n[#"a"],[#"b"],\n[#"1"],[#"2"],\n))\n\n',
    ],
    [
      '| a | b |\n| --- | --- |\n| 1 | 2 |',
      '#figure(table(columns: 2,\n[#"a"],[#"b"],\n[#"1"],[#"2"],\n))\n\n',
    ],
  ])('converts %j', (markdown, expected) => {
    const result = markdownToTypst(markdown, options());
    expect(result.typst).toBe(expected);
    expect(result.diagnostics).toEqual([]);
    expect(result.assets).toEqual([]);
  });

  it('escapes Typst string boundaries in text', () => {
    const { typst } = markdownToTypst('say "hi" \\ and\nnext line', options());
    expect(typst).toBe('#par[#"say \\"hi\\" \\\\ and\\nnext line"]\n\n');
  });

  it('emits links with sanitized schemes', () => {
    const ok = markdownToTypst('[site](https://e.com/a?b=1)', options());
    expect(ok.typst).toBe('#par[#link("https://e.com/a?b=1")[#"site"]]\n\n');
    expect(ok.diagnostics).toEqual([]);

    const relative = markdownToTypst('[rel](/path/to)', options());
    expect(relative.typst).toBe('#par[#link("/path/to")[#"rel"]]\n\n');
    expect(relative.diagnostics).toEqual([]);
  });

  it.each(['javascript:alert(1)', 'data:text/html;base64,AA', 'vbscript:x'])(
    'rejects %s link targets and renders children as text',
    (url) => {
      const { typst, diagnostics } = markdownToTypst(`[x](${url})`, options());
      expect(typst).toBe('#par[#"x"]\n\n');
      expect(diagnostics).toEqual([
        expect.objectContaining({
          severity: 'warning',
          code: 'unsupported-markdown',
          location: { problemId: 7, nodeType: 'link' },
        }),
      ]);
    }
  );

  it('collects resolved image assets with stable shadow names', () => {
    const files = { 'x.png': '/api/p/7/file/x.png?tid=7' };
    const { typst, assets, diagnostics } = markdownToTypst(
      '![alt](file://x.png)',
      options(files)
    );
    expect(typst).toBe(
      '#par[#box(image("asset-ef69e8b0.png", alt: "alt"))]\n\n'
    );
    expect(diagnostics).toEqual([]);
    expect(assets).toEqual([
      {
        uri: 'file://x.png',
        url: '/api/p/7/file/x.png?tid=7',
        scope: { kind: 'problem', tid: '7', problemId: 7 },
        path: 'asset-ef69e8b0.png',
      },
    ]);
  });

  it('deduplicates repeated references to the same image', () => {
    const files = { 'x.png': '/u/x.png' };
    const { typst, assets } = markdownToTypst(
      '![a](file://x.png) and ![b](file://x.png)',
      options(files)
    );
    expect(typst).toBe(
      '#par[#box(image("asset-ef69e8b0.png", alt: "a"))#" and "#box(image("asset-ef69e8b0.png", alt: "b"))]\n\n'
    );
    expect(assets).toHaveLength(1);
  });

  it('keeps equal attachment names distinct across problems and the contest', () => {
    const markdown = '![a](file://x.png)';
    const first = markdownToTypst(
      markdown,
      options({ 'x.png': '/p/7/x.png' }, 7)
    );
    const second = markdownToTypst(
      markdown,
      options({ 'x.png': '/p/8/x.png' }, 8)
    );
    const contest = markdownToTypst(markdown, {
      scope: { kind: 'contest', tid: '7' },
      resolveFile: () => '/contest/x.png',
    });
    expect(
      new Set([
        first.assets[0].path,
        second.assets[0].path,
        contest.assets[0].path,
      ]).size
    ).toBe(3);
  });

  it('collects remote images and data URIs as fetchable assets', () => {
    const { typst, assets } = markdownToTypst(
      '![p](https://e.com/a.png) ![d](data:image/png;base64,AA)',
      options()
    );
    expect(typst).toBe(
      '#par[#box(image("asset-196bb661.png", alt: "p"))#" "#box(image("asset-0388e0a4.png", alt: "d"))]\n\n'
    );
    expect(assets.map((a) => a.url)).toEqual([
      'https://e.com/a.png',
      'data:image/png;base64,AA',
    ]);
  });

  it('warns and falls back to alt text for unresolved file:// images', () => {
    const { typst, assets, diagnostics } = markdownToTypst(
      '![alt](file://missing.png)',
      options()
    );
    expect(typst).toBe('#par[#"[alt]"]\n\n');
    expect(assets).toEqual([
      expect.objectContaining({
        uri: 'file://missing.png',
        url: null,
        path: 'asset-b85b5818.png',
      }),
    ]);
    expect(diagnostics).toEqual([
      expect.objectContaining({ code: 'asset-unresolved' }),
    ]);
  });

  it('resolves file:// schemes case-insensitively', () => {
    const files = { 'x.png': '/u/x.png' };
    const { typst, assets, diagnostics } = markdownToTypst(
      '![a](FILE://x.png)',
      options(files)
    );
    expect(typst).toBe('#par[#box(image("asset-3ab9cef0.png", alt: "a"))]\n\n');
    expect(assets).toEqual([
      {
        uri: 'FILE://x.png',
        url: '/u/x.png',
        scope: { kind: 'problem', tid: '7', problemId: 7 },
        path: 'asset-3ab9cef0.png',
      },
    ]);
    expect(diagnostics).toEqual([]);
  });

  it('resolves file:// link targets through the asset scope', () => {
    const resolved = markdownToTypst(
      '[doc](file://doc.pdf)',
      options({ 'doc.pdf': '/files/doc.pdf' })
    );
    expect(resolved.typst).toBe('#par[#link("/files/doc.pdf")[#"doc"]]\n\n');
    expect(resolved.diagnostics).toEqual([]);

    const missing = markdownToTypst('[doc](file://doc.pdf)', options());
    expect(missing.typst).toBe('#par[#"doc"]\n\n');
    expect(missing.diagnostics).toEqual([
      expect.objectContaining({ code: 'asset-unresolved' }),
    ]);
  });

  it('resolves link and image references through definitions', () => {
    const files = { 'x.png': '/u/x.png' };
    const { typst, assets, diagnostics } = markdownToTypst(
      '[l][site] and ![i][img]\n\n[site]: https://e.com\n[img]: file://x.png',
      options(files)
    );
    expect(typst).toBe(
      '#par[#link("https://e.com")[#"l"]#" and "#box(image("asset-ef69e8b0.png", alt: "i"))]\n\n'
    );
    expect(assets).toHaveLength(1);
    expect(diagnostics).toEqual([]);
  });

  it('keeps references without definitions as literal text', () => {
    // CommonMark never forms reference nodes for missing definitions, so
    // they reach the compiler inside plain text.
    const { typst, diagnostics } = markdownToTypst(
      'see [x] and ![i][img]',
      options()
    );
    expect(typst).toBe('#par[#"see [x] and ![i][img]"]\n\n');
    expect(diagnostics).toEqual([]);
  });

  it('renders synthetic references without definitions as literal markdown', () => {
    const ctx = freshContext();
    const tree = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            {
              type: 'linkReference',
              referenceType: 'full',
              identifier: 'z',
              children: [{ type: 'text', value: 'y' }],
            },
            {
              type: 'imageReference',
              referenceType: 'shortcut',
              identifier: 'i',
              alt: 'i',
            },
          ],
        },
      ],
    } as unknown as Root;
    expect(compileMdast(tree, ctx)).toBe('#par[#"["#"y"#"][z]"#"![i]"]\n\n');
    expect(ctx.diagnostics).toEqual([]);
  });

  it('expands footnotes inline and drops their definitions', () => {
    const { typst } = markdownToTypst('a[^n] b\n\n[^n]: note text', options());
    expect(typst).toBe('#par[#"a"#footnote[#"note text"]#" b"]\n\n');
  });

  it.each([
    [':::info\nbody\n:::', '#par[#"body"]\n\n'],
    [':::warning[Title]\nbody\n:::', '#par[#"Title"]\n#par[#"body"]\n\n'],
    [':::align{center}\nx\n:::', '#align(center)[\n#par[#"x"]\n]\n\n'],
    [
      ':::figure[Cap]\nx\n:::',
      '#figure(caption: [#"Cap"])[\n#par[#"x"]\n]\n\n',
    ],
  ])('converts directive %j', (markdown, expected) => {
    const { typst, diagnostics } = markdownToTypst(markdown, options());
    expect(typst).toBe(expected);
    expect(diagnostics).toEqual([]);
  });

  it('renders leaf figure directives with a src attribute as figures', () => {
    const { typst, assets, diagnostics } = markdownToTypst(
      '::figure{src="https://e.com/a.png" caption="c"}',
      options()
    );
    expect(typst).toBe(
      '#figure(caption: ["c"])[#box(image("asset-196bb661.png"))]\n'
    );
    expect(assets).toHaveLength(1);
    expect(diagnostics).toEqual([]);
  });

  it('renders unknown directives as contents plus an info diagnostic', () => {
    const { typst, diagnostics } = markdownToTypst(
      ':::spoiler\nx\n:::',
      options()
    );
    expect(typst).toBe('#par[#"x"]\n\n');
    expect(diagnostics).toEqual([
      expect.objectContaining({
        severity: 'info',
        code: 'unsupported-markdown',
        location: { problemId: 7, nodeType: 'containerDirective' },
      }),
    ]);
  });

  it('renders raw HTML as escaped inline code with a warning', () => {
    const { typst, diagnostics } = markdownToTypst('a <b>c</b> d', options());
    expect(typst).toBe(
      '#par[#"a "#raw(block: false, lang: "html", "<b>")#"c"#raw(block: false, lang: "html", "</b>")#" d"]\n\n'
    );
    expect(diagnostics).toHaveLength(2);
    expect(diagnostics[0].code).toBe('unsupported-markdown');
  });

  it('warns about code lines wider than 80 display columns', () => {
    const { diagnostics } = markdownToTypst(
      `\`\`\`\n${'x'.repeat(81)}\nok\n${'字'.repeat(41)}\n\`\`\``,
      options()
    );
    expect(diagnostics).toEqual([
      expect.objectContaining({
        severity: 'warning',
        code: 'overlong-code-line',
        location: { problemId: 7, nodeType: 'code' },
      }),
    ]);
    expect(diagnostics[0].message).toContain('2 line(s)');
    expect(diagnostics[0].message).toContain('line 1');
  });

  it('reports unsupported mdast nodes and extracts their content', () => {
    const ctx = freshContext(9);
    const tree = {
      type: 'root',
      children: [
        { type: 'paragraph', children: [{ type: 'mystery', value: 'raw' }] },
      ],
    } as unknown as Root;
    expect(compileMdast(tree, ctx)).toBe('#par[#"raw"]\n\n');
    expect(ctx.diagnostics).toEqual([
      expect.objectContaining({
        severity: 'warning',
        code: 'unsupported-markdown',
        location: { problemId: 9, nodeType: 'mystery' },
      }),
    ]);
  });

  it('is deterministic across repeated calls', () => {
    const files = { 'x.png': '/u/x.png' };
    const markdown = '## H\n\n![a](file://x.png) $x$ `c`\n\n:::info\nn\n:::';
    const first = markdownToTypst(markdown, options(files));
    const second = markdownToTypst(markdown, options(files));
    expect(second).toEqual(first);
    expect(second.typst).toBe(first.typst);
  });
});
