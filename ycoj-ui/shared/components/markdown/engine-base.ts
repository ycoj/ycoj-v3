import rehypeCodeBlocks from './plugins/rehype-code-blocks';
import rehypeLatex from './plugins/rehype-latex';
import rehypeMarkdownHtml from './plugins/rehype-markdown-html';
import rehypeTableMerge from './plugins/rehype-table-merge';
import remarkContainers from './plugins/remark-containers';
import remarkCuteTable from './plugins/remark-cute-table';
import remarkLatex from './plugins/remark-latex';
import remarkPdf from './plugins/remark-pdf';
import remarkProblemSamples from './plugins/remark-problem-samples';
import { markdownSanitizeSchema } from './sanitize-schema';
import rehypeSanitize from 'rehype-sanitize';
import type { Options as Schema } from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import type { PluggableList } from 'unified';

/**
 * Markdown pipeline shared by the server and browser renderers.
 *
 * This module must stay free of server-only imports: it is executed in client
 * components too. `rehype-user-span`, which resolves user records through the
 * server API, is added by `engine.ts` for the server renderer only.
 */

export const markdownRemarkPlugins: PluggableList = [
  remarkGfm,
  remarkLatex,
  remarkContainers,
  remarkCuteTable,
  remarkPdf,
  remarkProblemSamples,
];

/** Rehype plugins that do not need a server request. */
export function markdownRehypeBasePlugins(
  extensions: PluggableList = [],
  schema: Schema = markdownSanitizeSchema
): PluggableList {
  return [
    rehypeTableMerge,
    rehypeMarkdownHtml,
    ...extensions,
    [rehypeSanitize, schema],
    rehypeLatex,
    rehypeCodeBlocks,
  ];
}
