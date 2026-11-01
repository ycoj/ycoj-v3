import {
  markdownRehypeBasePlugins,
  markdownRemarkPlugins,
} from './engine-base';
import rehypeUserSpan from './plugins/rehype-user-span';
import { markdownSanitizeSchema } from './sanitize-schema';
import type { Options as Schema } from 'rehype-sanitize';
import type { PluggableList } from 'unified';

/**
 * Server-side Markdown pipeline.
 *
 * Adds `rehype-user-span`, which resolves `/user/:uid` links into user cards by
 * calling the backend. Browser renderers must use `engine-base.ts` directly so
 * this server-only dependency never reaches the client bundle.
 */

export { markdownRemarkPlugins };

export function markdownRehypePlugins(
  extensions: PluggableList = [],
  schema: Schema = markdownSanitizeSchema
): PluggableList {
  const plugins = markdownRehypeBasePlugins(extensions, schema);
  // Place user resolution after sanitization but before code highlighting, the
  // same position it occupied in the original combined list.
  const codeBlockIndex = plugins.length - 1;
  return [
    ...plugins.slice(0, codeBlockIndex),
    rehypeUserSpan,
    plugins[codeBlockIndex]!,
  ];
}
