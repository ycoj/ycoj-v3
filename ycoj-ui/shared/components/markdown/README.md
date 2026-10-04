# Markdown engine

`Markdown` is the server entry point. Its `children`, `rehypePlugins`,
`sanitizeSchema`, and `components` props remain the extension API.

The pipeline is defined in `engine.ts`:

1. Parse CommonMark/GFM and the LaTeX syntax into an MDAST tree.
2. Resolve alert/alignment containers, then transform standalone PDF links and
   paired problem samples throughout the completed tree.
3. Convert to HAST, parse raw HTML, and run the caller's rehype extensions.
4. Sanitize the source and extension output with the supplied schema.
5. Render LaTeX, enrich user links, and highlight/number code blocks.
6. Render React elements with the default or caller-supplied components.

## Formulas

`remark-latex.ts` registers micromark syntax and an MDAST compiler for `$…$`,
`$$…$$`, and `\(…\)`. Matched formulas are opaque to Markdown: their TeX is
preserved verbatim, including `\\`, `\cr`, and Markdown punctuation. Unmatched
delimiters stay literal. Markdown's parser owns code fences, code spans,
indentation, and quoting; the formula plugin does not duplicate those rules.
Adjacent formulas such as `$x$$y$` are parsed independently. Container markers
inside formulas or multiline code spans remain literal content.

`rehype-latex.ts` renders the parsed formulas after sanitization, with KaTeX
trust disabled. It uses the same syntax to locate formulas in sanitized HTML
text, preserving surrounding literal HTML text and skipping code/pre elements.
`rehype-markdown-html.ts` preserves text already parsed by Markdown through raw
HTML parsing, so escaped delimiters and character references in Markdown prose
are not interpreted again as formulas. Raw HTML text and extension-generated
text still receive formula rendering after sanitization.
Fenced `math` examples remain code. All formulas are included in server output;
opening a collapsed alert reveals already-rendered content without a DOM scan.
Alert titles retain literal text and may include formulas; their trusted title
markup is generated after source sanitization, using the same formula parser.

## Containers and extensions

Containers retain the existing `:::info`, `:::warning`, `:::success`,
`:::error`, and `:::align{left|center|right}` authoring syntax. Alert titles and
`{open|opened|close|closed}` markers retain their existing behavior, including
nested containers and fallback for incomplete markers.

The container transform resolves each local body against its own source before
grouping it into its parent. It neither deletes source positions nor calls
other transforms. New content transforms should run **after** containers so
compact and expanded bodies share the same pipeline.

Caller rehype extensions run **before** sanitization. Extend the exported
`markdownSanitizeSchema` for new elements/attributes and provide React renderers
through `components`. Generated KaTeX and highlighter markup is added after the
source has been sanitized; do not broadly allow their inline styles in the
source schema.
Text-splitting extensions should preserve the original text node's `data`,
including the marker that prevents already-parsed Markdown from being
interpreted again as formulas. The objective-control extension follows this
rule for text surrounding controls and dropdown option labels.

`rehype-code-blocks.ts` owns the shared highlighter and the order of language
flag normalization, highlighting, and line numbering. Keep the existing
`|line-numbers` and `|no-line-numbers` behavior there.

## Regression coverage

- `plugins/remark-latex.test.ts`: literal TeX, delimiters, code, and Markdown
  nesting through the real parser, including adjacent formulas and source spans.
- `plugins/rehype-latex.test.ts`: HTML formulas, ignored elements, title escaping,
  trust restrictions, and repeated transforms.
- `plugins/rehype-code-blocks.test.ts`: highlighting/numbering order, whitespace,
  mixed language flags, and concurrent processors.
- `plugins/remark-problem-samples.test.ts`: pairing boundaries, reversed fences,
  consecutive samples, and literal payload preservation.
- `plugins/remark-containers.test.ts`: container syntax, nesting, incomplete
  frames, and ownership of source offsets.
- `engine.test.ts`: server output, sanitization, extension overrides, objective
  controls, and user links.
- `index.browser.test.tsx`: visible formulas and matrix row layout, code
  controls/spacing, PDF embeds, samples, and interactive containers.
