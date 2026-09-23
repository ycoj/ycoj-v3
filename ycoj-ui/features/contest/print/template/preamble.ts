/**
 * Typst preamble written to the compiler shadow FS at `PRINT_PREAMBLE_PATH`.
 * It defines the functions the markdown→Typst converter emits
 * (see `mdast-to-typst.ts`): `print-math` and `print-rule`.
 * LaTeX math is rendered through the vendored
 * `@preview/mitex` package, resolved by `VendoredPackageRegistry`.
 */
export const PREAMBLE_SOURCE = `// Functions consumed by generated statement sources.
#import "@preview/mitex:0.2.7": mi, mimath

// LaTeX math: display equation when 'block' is true, inline otherwise.
#let print-math(block: false, latex) = {
  if block { mimath(latex) } else { mi(latex) }
}

// Match the reference statement template's thematic break.
#let print-rule() = line(
  length: 100%,
  stroke: rgb("#808080") + 0.5pt,
)
`;
