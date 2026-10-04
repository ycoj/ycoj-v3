import rehypeLatex from './rehype-latex';
import type { Element, Root } from 'hast';
import { toHtml } from 'hast-util-to-html';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';
import { describe, expect, it } from 'vitest';

function textElement(tagName: string, value: string): Element {
  return {
    type: 'element',
    tagName,
    properties: {},
    children: [{ type: 'text', value }],
  };
}

async function renderTree(element: Element) {
  const tree: Root = { type: 'root', children: [element] };
  return unified().use(rehypeLatex).run(tree);
}

function annotations(tree: Root) {
  const values: string[] = [];
  visit(tree, 'element', (node) => {
    if (node.tagName !== 'annotation') return;
    for (const child of node.children) {
      if (child.type === 'text') values.push(child.value);
    }
  });
  return values;
}

describe('rehypeLatex', () => {
  it('renders mixed HTML formulas once and preserves intervening literal text', async () => {
    const tree = await renderTree(
      textElement(
        'div',
        String.raw`**Before** $x_1$ / $$y^2$$ / \(z\) **after**`
      )
    );
    expect(annotations(tree)).toEqual(['x_1', 'y^2', 'z']);
    const html = toHtml(tree);
    expect(html).toContain('**Before** ');
    expect(html).toContain(' **after**');
    expect(html.match(/ \/ /g)).toHaveLength(2);
    expect(html.match(/class="katex-display"/g)).toHaveLength(1);
  });

  it.each(['code', 'pre', 'script', 'noscript', 'style', 'textarea'])(
    'leaves formula examples inside %s and its descendants literal',
    async (tagName) => {
      const element = textElement(tagName, String.raw`$x$ $$y$$ \(z\)`);
      element.children.push(textElement('span', '$nested$'));
      const tree = await renderTree(element);
      expect(annotations(tree)).toEqual([]);
      expect(toHtml(tree)).toContain('$nested$');
      expect(element.children[0]).toMatchObject({
        type: 'text',
        value: String.raw`$x$ $$y$$ \(z\)`,
      });
    }
  );

  it('does not reinterpret text already parsed by Markdown', async () => {
    const element = textElement('p', String.raw`$x$ and \(y\)`);
    element.children[0].data = { markdownParsed: true };
    const tree = await renderTree(element);
    expect(toHtml(tree)).toBe(String.raw`<p>$x$ and \(y\)</p>`);
  });

  it.each(['math-inline', 'math-display'])(
    'renders parsed %s code nodes before skipping ordinary code',
    async (className) => {
      const element = textElement('code', String.raw`\frac{a}{b}`);
      element.properties.className = [className];
      const tree = await renderTree(element);
      expect(annotations(tree)).toEqual([String.raw`\frac{a}{b}`]);
      expect(toHtml(tree).includes('class="katex-display"')).toBe(
        className === 'math-display'
      );
      expect(toHtml(tree)).not.toContain('<code');
    }
  );

  it.each([
    String.raw`Unclosed $x`,
    String.raw`Unclosed \(x`,
    String.raw`\$x\$`,
  ])(
    'preserves literal HTML text with unmatched or escaped delimiters: %s',
    async (source) => {
      const tree = await renderTree(textElement('div', source));
      expect(toHtml(tree)).toBe(`<div>${source}</div>`);
    }
  );

  it('does not interpret Markdown entities as formula delimiters in HTML text', async () => {
    const tree = await renderTree(textElement('div', '&#36;x&#36; $y$'));
    expect(annotations(tree)).toEqual(['y']);
    expect(toHtml(tree)).toContain('&#x26;#36;x&#x26;#36; ');
  });

  it('escapes literal title HTML while rendering title formulas', async () => {
    const element = textElement('md-alert', 'Body $y$');
    element.properties.dataTitle = '<img src=x onerror=alert(1)> **Label** $x$';
    const tree = await renderTree(element);
    const title = element.properties['data-title-html'];
    expect(typeof title).toBe('string');
    expect(title).toContain('&#x3C;img src=x onerror=alert(1)> **Label** ');
    expect(title).toContain('class="katex"');
    expect(title).not.toContain('<img');
    expect(annotations(tree)).toEqual(['y']);
  });

  it.each([
    String.raw`\href{javascript:alert(1)}{click}`,
    String.raw`\htmlClass{injected}{x}`,
    String.raw`\htmlStyle{background:red}{x}`,
    String.raw`\includegraphics{https://example.com/tracker.png}`,
  ])('disables trusted TeX commands: %s', async (formula) => {
    const tree = await renderTree(textElement('div', `$${formula}$`));
    expect(annotations(tree)).toEqual([formula]);
    const html = toHtml(tree);
    expect(html).not.toContain('<a ');
    expect(html).not.toContain('<img ');
    expect(html).not.toContain('class="injected"');
    expect(html).not.toContain('style="background:red');
  });

  it('keeps rendered formulas intact on a subsequent transform', async () => {
    const tree = await renderTree(
      textElement('div', String.raw`$\text{cost \$5}$`)
    );
    const html = toHtml(tree);
    await unified().use(rehypeLatex).run(tree);
    expect(toHtml(tree)).toBe(html);
    expect(annotations(tree)).toEqual([String.raw`\text{cost \$5}`]);
  });
});
