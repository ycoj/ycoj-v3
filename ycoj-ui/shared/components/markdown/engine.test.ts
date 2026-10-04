import { markdownRehypePlugins, markdownRemarkPlugins } from './engine';
import { markdownSanitizeSchema } from './sanitize-schema';
import { makeObjectiveSchema } from '@/features/problem/objective/markdown-config';
import rehypeObjective from '@/features/problem/objective/rehype-objective';
import type { Root } from 'hast';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MarkdownAsync } from 'react-markdown';
import type { Components } from 'react-markdown';
import type { PluggableList } from 'unified';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const media = vi.hoisted(() => ({ getMedia: vi.fn() }));
vi.mock('@/api/server/method', () => ({ default: { UI: media } }));

beforeEach(() => {
  media.getMedia.mockReset();
});

async function html(
  source: string,
  extensions: PluggableList = [],
  components: Components = {}
) {
  return renderToStaticMarkup(
    await MarkdownAsync({
      children: source,
      remarkPlugins: markdownRemarkPlugins,
      rehypePlugins: markdownRehypePlugins(extensions),
      components,
    })
  );
}

describe('Markdown engine', () => {
  it('renders math on the server without JavaScript or DOM observers', async () => {
    const rendered = await html(String.raw`Text $x_1^2$ and $$\frac{a}{b}$$`);
    expect(rendered).toContain('class="katex"');
    expect(rendered).toContain('class="katex-display"');
    expect(rendered).toContain('<math');
    expect(rendered).not.toContain('$$');
    expect(rendered).not.toContain('katex-error');
  });

  it.each([
    [String.raw`Literal \$x\$ and $y$`, 'Literal $x$ and '],
    [String.raw`Literal \$$x\$$ and $y$`, 'Literal $$x$$ and '],
    [String.raw`Literal \\(x\\) and $y$`, String.raw`Literal \(x\) and `],
    ['Literal &#36;x&#36; and $y$', 'Literal $x$ and '],
  ])('keeps escaped formula examples literal: %s', async (source, literal) => {
    const rendered = await html(source);
    expect(rendered).toContain(literal);
    expect(rendered.match(/class="katex"/g)).toHaveLength(1);
    expect(rendered).toContain('>y</mi>');
  });

  it.each(
    ['$', '$$', String.raw`\(`].flatMap((open) =>
      ['\n', '\r\n', '\r'].map((ending) => [open, ending])
    )
  )(
    'keeps container markers inside a multiline %s formula opaque with %j line endings',
    async (open, ending) => {
      const close = open === String.raw`\(` ? String.raw`\)` : open;
      const value = '\\text{\n:::info\n:::warning\n:::\n:::sample\n}';
      const rendered = await html(
        `Before ${open}${value}${close} after`.replaceAll('\n', ending)
      );
      expect(rendered.match(/class="katex"/g)).toHaveLength(1);
      expect(rendered).not.toContain('<md-alert');
      expect(rendered).toContain('Before ');
      expect(rendered).toContain(' after');
    }
  );

  it.each(['$x$$y$', '$$x$$$$y$$', String.raw`\(x\)\(y\)`])(
    'renders adjacent formulas separately: %s',
    async (source) => {
      const rendered = await html(source);
      expect(rendered.match(/class="katex"/g)).toHaveLength(2);
      expect(rendered).toContain('>x</mi>');
      expect(rendered).toContain('>y</mi>');
    }
  );

  it.each(['$', '$$', String.raw`\(`, '`'])(
    'ignores container markers inside a nested %s literal',
    async (open) => {
      const close = open === String.raw`\(` ? String.raw`\)` : open;
      const rendered = await html(
        `:::info\n\n**${open}\\text{\n:::warning\n:::\n}${close}**\n\nTail\n\n:::`
      );
      expect(rendered.match(/<md-alert/g)).toHaveLength(1);
      expect(rendered).toContain('Tail');
      if (open === '`') {
        expect(rendered).toContain('<code>');
        expect(rendered).not.toContain('class="katex"');
      } else {
        expect(rendered.match(/class="katex"/g)).toHaveLength(1);
      }
    }
  );

  it('renders formulas in raw HTML while preserving decoded entities and nesting', async () => {
    const rendered = await html(
      '<div>**Literal** &amp; <span>$x$$y$</span><br>$$z^2$$<code>$example$</code></div>'
    );
    expect(rendered.match(/class="katex"/g)).toHaveLength(3);
    expect(rendered).toContain('**Literal** &amp; ');
    expect(rendered).toContain('<code>$example$</code>');
    expect(rendered).toContain('<br/>');
  });

  it('preserves escaped examples and real formulas when re-parsing compact container bodies', async () => {
    const rendered = await html(String.raw`:::info[Formula $t$]
Literal \$x\$ and $y$
:::`);
    expect(rendered).toContain('Literal $x$ and ');
    expect(rendered).toContain('>y</mi>');
    expect(rendered).toContain('data-title-html=');
    expect(rendered).toContain('&lt;mi&gt;t&lt;/mi&gt;');
  });

  it('sanitizes source HTML and disallows trusted TeX commands', async () => {
    const rendered =
      await html(String.raw`<img src="x" onerror="alert(1)"><script>alert(1)</script>

$\href{javascript:alert(1)}{click}$`);
    expect(rendered).not.toContain('<script');
    expect(rendered).not.toContain('onerror=');
    expect(rendered).not.toContain('href="javascript:');
  });

  it('preserves component overrides', async () => {
    const rendered = await html('# Heading', [], {
      h1: ({ children }) => createElement('h2', {}, children),
    });
    expect(rendered).toBe('<h2>Heading</h2>');
  });

  it('sanitizes caller-supplied HTML transformations', async () => {
    const extension = () => (tree: Root) => {
      tree.children.push({
        type: 'element',
        tagName: 'script',
        properties: {},
        children: [{ type: 'text', value: 'alert(1)' }],
      });
    };
    const rendered = await html('Visible text', [extension]);
    expect(rendered).toContain('Visible text');
    expect(rendered).not.toContain('<script');
  });

  it('keeps source styles out while retaining generated formula layout', async () => {
    const rendered = await html(
      '<span style="background:red" onclick="alert(1)">$x_1$</span>'
    );
    expect(rendered).not.toContain('background:red');
    expect(rendered).not.toContain('onclick=');
    expect(rendered).toContain('class="katex"');
    expect(rendered).toContain('style="');
  });

  it('supports an async extension, its sanitize schema, and a custom renderer', async () => {
    const extension = () => async (tree: Root) => {
      await Promise.resolve();
      tree.children.push({
        type: 'element',
        tagName: 'extension-note',
        properties: { dataLabel: 'Extra', onClick: 'alert(1)' },
        children: [{ type: 'text', value: 'Formula $x$' }],
      });
    };
    const rendered = renderToStaticMarkup(
      await MarkdownAsync({
        children: 'Original',
        remarkPlugins: markdownRemarkPlugins,
        rehypePlugins: markdownRehypePlugins([extension], {
          ...markdownSanitizeSchema,
          tagNames: [
            ...(markdownSanitizeSchema.tagNames ?? []),
            'extension-note',
          ],
          attributes: {
            ...markdownSanitizeSchema.attributes,
            'extension-note': ['dataLabel'],
          },
        }),
        components: {
          'extension-note': ({
            children,
            ...props
          }: {
            children?: ReactNode;
            'data-label'?: string;
          }) =>
            createElement(
              'aside',
              { 'aria-label': props['data-label'] },
              children
            ),
        } as Components,
      })
    );
    expect(rendered).toContain('<p>Original</p>');
    expect(rendered).toContain('<aside aria-label="Extra">Formula ');
    expect(rendered).toContain('class="katex"');
    expect(rendered).not.toContain('onclick=');
  });

  it.each([
    [
      'compact',
      ':::info\n@[pdf](/document.pdf)\n:::\n\n```input1\n3\n```\n\n```output1\n6\n```',
    ],
    [
      'expanded',
      ':::info\n\n@[pdf](/document.pdf)\n\n:::\n\n```input1\n3\n```\n\n```output1\n6\n```',
    ],
    [
      'quoted',
      '> :::info\n> @[pdf](/document.pdf)\n> :::\n\n> ```input1\n> 3\n> ```\n> ```output1\n> 6\n> ```',
    ],
  ])(
    'runs PDF and sample transforms throughout %s nested containers',
    async (_kind, body) => {
      const rendered = await html(`:::warning\n${body}\n\n:::`);
      expect(rendered.match(/<pdf-embed/g)).toHaveLength(1);
      expect(rendered).toContain('data-src="/document.pdf"');
      expect(rendered.match(/<samples/g)).toHaveLength(1);
      expect(rendered).toContain('data-input="3"');
      expect(rendered).toContain('data-output="6"');
    }
  );

  it('does not pair samples across container boundaries', async () => {
    const rendered = await html(
      ':::info\n```input1\n3\n```\n\n:::\n\n```output1\n6\n```'
    );
    expect(rendered).not.toContain('<samples');
    expect(rendered).toContain('language-input1');
    expect(rendered).toContain('language-output1');
  });

  it('preserves caller-defined sanitize rules alongside formula rendering', async () => {
    const rendered = renderToStaticMarkup(
      await MarkdownAsync({
        children: '<kbd>Key</kbd> $x^2$',
        remarkPlugins: markdownRemarkPlugins,
        rehypePlugins: markdownRehypePlugins([], {
          ...markdownSanitizeSchema,
          tagNames: markdownSanitizeSchema.tagNames?.filter(
            (tag) => tag !== 'kbd'
          ),
        }),
      })
    );
    expect(rendered).toContain('Key');
    expect(rendered).not.toContain('<kbd');
    expect(rendered).toContain('class="katex"');
  });

  it('preserves objective controls and keeps directive-like TeX inside the formula', async () => {
    const rendered = renderToStaticMarkup(
      await MarkdownAsync({
        children: String.raw`Answer {{ input(2) }} and $\text{{{ input(1) }}}$`,
        remarkPlugins: markdownRemarkPlugins,
        rehypePlugins: markdownRehypePlugins(
          [rehypeObjective],
          makeObjectiveSchema(markdownSanitizeSchema)
        ),
      })
    );
    expect(rendered.match(/<objective-input/g)).toHaveLength(1);
    expect(rendered).toContain('data-id="2"');
    expect(rendered).toContain('class="katex"');
    expect(rendered).not.toContain('katex-error');
  });

  it.each(['input', 'textarea', 'dropdown', 'select', 'multiselect'])(
    'keeps escaped formula examples literal around objective %s controls',
    async (kind) => {
      const rendered = renderToStaticMarkup(
        await MarkdownAsync({
          children: `Literal \\$x\\$ {{ ${kind}(1) }} then \\$z\\$ and $y$\n\n- A\n- B`,
          remarkPlugins: markdownRemarkPlugins,
          rehypePlugins: markdownRehypePlugins(
            [rehypeObjective],
            makeObjectiveSchema(markdownSanitizeSchema)
          ),
        })
      );
      expect(rendered).toContain(`<objective-${kind}`);
      expect(rendered).toContain('Literal $x$ ');
      expect(rendered).toContain(' then $z$ and ');
      expect(rendered.match(/class="katex"/g)).toHaveLength(1);
    }
  );

  it('enriches repeated user links in a single media request', async () => {
    media.getMedia.mockResolvedValueOnce({
      udict: {
        8: {
          _id: 8,
          uname: 'Grace',
          mail: '',
          avatar: '/avatar.png',
          ccfLevel: 3,
        },
      },
    });
    const rendered = await html('[Grace](/user/8) and [Grace again](/user/8)');
    expect(rendered.match(/<user-span/g)).toHaveLength(2);
    expect(rendered).toContain('data-uname="Grace"');
    expect(media.getMedia).toHaveBeenCalledWith({ uids: [8] });
    expect(media.getMedia).toHaveBeenCalledTimes(1);
  });

  it('keeps the original user link when media lookup fails', async () => {
    media.getMedia.mockRejectedValueOnce(new Error('Unavailable'));
    expect(await html('[Grace](/user/8)')).toBe(
      '<p><a href="/user/8">Grace</a></p>'
    );
  });
});
