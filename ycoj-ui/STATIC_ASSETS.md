# Browser static assets

`/_next/static` (JavaScript, CSS, `next/font` files, and other files the
bundler emits, including static image imports) is served from the site origin
unless `ASSET_PREFIX` is set for a production build. `next dev` ignores the
variable so local chunks and the dev socket stay on the dev server.

```bash
ASSET_PREFIX=https://next-cdn.ycoj.cc pnpm build
```

Leave it unset or empty for a same-origin build. The value must be an absolute
`http` or `https` URL without user info, a query, or a hash. Next.js joins it
to `/_next/...`, and a trailing slash is removed. The former
`NEXT_PUBLIC_STATIC_ASSET_PREFIX` and `NEXT_PUBLIC_PRINT_ASSET_PREFIX` variables
are not read.

`assetPrefix` does not change:

- document navigations or React Server Component requests
- `/api` and the other rewrites in `next.config.ts`
- the `/_next/image` optimizer (`images.path` stays `/_next/image`)
- files in `public/`, including `vendor/`, print assets, and clangd

Those stay on the application origin. Public files that are safe to cache
from a CDN would need their own URLs; the prepared files below are
intentionally same-origin because workers, WASM, and cross-origin isolation
load them from this site.

Font preloads are anonymous CORS requests. Next.js puts them on the `Link`
response header as `crossorigin=""` with the prefixed font URL. A cross-origin
`ASSET_PREFIX` therefore requires the CDN to send `Access-Control-Allow-Origin`
for the page origin. The global `crossOrigin` config is left unset so script
preloads keep the same credentials mode as the classic script tags.
Stylesheet and classic script tags are not sent with credentials. The origin
must still serve `/_next/static`: an origin-pull CDN fetches it from the site,
and the release health check requests a file under that path directly.

Next reads `ASSET_PREFIX` when it loads `next.config.ts`. A standalone
production build copies the resolved prefix into `server.js`. Putting the
variable only in the server's `runtime.env` does not change an already built
release. Change the prefix by rebuilding.

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
An origin-pull CDN does not need a separate upload of `.next/static`; the
release still has to contain those files so the CDN and the origin can serve
them. Retain older version directories if older clients must keep working
across releases. A missing asset must return an error rather than redirecting
to a public CDN.

The production CNB build (`.cnb.yml`) passes `ASSET_PREFIX` into `pnpm build`.
When the secret file omits it, that build defaults to
`https://next-cdn.ycoj.cc`. Set `ASSET_PREFIX: ''` in the secret file to keep
production on the site origin. See `docs/cnb-deployment.md`.

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
