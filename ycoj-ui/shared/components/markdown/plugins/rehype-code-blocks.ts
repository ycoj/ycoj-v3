import {
  resolveLineNumberSkips,
  wrapCodeBlockLines,
} from './rehype-code-line-numbers';
import type { Root } from 'hast';
import rehypeStarryNight from 'rehype-starry-night';
import type { Plugin } from 'unified';

// Reuse the highlighter across processors: preliminary papers render many
// independent markdown fragments in a single request.
const highlight = rehypeStarryNight();

const rehypeCodeBlocks: Plugin<[], Root> = () => async (tree, file) => {
  const skipped = resolveLineNumberSkips(tree);
  await highlight(tree, file);
  wrapCodeBlockLines(tree, skipped);
};

export default rehypeCodeBlocks;
