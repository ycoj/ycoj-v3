# Browser static assets

Production browser dependencies are served from `https://next-cdn.ycoj.cc`.
Set `NEXT_PUBLIC_STATIC_ASSET_PREFIX` before building to use a different CDN;
an empty value uses the application origin. Development defaults to the
application origin. This prefix also configures the existing print assets.
Next.js chunks and application worker entry points keep their existing URLs.

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

The Markdown editor uses the existing VelociTex adapter for formulas, so it
does not load the default public KaTeX scripts or stylesheet. Excalidraw fonts,
VelociTex, PDF.js, and print/clangd resources already use self-hosted assets or
bundled modules and retain their existing loading paths. Third-party avatar
services, user-provided content URLs, and the legacy Hydro UI are outside this
migration.

## Deployment

Publish the generated `public/vendor/` tree at `/vendor/` on the static CDN,
or configure that path to pull from the frontend origin, alongside the existing
print resources. Include scoped package directories such as
`/vendor/@highlightjs/cdn-assets@11.11.1/`. Publish assets before switching the
application build, and retain older version directories while older clients
may still be open. A missing asset must return an error rather than redirecting
to a public CDN.

`next.config.ts` sets these origin response headers for `/vendor/*`; a CDN
serving files independently must preserve or reproduce them:

```text
Access-Control-Allow-Origin: *
Cross-Origin-Resource-Policy: cross-origin
Cache-Control: public, max-age=31536000, immutable
```

Serve JavaScript, CSS, and fonts with their correct content types. Cross-origin
headers are required by Monaco's worker imports and fonts, including scratchpad
pages with cross-origin isolation enabled. Browser access controls must permit
the application origin, the configured static CDN, and Monaco's `blob:` workers.

When upgrading a prepared dependency, update its package version, lockfile,
and manifest together, verify the listed browser files and any relative imports,
then run preparation and the frontend checks. Prettier is copied from the
existing development dependency, so builds require development dependencies.
