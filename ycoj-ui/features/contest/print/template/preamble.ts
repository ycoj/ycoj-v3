/**
 * Typst preamble written to the compiler shadow FS at `PRINT_PREAMBLE_PATH`.
 * It defines the three functions the markdown→Typst converter emits
 * (see `mdast-to-typst.ts`): `print-math`, `print-note`
 * and `print-rule`. LaTeX math is rendered through the vendored
 * `@preview/mitex` package, resolved by `VendoredPackageRegistry`.
 */
export const PREAMBLE_SOURCE = `// Functions consumed by generated statement sources.
#import "@preview/mitex:0.2.7": mi, mimath

// LaTeX math: display equation when 'block' is true, inline otherwise.
#let print-math(block: false, latex) = {
  if block { mimath(latex) } else { mi(latex) }
}

// Accent color per directive kind; unknown kinds fall back to 'info'.
#let print-note-accents = (
  info: rgb("#2563a8"),
  note: rgb("#2563a8"),
  tip: rgb("#0f7b6c"),
  hint: rgb("#0f7b6c"),
  success: rgb("#237a3b"),
  warning: rgb("#a15c07"),
  caution: rgb("#a15c07"),
  error: rgb("#a61c1c"),
  important: rgb("#8b1a4f"),
)

// Boxed admonition: colored left bar, tinted body, optional bold title.
#let print-note(kind: "info", title: none, body) = {
  let accent = print-note-accents.at(kind, default: print-note-accents.info)
  block(
    width: 100%,
    fill: accent.lighten(93%),
    stroke: (left: 2pt + accent),
    radius: (right: 3pt),
    outset: (y: 3pt),
    inset: (x: 9pt, y: 6pt),
  )[
    #set par(first-line-indent: 0pt)
    #if title != none [
      #text(fill: accent.darken(12%), weight: "bold")[#title]
      #parbreak()
    ]
    #body
  ]
}

// Thematic break: quiet full-width hairline with breathing room.
#let print-rule() = block(
  width: 100%,
  above: 1.1em,
  below: 1.1em,
  line(length: 100%, stroke: 0.4pt + luma(120)),
)
`;
