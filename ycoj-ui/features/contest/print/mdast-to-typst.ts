import type { PrintAssetRef, PrintAssetScope } from './assets';
import type { PrintDiagnostic } from './model';
import type {
  Code,
  Definition,
  FootnoteDefinition,
  FootnoteReference,
  ImageReference,
  LinkReference,
  ListItem,
  Literal,
  Parent,
  Root,
  RootContent,
  Table,
} from 'mdast';

/**
 * mdast-to-typst: a deterministic mdast → Typst source compiler. Output is
 * Typst markup with every construct emitted as a code-mode `#expr`, so text
 * never needs markup escaping — strings are the only escaping boundary.
 *
 * The generated source assumes the template preamble (`preamble.typ`)
 * provides:
 *   - `#print-math(block: bool, "<latex>")`  — mitex-backed math rendering
 *   - `#print-note(kind: "…", title: none | […])[body]` — directive boxes
 *   - `#print-rule()`                      — horizontal rule
 */

// remark-math and remark-directive add node types that `mdast`'s
// RootContentMap does not declare; these structural types cover the fields
// the compiler consumes.
export interface DirectiveNode extends Parent {
  type: 'containerDirective' | 'leafDirective' | 'textDirective';
  name: string;
  attributes?: Record<string, string | null | undefined> | null;
}
export interface MathFlowNode extends Literal {
  type: 'math';
}
export interface MathInlineNode extends Literal {
  type: 'inlineMath';
}
export type PrintMdastNode =
  RootContent | DirectiveNode | MathFlowNode | MathInlineNode;

export type CompileContext = {
  /** `pdoc.docId` for problem-scoped diagnostics. */
  problemId?: number;
  /** Scope recorded on every collected `PrintAssetRef`. */
  scope: PrintAssetScope;
  /** Maps an in-scope `file://` name to a fetchable URL; `null` if unknown. */
  resolveFile: (filename: string) => string | null;
  out: string[];
  assets: PrintAssetRef[];
  diagnostics: PrintDiagnostic[];
  definitions: Map<string, Definition>;
  footnotes: Map<string, FootnoteDefinition>;
  /** Footnotes currently being expanded; guards against self-reference. */
  expandingFootnotes: Set<string>;
  /** uri → shadow path; keeps repeated references at the same asset. */
  assetPaths: Map<string, string>;
};

/**
 * Display-width limit for code lines before an `overlong-code-line`
 * diagnostic fires. CJK/emoji cells count double, matching how the paper's
 * monospace grid renders them.
 */
export const MAX_CODE_LINE_WIDTH = 80;

/** Directive names rendered through the template's `print-note`. */
const NOTE_DIRECTIVE_KINDS = new Set([
  'info',
  'note',
  'tip',
  'hint',
  'warning',
  'success',
  'error',
  'caution',
  'important',
]);

const ALIGN_DIRECTIVE_VALUES = new Set(['left', 'center', 'right']);

/**
 * `raw` languages we trust the Typst side to know. Unknown or empty
 * languages normalize to `txt` so papers never depend on a highlighter's
 * exact grammar list.
 */
const RAW_LANGUAGES = new Set([
  'bash',
  'c',
  'cmake',
  'cpp',
  'csharp',
  'css',
  'csv',
  'diff',
  'docker',
  'dot',
  'go',
  'haskell',
  'html',
  'ini',
  'java',
  'javascript',
  'json',
  'jsonc',
  'julia',
  'kotlin',
  'latex',
  'lua',
  'make',
  'markdown',
  'matlab',
  'nginx',
  'ocaml',
  'pascal',
  'perl',
  'php',
  'powershell',
  'python',
  'r',
  'regex',
  'ruby',
  'rust',
  'scala',
  'sql',
  'swift',
  'toml',
  'tsv',
  'txt',
  'typescript',
  'typst',
  'vim',
  'wasm',
  'xml',
  'yaml',
]);

const RAW_LANGUAGE_ALIASES: Record<string, string> = {
  'c++': 'cpp',
  'c#': 'csharp',
  cc: 'cpp',
  console: 'txt',
  cxx: 'cpp',
  golang: 'go',
  js: 'javascript',
  jsx: 'javascript',
  kt: 'kotlin',
  md: 'markdown',
  pas: 'pascal',
  plain: 'txt',
  plaintext: 'txt',
  ps1: 'powershell',
  py: 'python',
  rs: 'rust',
  sh: 'bash',
  shell: 'bash',
  text: 'txt',
  tex: 'latex',
  ts: 'typescript',
  tsx: 'typescript',
  typ: 'typst',
  yml: 'yaml',
  zsh: 'bash',
};

/**
 * URL schemes allowed through `#link`/`image`. Links keep navigation
 * schemes; images add `data:`/`blob:` since both are fetchable asset bytes.
 * Everything else (`javascript:`, `vbscript:`, …) is rejected and the node
 * degrades to its text content.
 */
const LINK_SCHEMES = new Set(['http', 'https', 'mailto', 'tel', 'ftp']);
const IMAGE_SCHEMES = new Set(['http', 'https', 'data', 'blob']);

// Only these five characters can terminate a Typst string literal or inject
// an escape sequence; everything else passes through verbatim.
const TYPST_ESCAPES: Record<string, string> = {
  '\\': '\\\\',
  '"': '\\"',
  '\n': '\\n',
  '\r': '\\r',
  '\t': '\\t',
};

function escapeTypstString(value: string): string {
  return value.replace(/[\\"\n\r\t]/g, (char) => TYPST_ESCAPES[char]);
}

/** FNV-1a (32-bit) over UTF-16 code units — deterministic asset naming. */
function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

// East-Asian Wide/Fullwidth ranges plus emoji presentation ranges; every
// other code point counts as one cell.
const WIDE_RANGES: readonly [number, number][] = [
  [0x1100, 0x115f],
  [0x2e80, 0x303e],
  [0x3041, 0x33ff],
  [0x3400, 0x4dbf],
  [0x4e00, 0x9fff],
  [0xa000, 0xa4cf],
  [0xac00, 0xd7a3],
  [0xf900, 0xfaff],
  [0xfe30, 0xfe6f],
  [0xff00, 0xff60],
  [0xffe0, 0xffe6],
  [0x16fe0, 0x16fff],
  [0x1b000, 0x1b2ff],
  [0x1f300, 0x1faff],
  [0x20000, 0x3fffd],
];

function displayWidth(line: string): number {
  let width = 0;
  for (const char of line) {
    const codePoint = char.codePointAt(0)!;
    width += WIDE_RANGES.some(([lo, hi]) => codePoint >= lo && codePoint <= hi)
      ? 2
      : 1;
  }
  return width;
}

function normalizeRawLang(lang: string | null | undefined): string {
  const normalized = (lang ?? '').trim().toLowerCase();
  const alias = RAW_LANGUAGE_ALIASES[normalized] ?? normalized;
  return RAW_LANGUAGES.has(alias) ? alias : 'txt';
}

function pushDiagnostic(
  ctx: CompileContext,
  diagnostic: Omit<PrintDiagnostic, 'location'> & { nodeType?: string }
) {
  const { nodeType, ...rest } = diagnostic;
  ctx.diagnostics.push({
    ...rest,
    location: {
      ...(ctx.problemId !== undefined ? { problemId: ctx.problemId } : {}),
      ...(nodeType ? { nodeType } : {}),
    },
  });
}

// ---------------------------------------------------------------------------
// URLs and assets

const FILE_SCHEME = 'file://';
const SCHEME_RE = /^([a-zA-Z][a-zA-Z0-9+.-]*):/;

/** The `file://` payload decoded the same way `resolveFileUrls` slices it. */
function fileUrlFilename(uri: string): string {
  const rest = uri.slice(FILE_SCHEME.length);
  const suffixIndex = rest.search(/[?#]/);
  const encoded = suffixIndex === -1 ? rest : rest.slice(0, suffixIndex);
  try {
    return decodeURIComponent(encoded);
  } catch {
    return encoded;
  }
}

type ResolvedUrl =
  | { kind: 'ok'; url: string }
  | { kind: 'unresolved'; url: null }
  | { kind: 'rejected' };

/**
 * Classify a markdown URL: `file://` names go through the asset scope,
 * whitelisted schemes and scheme-less (relative/anchor/query) URLs pass
 * through verbatim, everything else is rejected.
 */
function resolveUrl(
  uri: string,
  allowedSchemes: ReadonlySet<string>,
  ctx: CompileContext
): ResolvedUrl {
  const scheme = SCHEME_RE.exec(uri)?.[1]?.toLowerCase();
  if (scheme === 'file') {
    const url = ctx.resolveFile(fileUrlFilename(uri));
    return url === null ? { kind: 'unresolved', url } : { kind: 'ok', url };
  }
  if (scheme !== undefined && !allowedSchemes.has(scheme)) {
    return { kind: 'rejected' };
  }
  return { kind: 'ok', url: uri };
}

function assetExtension(uri: string): string {
  if (SCHEME_RE.exec(uri)?.[1]?.toLowerCase() === 'data') {
    const mime = /^data:[a-z0-9-]+\/([a-z0-9-]+)/i.exec(uri)?.[1];
    if (mime && /^[a-z0-9]{1,8}$/.test(mime)) return mime.toLowerCase();
    return 'png';
  }
  const clean = uri.split(/[?#]/)[0];
  const name = clean.slice(clean.lastIndexOf('/') + 1);
  const dot = name.lastIndexOf('.');
  const ext = dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
  // Typst guesses the image format from the extension; `png` is the
  // fallback since problem attachments are overwhelmingly raster images.
  return /^[a-z0-9]{1,8}$/.test(ext) && ext !== '' ? ext : 'png';
}

/**
 * Shadow-FS path for an asset URI: `asset-<fnv1a(uri)>.<ext>`, with a
 * deterministic `-N` suffix on the astronomically unlikely hash collision.
 */
function shadowPath(uri: string, ctx: CompileContext): string {
  const known = ctx.assetPaths.get(uri);
  if (known) return known;

  const base = `asset-${fnv1a(uri)}`;
  const ext = assetExtension(uri);
  const taken = new Set(ctx.assetPaths.values());
  let path = `${base}.${ext}`;
  for (let index = 2; taken.has(path); index += 1) {
    path = `${base}-${index}.${ext}`;
  }
  ctx.assetPaths.set(uri, path);
  return path;
}

function registerAsset(uri: string, url: string | null, ctx: CompileContext) {
  if (ctx.assets.some((asset) => asset.uri === uri)) return;
  ctx.assets.push({ uri, url, scope: ctx.scope, path: shadowPath(uri, ctx) });
}

/** Images degrade to `[alt]` text when the asset cannot be resolved. */
function emitImage(
  uri: string,
  alt: string | null | undefined,
  ctx: CompileContext
) {
  const resolved = resolveUrl(uri, IMAGE_SCHEMES, ctx);
  if (resolved.kind === 'rejected') {
    pushDiagnostic(ctx, {
      severity: 'warning',
      code: 'unsupported-markdown',
      message: `Image URL '${uri}' uses a disallowed scheme`,
      nodeType: 'image',
    });
    if (alt) ctx.out.push(`#"[${escapeTypstString(alt)}]"`);
    return;
  }
  if (resolved.kind === 'unresolved') {
    pushDiagnostic(ctx, {
      severity: 'warning',
      code: 'asset-unresolved',
      message: `Image file '${fileUrlFilename(uri)}' is not attached to this scope`,
      nodeType: 'image',
    });
    registerAsset(uri, null, ctx);
    if (alt) ctx.out.push(`#"[${escapeTypstString(alt)}]"`);
    return;
  }
  registerAsset(uri, resolved.url, ctx);
  const path = shadowPath(uri, ctx);
  ctx.out.push(
    `#box(image("${path}"${alt ? `, alt: "${escapeTypstString(alt)}"` : ''}))`
  );
}

function emitLink(
  node: { children: readonly PrintMdastNode[] },
  url: string,
  ctx: CompileContext
) {
  const resolved = resolveUrl(url, LINK_SCHEMES, ctx);
  if (resolved.kind === 'rejected') {
    pushDiagnostic(ctx, {
      severity: 'warning',
      code: 'unsupported-markdown',
      message: `Link URL '${url}' uses a disallowed scheme`,
      nodeType: 'link',
    });
    emitChildren(node.children, ctx);
    return;
  }
  if (resolved.kind === 'unresolved') {
    pushDiagnostic(ctx, {
      severity: 'warning',
      code: 'asset-unresolved',
      message: `Link target '${fileUrlFilename(url)}' is not attached to this scope`,
      nodeType: 'link',
    });
    emitChildren(node.children, ctx);
    return;
  }
  ctx.out.push(`#link("${escapeTypstString(resolved.url)}")[`);
  emitChildren(node.children, ctx);
  ctx.out.push(']');
}

// ---------------------------------------------------------------------------
// Node emitters

function emitChildren(
  children: readonly PrintMdastNode[],
  ctx: CompileContext
) {
  for (const child of children) emitNode(child, ctx);
}

function emitListItem(item: ListItem, tight: boolean, ctx: CompileContext) {
  // Task-list markers print as ballot glyphs in front of the item text.
  if (item.checked === true) ctx.out.push('#sym.ballot.x #" "');
  else if (item.checked === false) ctx.out.push('#sym.ballot #" "');
  for (const child of item.children) {
    // Tight list items contribute their paragraph's inline content; loose
    // items keep `#par` blocks so separated paragraphs stay separated.
    if (tight && child.type === 'paragraph') emitChildren(child.children, ctx);
    else emitNode(child, ctx);
  }
}

function emitTable(node: Table, ctx: CompileContext) {
  if (node.children.length === 0) return;
  const columns = Math.max(
    node.align?.length ?? 0,
    ...node.children.map((row) => row.children.length)
  );
  ctx.out.push(`#figure(table(columns: ${columns}`);
  if (node.align?.some((align) => align != null)) {
    const alignments = Array.from({ length: columns }, (_, index) => {
      const align = node.align?.[index];
      return align ? `${align} + horizon` : 'auto';
    });
    ctx.out.push(`, align: (${alignments.join(', ')},)`);
  }
  ctx.out.push(',\n');
  for (const row of node.children) {
    for (let index = 0; index < columns; index += 1) {
      const cell = row.children[index];
      ctx.out.push('[');
      if (cell) emitChildren(cell.children, ctx);
      ctx.out.push('],');
    }
    ctx.out.push('\n');
  }
  ctx.out.push('))\n');
}

function emitCode(node: Code, ctx: CompileContext) {
  const lines = node.value.split('\n');
  const overlong = lines
    .map((line, index) => ({ index, width: displayWidth(line) }))
    .filter((line) => line.width > MAX_CODE_LINE_WIDTH);
  if (overlong.length) {
    pushDiagnostic(ctx, {
      severity: 'warning',
      code: 'overlong-code-line',
      message: `Code block has ${overlong.length} line(s) wider than ${MAX_CODE_LINE_WIDTH} columns (first at line ${overlong[0].index + 1})`,
      nodeType: 'code',
    });
  }
  ctx.out.push(
    `#raw(block: true, lang: "${normalizeRawLang(node.lang)}", "${escapeTypstString(node.value)}")\n`
  );
}

function emitDirective(node: DirectiveNode, ctx: CompileContext) {
  const name = node.name.toLowerCase();
  const attributes = node.attributes ?? {};

  // remark-directive puts `…[label]` into a leading `directiveLabel`
  // paragraph on containers, and into `children` itself on leaf/text
  // directives. The label becomes the note title / figure caption.
  let label: PrintMdastNode[] | null = null;
  let body: PrintMdastNode[] = node.children;
  if (node.type === 'containerDirective') {
    const first = body[0];
    if (
      first?.type === 'paragraph' &&
      (first.data as { directiveLabel?: boolean } | undefined)?.directiveLabel
    ) {
      label = first.children;
      body = body.slice(1);
    }
  } else {
    label = body;
    body = [];
  }

  // Container directives are blocks; leaf/text directives stay inline so
  // they can sit inside a paragraph without injecting stray line breaks.
  const open = node.type === 'containerDirective' ? '[\n' : '[';
  const close = node.type === 'containerDirective' ? ']\n' : ']';

  if (name === 'figure') {
    const caption = attributes.caption;
    if (typeof caption === 'string') {
      ctx.out.push(`#figure(caption: ["${escapeTypstString(caption)}"])`);
    } else if (label?.length) {
      ctx.out.push('#figure(caption: [');
      emitChildren(label, ctx);
      ctx.out.push('])');
    } else {
      ctx.out.push('#figure');
    }
    // `::figure{src="x.png"}` shorthand embeds the image inline.
    const src = attributes.src;
    ctx.out.push(open);
    if (typeof src === 'string') {
      emitImage(
        src,
        typeof attributes.alt === 'string' ? attributes.alt : null,
        ctx
      );
    }
    emitChildren(body, ctx);
    ctx.out.push(close);
    return;
  }

  if (name === 'align') {
    const value = Object.keys(attributes).find((key) =>
      ALIGN_DIRECTIVE_VALUES.has(key.toLowerCase())
    );
    if (!value) {
      pushDiagnostic(ctx, {
        severity: 'info',
        code: 'unsupported-markdown',
        message: `Directive 'align' needs one of left/center/right`,
        nodeType: node.type,
      });
      emitChildren(body, ctx);
      return;
    }
    ctx.out.push(`#align(${value.toLowerCase()})${open}`);
    emitChildren(body, ctx);
    ctx.out.push(close);
    return;
  }

  if (NOTE_DIRECTIVE_KINDS.has(name)) {
    ctx.out.push(`#print-note(kind: "${name}"`);
    const title = attributes.title;
    if (typeof title === 'string') {
      ctx.out.push(`, title: ["${escapeTypstString(title)}"]`);
    } else if (label?.length) {
      ctx.out.push(', title: [');
      emitChildren(label, ctx);
      ctx.out.push(']');
    }
    ctx.out.push(`)${open}`);
    emitChildren(body, ctx);
    ctx.out.push(close);
    return;
  }

  pushDiagnostic(ctx, {
    severity: 'info',
    code: 'unsupported-markdown',
    message: `Unknown directive '${node.name}'; rendering its contents`,
    nodeType: node.type,
  });
  if (node.type === 'containerDirective' && label) {
    ctx.out.push('#par[');
    emitChildren(label, ctx);
    ctx.out.push(']\n');
  } else if (label) {
    emitChildren(label, ctx);
  }
  emitChildren(body, ctx);
}

function emitFootnoteReference(node: FootnoteReference, ctx: CompileContext) {
  const definition = ctx.footnotes.get(node.identifier);
  if (!definition || ctx.expandingFootnotes.has(node.identifier)) {
    ctx.out.push(`#"[^${escapeTypstString(node.identifier)}]"`);
    return;
  }
  ctx.expandingFootnotes.add(node.identifier);
  ctx.out.push('#footnote[');
  for (const child of definition.children) {
    // Footnote bodies are inline content; the usual single paragraph
    // contributes its phrasing children directly.
    if (child.type === 'paragraph') emitChildren(child.children, ctx);
    else emitNode(child, ctx);
  }
  ctx.out.push(']');
  ctx.expandingFootnotes.delete(node.identifier);
}

// Reference nodes without a matching definition render as their literal
// markdown source, keeping the shortcut/collapsed/full suffix shape.
// (Remark only forms reference nodes when a definition exists, so this is a
// safety net for synthetic trees.)
function referenceSuffix(
  referenceType: string | null | undefined,
  identifier: string
): string {
  if (referenceType === 'full') return `][${identifier}]`;
  if (referenceType === 'collapsed') return '][]';
  return ']';
}

function emitLinkReference(node: LinkReference, ctx: CompileContext) {
  const definition = ctx.definitions.get(node.identifier);
  if (definition) {
    emitLink(node, definition.url, ctx);
    return;
  }
  ctx.out.push('#"["');
  emitChildren(node.children, ctx);
  ctx.out.push(
    `#"${escapeTypstString(referenceSuffix(node.referenceType, node.identifier))}"`
  );
}

function emitImageReference(node: ImageReference, ctx: CompileContext) {
  const definition = ctx.definitions.get(node.identifier);
  if (definition) {
    emitImage(definition.url, node.alt, ctx);
    return;
  }
  ctx.out.push(
    `#"![${escapeTypstString(node.alt ?? '')}${escapeTypstString(referenceSuffix(node.referenceType, node.identifier))}"`
  );
}

function emitNode(node: PrintMdastNode, ctx: CompileContext): void {
  switch (node.type) {
    case 'text':
      ctx.out.push(`#"${escapeTypstString(node.value)}"`);
      return;
    case 'paragraph':
      ctx.out.push('#par[');
      emitChildren(node.children, ctx);
      ctx.out.push(']\n');
      return;
    case 'heading':
      ctx.out.push(`#heading(level: ${node.depth}, [`);
      emitChildren(node.children, ctx);
      ctx.out.push('])\n');
      return;
    case 'emphasis':
      ctx.out.push('#emph[');
      emitChildren(node.children, ctx);
      ctx.out.push(']');
      return;
    case 'strong':
      ctx.out.push('#strong[');
      emitChildren(node.children, ctx);
      ctx.out.push(']');
      return;
    case 'delete':
      ctx.out.push('#strike[');
      emitChildren(node.children, ctx);
      ctx.out.push(']');
      return;
    case 'blockquote':
      ctx.out.push('#quote(block: true)[\n');
      emitChildren(node.children, ctx);
      ctx.out.push(']\n');
      return;
    case 'code':
      emitCode(node, ctx);
      return;
    case 'inlineCode':
      ctx.out.push(
        `#raw(block: false, lang: "txt", "${escapeTypstString(node.value)}")`
      );
      return;
    case 'list': {
      ctx.out.push(
        node.ordered
          ? `#enum(start: ${typeof node.start === 'number' ? node.start : 1},\n`
          : '#list(\n'
      );
      const tight = !node.spread;
      for (const item of node.children) {
        ctx.out.push('[');
        emitListItem(item, tight, ctx);
        ctx.out.push('],\n');
      }
      ctx.out.push(')\n');
      return;
    }
    case 'link':
      emitLink(node, node.url, ctx);
      return;
    case 'linkReference':
      emitLinkReference(node, ctx);
      return;
    case 'image':
      emitImage(node.url, node.alt, ctx);
      return;
    case 'imageReference':
      emitImageReference(node, ctx);
      return;
    case 'math':
      ctx.out.push(
        `#print-math(block: true, "${escapeTypstString(node.value)}")\n`
      );
      return;
    case 'inlineMath':
      ctx.out.push(
        `#print-math(block: false, "${escapeTypstString(node.value)}")`
      );
      return;
    case 'thematicBreak':
      ctx.out.push('#print-rule()\n');
      return;
    case 'break':
      ctx.out.push('#linebreak');
      return;
    case 'footnoteReference':
      emitFootnoteReference(node, ctx);
      return;
    case 'html':
      pushDiagnostic(ctx, {
        severity: 'warning',
        code: 'unsupported-markdown',
        message: 'Raw HTML is not supported in the printed paper',
        nodeType: 'html',
      });
      ctx.out.push(
        `#raw(block: false, lang: "html", "${escapeTypstString(node.value)}")`
      );
      return;
    case 'containerDirective':
    case 'leafDirective':
    case 'textDirective':
      emitDirective(node, ctx);
      return;
    case 'definition':
    case 'footnoteDefinition':
    case 'yaml':
      // Reference targets and frontmatter carry no printable content.
      return;
    case 'table':
      emitTable(node, ctx);
      return;
    case 'tableRow':
    case 'tableCell':
    case 'listItem':
      // Handled inside their parents; emit standalone occurrences as content.
      emitChildren(node.children, ctx);
      return;
    default: {
      const unknown = node as unknown as {
        type: string;
        value?: string;
        children?: PrintMdastNode[];
      };
      pushDiagnostic(ctx, {
        severity: 'warning',
        code: 'unsupported-markdown',
        message: `Markdown node '${unknown.type}' has no Typst mapping`,
        nodeType: unknown.type,
      });
      if (typeof unknown.value === 'string') {
        ctx.out.push(`#"${escapeTypstString(unknown.value)}"`);
      } else if (unknown.children) {
        emitChildren(unknown.children, ctx);
      }
    }
  }
}

/** Pre-pass: index link/image definitions and footnote bodies. */
function collectReferences(
  tree: Root,
  ctx: Pick<CompileContext, 'definitions' | 'footnotes'>
) {
  const visit = (node: PrintMdastNode) => {
    if (node.type === 'definition') {
      if (!ctx.definitions.has(node.identifier)) {
        ctx.definitions.set(node.identifier, node);
      }
    } else if (node.type === 'footnoteDefinition') {
      if (!ctx.footnotes.has(node.identifier)) {
        ctx.footnotes.set(node.identifier, node);
      }
    }
    const children = (node as { children?: PrintMdastNode[] }).children;
    if (children) for (const child of children) visit(child);
  };
  visit(tree as unknown as PrintMdastNode);
}

export function compileMdast(tree: Root, ctx: CompileContext): string {
  collectReferences(tree, ctx);
  emitChildren(tree.children, ctx);
  ctx.out.push('\n');
  return ctx.out.join('');
}
