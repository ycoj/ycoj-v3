# Vendored font binaries

Font files committed here are **sources**, not web-served assets — the browser
copies live under `public/fonts/typst/` (gitignored, produced by
`scripts/prepare-typst.mjs`).

## CNOI statement fonts

`FiraMono-*`, `lmroman*`, `NewCMMath-*`, `NewCMSansMath-Regular.otf`,
`SimSun.ttf`, `simhei.ttf`, and `simkai.ttf` are the exact font binaries used
by the CNOI statement template. They were imported from the user-provided
`/tmp/cnoi-statement-generator/assets/typst/fonts/` reference snapshot and are
SHA-256 pinned in `scripts/prepare-typst.mjs`.

## NotoSansCJKsc-Regular.otf

Read by the Node.js scoreboard export renderer
(`features/contest/scoreboard/scoreboard-export-renderer.ts`). It lives outside
`public/` because only server code reads it and it should not be web-served;
`next.config.ts` includes it in the route's output tracing.

Source: [Noto CJK revision f8d157532fbfaeda587e826d4cd5b21a49186f7c](https://github.com/notofonts/noto-cjk/tree/f8d157532fbfaeda587e826d4cd5b21a49186f7c/Sans/OTF/SimplifiedChinese).
Its SIL Open Font License is in `noto-sans-cjk-OFL.txt`.

The font is intentionally not subset. Exported scoreboards contain arbitrary
usernames, real names, and problem titles, so removing glyphs would replace
unknown characters with tofu. The tradeoff is a ~16 MiB deployment artifact,
which output tracing already carries.
