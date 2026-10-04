import type { Root, Text } from 'hast';
import rehypeRaw from 'rehype-raw';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';

type MarkdownText = Omit<Text, 'type'> & { type: 'markdown-text' };

declare module 'hast' {
  interface RootContentMap {
    'markdown-text': MarkdownText;
  }
  interface ElementContentMap {
    'markdown-text': MarkdownText;
  }
  interface Data {
    markdownParsed?: boolean;
  }
}

const parseHtml = rehypeRaw({ passThrough: ['markdown-text'] });

// Preserve text already parsed by Markdown through the HTML parser. Otherwise
// escaped delimiters and entities become indistinguishable from HTML formulas.
const rehypeMarkdownHtml: Plugin<[], Root> = () => (tree, file) => {
  visit(tree, 'text', (node, index, parent) => {
    if (parent && index !== undefined) {
      parent.children[index] = { ...node, type: 'markdown-text' };
    }
  });
  const parsed = parseHtml(tree, file);
  visit(parsed, 'markdown-text', (node, index, parent) => {
    if (parent && index !== undefined) {
      parent.children[index] = {
        ...node,
        type: 'text',
        data: { ...node.data, markdownParsed: true },
      };
    }
  });
  return parsed;
};

export default rehypeMarkdownHtml;
