import rehypeCodeBlocks from './plugins/rehype-code-blocks';
import rehypeLatex from './plugins/rehype-latex';
import rehypeMarkdownHtml from './plugins/rehype-markdown-html';
import rehypeUserSpan from './plugins/rehype-user-span';
import remarkContainers from './plugins/remark-containers';
import remarkLatex from './plugins/remark-latex';
import remarkPdf from './plugins/remark-pdf';
import remarkProblemSamples from './plugins/remark-problem-samples';
import { markdownSanitizeSchema } from './sanitize-schema';
import rehypeSanitize from 'rehype-sanitize';
import type { Options as Schema } from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import type { PluggableList } from 'unified';

export const markdownRemarkPlugins: PluggableList = [
  remarkGfm,
  remarkLatex,
  remarkContainers,
  remarkPdf,
  remarkProblemSamples,
];

export function markdownRehypePlugins(
  extensions: PluggableList = [],
  schema: Schema = markdownSanitizeSchema
): PluggableList {
  return [
    rehypeMarkdownHtml,
    ...extensions,
    [rehypeSanitize, schema],
    rehypeLatex,
    rehypeUserSpan,
    rehypeCodeBlocks,
  ];
}
