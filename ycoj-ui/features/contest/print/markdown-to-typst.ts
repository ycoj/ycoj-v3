import type { PrintAssetRef, PrintAssetScope } from './assets';
import { compileMdast, type CompileContext } from './mdast-to-typst';
import type { PrintDiagnostic } from './model';
import type { Root } from 'mdast';
import remarkDirective from 'remark-directive';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

// Frozen once: the remark plugins only register parser extensions, so a
// shared processor parses every statement identically.
const processor = unified()
  .use(remarkParse)
  .use(remarkMath)
  .use(remarkGfm)
  .use(remarkDirective)
  .freeze();

export type MarkdownToTypstOptions = {
  /** `pdoc.docId` stamped on diagnostics emitted for this statement. */
  problemId?: number;
  /**
   * Scope recorded on collected asset refs. The caller binds `resolveFile`
   * to the matching scope (`PrintAssetProvider.resolveFile(scope, name)`).
   */
  scope: PrintAssetScope;
  /** Maps a `file://` attachment name to a fetchable URL; `null` if absent. */
  resolveFile: (filename: string) => string | null;
};

export type MarkdownToTypstResult = {
  /** Generated Typst markup source; ends with a newline. */
  typst: string;
  /** Unique image/asset references in first-seen order. */
  assets: PrintAssetRef[];
  diagnostics: PrintDiagnostic[];
};

/**
 * Convert one markdown section (statement, notice, extra section) to Typst
 * source. Pure and deterministic: the same input yields the same source,
 * asset list and diagnostics on every call.
 */
export function markdownToTypst(
  markdown: string,
  options: MarkdownToTypstOptions
): MarkdownToTypstResult {
  const ctx: CompileContext = {
    problemId: options.problemId,
    scope: options.scope,
    resolveFile: options.resolveFile,
    out: [],
    assets: [],
    diagnostics: [],
    definitions: new Map(),
    footnotes: new Map(),
    expandingFootnotes: new Set(),
    assetPaths: new Map(),
  };
  try {
    const tree = processor.parse(markdown) as Root;
    return {
      typst: compileMdast(tree, ctx),
      assets: ctx.assets,
      diagnostics: ctx.diagnostics,
    };
  } catch (error) {
    return {
      typst: '',
      assets: ctx.assets,
      diagnostics: [
        {
          severity: 'error',
          code: 'internal-error',
          message: `Markdown conversion failed: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }
}
