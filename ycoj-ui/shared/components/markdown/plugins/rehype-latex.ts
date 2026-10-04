import { parseLatexText } from './remark-latex';
import type { ElementContent, Root } from 'hast';
import { toHtml } from 'hast-util-to-html';
import rehypeKatex from 'rehype-katex';
import type { Plugin } from 'unified';
import { SKIP, visit } from 'unist-util-visit';

const renderLatex = rehypeKatex({ trust: false });
const ignoredTags = new Set([
  'script',
  'noscript',
  'style',
  'textarea',
  'pre',
  'code',
]);

function renderFormula(
  value: string,
  display: boolean,
  file: Parameters<typeof renderLatex>[1]
) {
  const formula: Root = {
    type: 'root',
    children: [
      {
        type: 'element',
        tagName: 'code',
        properties: { className: [display ? 'math-display' : 'math-inline'] },
        children: [{ type: 'text', value }],
      },
    ],
  };
  renderLatex(formula, file);
  return formula.children as ElementContent[];
}

// Render only parsed formulas. Fenced code (including ```math) remains code,
// and caller-supplied HTML is sanitized before KaTeX creates its markup.
function transformLatex(tree: Root, file: Parameters<typeof renderLatex>[1]) {
  visit(tree, (node, index, parent) => {
    if (!parent || index === undefined) return;
    if (node.type === 'element') {
      const title = node.properties.dataTitle ?? node.properties['data-title'];
      if (
        node.tagName === 'md-alert' &&
        typeof title === 'string' &&
        /\$|\\\(/.test(title)
      ) {
        const label: Root = {
          type: 'root',
          children: [{ type: 'text', value: title }],
        };
        transformLatex(label, file);
        // This property is created after sanitization. Its HTML contains only
        // escaped label text and KaTeX output with trust disabled.
        node.properties['data-title-html'] = toHtml(label);
      }
      const classes = node.properties.className;
      if (
        node.tagName === 'code' &&
        Array.isArray(classes) &&
        classes.some(
          (name) => name === 'math-inline' || name === 'math-display'
        )
      ) {
        const formula: Root = { type: 'root', children: [node] };
        renderLatex(formula, file);
        parent.children.splice(index, 1, ...formula.children);
        return [SKIP, index + formula.children.length];
      }
      if (ignoredTags.has(node.tagName)) return SKIP;
      return;
    }
    if (
      node.type !== 'text' ||
      node.data?.markdownParsed ||
      !/\$|\\\(/.test(node.value)
    )
      return;

    const replacement: ElementContent[] = [];
    let cursor = 0;
    for (const formula of parseLatexText(node.value)) {
      const start = formula.position?.start.offset;
      const end = formula.position?.end.offset;
      if (start === undefined || end === undefined) continue;
      if (start > cursor)
        replacement.push({
          type: 'text',
          value: node.value.slice(cursor, start),
        });
      const display =
        formula.data?.hProperties?.className?.includes('math-display') === true;
      replacement.push(...renderFormula(formula.value, display, file));
      cursor = end;
    }
    if (cursor === 0) return;
    if (cursor < node.value.length)
      replacement.push({ type: 'text', value: node.value.slice(cursor) });
    parent.children.splice(index, 1, ...replacement);
    return [SKIP, index + replacement.length];
  });
}

const rehypeLatex: Plugin<[], Root> = () => transformLatex;

export default rehypeLatex;
