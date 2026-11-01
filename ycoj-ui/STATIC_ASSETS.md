# Browser static assets

Application scripts, styles, fonts, workers, and WASM are served from the
application origin in development and production. The former
`NEXT_PUBLIC_STATIC_ASSET_PREFIX` and `NEXT_PUBLIC_PRINT_ASSET_PREFIX` variables
are no longer used; existing deployment values cannot redirect these resources
to a CDN.

## Prepared dependencies

`pnpm prepare:browser-assets` copies installed browser distributions to
`public/vendor/<package>@<version>/`. It runs during installation, development,
and production builds, without downloading anything from a public CDN.
The generated files are ignored by Git. Versions and copied paths are listed in
`shared/lib/browser-assets.json`; a version mismatch fails preparation.

The manifest covers:

- Monaco, including the AMD loader, language modules, workers, CSS, and fonts.
- Markdown editor dependencies: Highlight.js and every built-in light/dark
  theme, Prettier's standalone runtime and Markdown plugin, Cropper, Screenfull,
  Mermaid, and ECharts.
- Starry Night's Oniguruma WASM, used by both standalone code and Markdown
  highlighting. Both initializers override the dependency's default external
  WASM URL. Server rendering uses the installed package's local binary.

The Markdown editor uses the existing VelociTex adapter for formulas, so it
does not load the default public KaTeX scripts or stylesheet. Excalidraw fonts,
VelociTex, PDF.js, and print/clangd resources already use self-hosted assets or
bundled modules.

## Deployment

Deploy the generated `public/` tree with the frontend, including `public/vendor/`,
alongside `.next/static/`. The standalone packaging script includes both trees.
No separate CDN synchronization is required. Retain older version directories
if older clients must keep working across releases. A missing asset must return
an error rather than redirecting to a public CDN.

`next.config.ts` sets these origin response headers for `/vendor/*`:

```text
Access-Control-Allow-Origin: *
Cross-Origin-Resource-Policy: cross-origin
Cache-Control: public, max-age=31536000, immutable
```

Serve JavaScript, CSS, fonts, and WASM with their correct content types. Browser
access controls must permit the application origin and Monaco's `blob:` workers.

When upgrading a prepared dependency, update its package version, lockfile,
and manifest together, verify the listed browser files and any relative imports,
then run preparation and the frontend checks. Prettier is copied from the
existing development dependency, so builds require development dependencies.
