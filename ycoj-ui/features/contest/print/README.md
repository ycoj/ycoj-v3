# Contest printable PDF

Management-only page `/contest/[tid]/print` that compiles a CNOI-style contest
paper to PDF entirely in the browser via Typst compiled to WASM
(`@myriaddreamin/typst.ts`). Behavioral reference: the AGPL-3.0
`cnoi-statement-generator` project — reference only; all code, templates,
fonts and assets here are YCOJ-owned originals (repo license: MIT).

## Architecture

```
app/(app)/contest/[tid]/print/page.tsx      server shell: auth (canEditContest),
        |                                    getContestManagement, render client root
        v
features/contest/print/… editor UI         draft state = PrintableContest
        |                                    (model.ts) + overrides
        v
buildPrintableContest(response, overrides) pure, main thread
        |
        v
typst-compiler.ts                          createTypstPrintCompiler() — the
        |                                   PrintCompiler adapter, main thread
        |   - print-source.ts: buildTypstFiles() assembles /main.typ,
        |     /preamble.typ, /problem-N.typ, /extra-*.typ, /notice.typ,
        |     /content.json + collects PrintAssetRef[] (markdownToTypst)
        |   - staged downloads: wasm → fonts → packages, stream progress
        |   - resolveFile → fetchAsset(url) fetches document assets on the
        |     main thread; bytes are transferred inside `files` so the
        |     worker never touches the network or URL policy
        |   - latest-wins stale semantics
        v
typst.worker.ts  (module worker)           createTypstCompiler() inside worker
        |   - resetShadow() + mapShadow(files) per compile
        |   - compile({ format: pdf, mainFilePath }) → pdf bytes + diagnostics
        v
{ status:'ok', pdf: Uint8Array } → Blob → ReactPdfViewer preview + download
```

## Preview & download (`print-preview-panel.tsx`)

- `print-page.tsx` builds the `PrintAssetProvider` once per payload via
  `createContestAssetProvider({tid, contestFiles: tdoc.files, problemFiles:
{docId: pdoc.additional_file}})` and passes it to the panel together with
  the memoized draft `document`. The panel owns every piece of compile
  state; `createCompiler?: CreatePrintCompiler` is a test seam defaulting to
  `createTypstPrintCompiler`.
- **Generate** lazily creates the compiler (`fetchAsset`/`resolveFile`/`tid`
  bound from the provider), awaits `init()` while streaming staged progress
  (`wasm` → `fonts` → `packages`, label + percent bar), then calls
  `compilePdf(document)` under a spinner. The button is disabled while a
  job runs and unless `support === 'supported'`.
- `status:'ok'` wraps `pdf` in a Blob and previews it through
  `ReactPdfViewer` (shared react-pdf viewer, `next/dynamic` + `ssr:false`)
  pointed at the object URL. `status:'diagnostics'` surfaces the merged
  conversion/asset/Typst diagnostics in a `PrintDiagnosticsPanel` inside the
  card; `status:'stale'` is ignored (a newer compile owns the UI).
- **Object-URL lifecycle**: the live URL sits in a ref mirrored to state; a
  new compile revokes the previous URL, and the unmount cleanup revokes the
  last one. Download reuses the _same_ URL (`a.href` + `a.download` +
  click) and never revokes it; the one-shot Typst-source zip uses a fresh
  URL revoked on the next tick (`print-download.ts`).
- **Filename rule**: `contest-<tid>-<slug>.pdf` where `<slug>` is the title
  reduced to `[a-z0-9]+(-[a-z0-9]+)*`; an empty slug falls back to
  `contest-<tid>.pdf`. Source export: `contest-<tid>-typst-source.zip`.
- **Retry/dirty**: rejected init/compile (infrastructure) shows an error
  alert with Retry — the adapter's teardown makes the next `init()` boot a
  fresh worker. After a successful compile the document signature
  (`JSON.stringify(document)`) is recorded; a changed draft shows an
  "outdated" badge while the old PDF stays visible and downloadable.
- "Download Typst source" calls `exportTypstSource` — main-thread zip of the
  shadow FS, no worker boot needed.

SSR boundary: the route page is a thin async server component. Everything under
`compiler.ts`/`assets.ts` is client-only — the typst.ts trio is imported lazily
inside the worker module, so no WASM touches SSR or the main bundle. WASM/font/
package binaries are fetched on the main thread (with progress) and transferred
to the worker as `ArrayBuffer` (`getModule()` accepts `BufferSource`).

## Worker protocol (`typst-protocol.ts`)

`postMessage` discriminated unions; `kind` is the tag. No message survives a
worker restart — the adapter re-initializes from scratch.

Main → worker (`TypstWorkerRequest`):

| kind      | payload                                                                               |
| --------- | ------------------------------------------------------------------------------------- |
| `init`    | `compilerWasm`, `fonts[]`, `packages[]` — all `ArrayBuffer`s transferred once         |
| `compile` | `id`, `files: {path, bytes\|text}[]`, `mainPath` — full shadow-FS replacement payload |

Worker → main (`TypstWorkerResponse`):

| kind       | meaning                                                                                             |
| ---------- | --------------------------------------------------------------------------------------------------- |
| `ready`    | init finished; the worker accepts compiles                                                          |
| `compiled` | `{id, pdf?: Uint8Array, diagnostics}` — no `pdf` when diagnostics contain errors                    |
| `failed`   | infrastructure failure (wasm trap, missing FS file, `init` throw); `id` present when request-scoped |

The worker serializes requests itself (one WASM engine). Document assets are
fetched on the main thread _before_ `compile` is posted — `resolveFile`
needs `tdoc.files`/`pdoc.additional_file` and `fetchAsset` needs credentials —
so every byte arrives inside `files` and the worker performs zero fetches.

## Adapter semantics (`typst-compiler.ts`)

- `init()` is idempotent — concurrent calls share one boot; the same boot is
  reused by `compilePdf`.
- Boot = staged downloads (`wasm` → `fonts` → `packages`, each streamed with
  `loaded/total/percent` progress) → spawn worker → `init` handshake → `ready`.
- **Latest-wins, no cancellation**: each `compilePdf` gets a seq; a superseded
  request resolves `{status:'stale'}` (checked before posting and again at
  response time) — mid-flight WASM compiles are never torn down.
- **Retry**: any init failure (download error, worker `failed`/`error`) tears
  down the worker and resets state; the next `init()` starts fresh.
- **Diagnostics ≠ failures**: document problems (`typst-diagnostic`,
  `asset-unresolved`, `asset-fetch-failed`) resolve as
  `{status:'diagnostics'}`; infrastructure problems reject the promise.
- `exportTypstSource(document)` runs `buildTypstFiles` on the main thread,
  fetches assets, and zips the exact shadow-FS file set — no worker needed.
- `dispose()` rejects in-flight calls, terminates the worker, and latches —
  subsequent calls reject immediately.
- `createTypstPrintCompiler(options, internals)` accepts `createWorker`,
  `fetchStatic`, and `assetBase` overrides for tests; the default worker is
  `new Worker(new URL('./typst.worker.ts', import.meta.url), {type:'module'})`.

## Source assembly contract (`print-source.ts`)

Deterministic file names (the contract between main thread and worker FS):

| path                     | content                                                                    |
| ------------------------ | -------------------------------------------------------------------------- |
| `/main.typ`              | template entry: `#import preamble`, reads `content.json`, loops problems   |
| `/preamble.typ`          | fonts, page setup, `print-math`/`print-note`/`print-rule` helpers, headers |
| `/problem-N.typ`         | converted statement `N` (imports helpers from `preamble.typ`)              |
| `/extra-<sanitized>.typ` | converted extra sections (`-N` dedupe on id collisions)                    |
| `/notice.typ`            | contest notice — emitted only when non-blank                               |
| `/content.json`          | `PrintableContest` minus statement markdown + `file`/`hasNotice` wiring    |
| `/asset-<fnv1a8>.<ext>`  | fetched image/asset bytes (`PrintAssetRef.path`)                           |

Every compile replaces the worker FS (`resetShadow` + `mapShadow` of the full
file list), so removed problems/extras/assets can never leak into later PDFs.

## mitex vendoring

`vendored-package-registry.ts` implements the `PackageRegistry` contract
verified in `node_modules/@myriaddreamin/typst.ts/dist/esm/fs/package.mjs`:
`resolve({namespace:'preview', name:'mitex', version:'0.2.7'}, ctx)` untars the
vendored tarball into the access model via `ctx.untar(data, cb)` +
`am.insertFile(path, bytes, mtime)` and returns the extracted directory.
`unresolved()` returns `undefined` for every other spec — only mitex exists in
the registry, so papers compile fully offline.

The shipped file is named `.tarball`, not `.tar.gz`: servers/CDN attach
`Content-Encoding: gzip` to `.gz` URLs and `fetch` would transparently
decompress, handing `ctx.untar` raw tar. As a second layer,
`ensureGzippedTarball()` in `vendored-package-registry.ts` sniffs the staged
bytes at boot — gzip magic (`1f 8b`) passes through, `ustar` at offset 257 is
re-gzipped via `CompressionStream` before transfer to the worker.

## Static assets (`scripts/prepare-typst.mjs`)

`pnpm prepare:typst` (also wired into `pnpm build`) produces the gitignored
outputs below. Everything is SHA-256 pinned, skipped when the destination
already verifies, downloaded with retry, and written atomically.

| output                                          | source                                                           | SHA-256 (first 12) | size       |
| ----------------------------------------------- | ---------------------------------------------------------------- | ------------------ | ---------- |
| `public/typst/typst_ts_web_compiler_bg.wasm`    | `node_modules/@myriaddreamin/typst-ts-web-compiler` 0.7.0 `pkg/` | `1fc968438a67`     | 28,325,178 |
| `public/typst/packages/mitex-0.2.7.tarball`     | `packages.typst.org/preview/mitex-0.2.7.tar.gz`                  | `0159e214845e`     | 111,899    |
| `public/fonts/typst/LibertinusSerif-*.otf` (4)  | `typst/typst-assets` v0.13.1 `files/fonts/`                      | `fcf06307a773`…    | ~1.2 MB    |
| `public/fonts/typst/NewCMMath-*.otf` (3)        | same                                                             | `b2e655d5cae5`…    | ~3.5 MB    |
| `public/fonts/typst/DejaVuSansMono*.ttf` (4)    | same                                                             | `b4a6c3e4faab`…    | ~1.2 MB    |
| `public/fonts/typst/NotoSerifCJKsc-Regular.otf` | vendored `assets/fonts/` (upstream: `noto-cjk` `Serif2.003` zip) | `2a2eae2628df`     | 24,543,080 |
| `public/fonts/typst/NotoSansCJKsc-Regular.otf`  | vendored `assets/fonts/`                                         | `2c76254f6fc3`     | 16,437,364 |
| `public/fonts/typst/NotoSansCJKsc-Bold.otf`     | `notofonts/noto-cjk@Sans2.004` `Sans/OTF/SimplifiedChinese/`     | `b5f0d1a190a7`     | 17,002,248 |
| `public/fonts/typst/OFL.txt`                    | vendored `assets/fonts/noto-sans-cjk-OFL.txt`                    | `6a73f9541c2d`     | 4,301      |
| `public/fonts/typst/FONTLICENSES.txt`           | generated provenance note                                        | —                  | —          |

Font roles: Libertinus Serif = Latin body, Noto Serif CJK SC = CJK body,
NewCMMath = math, DejaVu Sans Mono = code, Noto Sans CJK SC = headings +
**bold CJK** (Typst never falls back across families for bold — the preamble
rebinds `strong`/`heading` to the sans family explicitly). Do NOT copy
upstream's SimSun/SimHei/SimKai (proprietary).

Runtime base URL: `getPrintAssetBase()` reads `NEXT_PUBLIC_PRINT_ASSET_PREFIX`
(set in `next.config.ts` to the same CDN prefix as the clangd assets); empty →
same-origin `public/` paths.

## typst.ts 0.7.0 API notes

- `createTypstCompiler()` → `compiler.init({ getModule, beforeBuild })`.
  `getModule()` returns `RequestInfo | URL | Response | BufferSource |
WebAssembly.Module` — the worker receives a pre-fetched `ArrayBuffer`.
- `beforeBuild` fns from `@myriaddreamin/typst.ts/options.init`:
  `disableDefaultFontAssets()`, `loadFonts((string|Uint8Array|LazyFont)[])`,
  `withAccessModel(am)`, `withPackageRegistry(registry)`.
- **No fonts are embedded.** Default init fetches the `text` asset group from
  jsDelivr at runtime — offline-hostile — so the worker
  `disableDefaultFontAssets()` + `loadFonts(transferredBuffers)`.
- Shadow FS: `mapShadow(path, Uint8Array|string)`, `unmapShadow`,
  `resetShadow`, `addSource`.
- Compile: `compile({ format: CompileFormatEnum.pdf, mainFilePath })` →
  `{ result?: Uint8Array; diagnostics?: (string|{package, path, severity,
range, message})[] }`.
- The renderer package (`@myriaddreamin/typst-ts-renderer`) is **not used**
  — nothing imports it (pnpm may still pull it in as an optional peer). The
  compiler emits PDF bytes directly and the existing React PDF viewer
  previews them; a renderer is only needed for canvas/SVG output.

## Template (`template/`)

`preamble.ts`/`main.ts` hold the original Typst template as TS string
constants. Key semantics verified in a Node harness: `set page(header:)`
installed at top level (inside a block it is scoped and dies); a `problem`
counter + state flag drive running headers on problem pages; dictionary
function members need `(dict.fn)(args)` call syntax; Typst `include` does not
share scope, so every generated source imports helpers explicitly.
Layout: A4, cover page (title/subtitle/date/notice), contest overview +
language/submission-name tables, per-problem metadata + statement pages,
extra sections, page numbers, running problem headers. Table labels ship in
zh/zh_TW/en; `kr`/`jp` papers fall back to the English label set and get
`lang: "ja"`/`"ko"` text for hyphenation.

## Diagnostics codes

`missing-problem`, `language-fallback`, `empty-statement`,
`asset-unresolved`, `asset-fetch-failed`, `unsupported-markdown`,
`overlong-code-line`, `typst-diagnostic`,
`internal-error` — see `model.ts` `PrintDiagnostic`. Math/LaTeX conversion
failures surface as `typst-diagnostic` from the mitex-backed compile.

## Tests

Node-safe unit tests: `build-printable-contest.test.ts` (draft defaults,
ordering, overrides, language fallback, limit/name/language formatting,
determinism), `markdown-to-typst.test.ts` (per-node Typst output, URL/asset
classification, diagnostics), `print-draft.test.ts` (patch/order/restore
semantics, dirty detection, letters, section ids), `print-source.test.ts`
(file-name/asset/dedupe contract), `typst-compiler.test.ts` (adapter driven
with a scripted `FakeWorker` — no real WASM, no network: idempotent init +
staged progress, download-failure and `failed`-message retry, latest-wins
staleness, transfer-list dedupe, asset-URL→`fetchAsset` wiring,
`asset-fetch-failed` diagnostics, typst-diagnostic mapping, empty documents,
dispose latching, worker-free zip export), `contest-asset-provider.test.ts`
(`file://`→URL resolution per scope), `print-download.test.ts` (filename
rule), `vendored-package-registry.test.ts` (tarball re-gzip), and
`fixtures/fixture.test.ts` (fixture/schema coherence).

Browser tests (vitest browser mode, Chromium):
`fixtures/mock-print-compiler.ts` exports `createMockPrintCompiler` for
`print-page.browser.test.tsx` (editor behavior, zh catalog, unsupported
gate) and `print-preview-panel.browser.test.tsx` (generate → progress →
preview → download, diagnostics, stale, init-failure retry, outdated badge,
object-URL revocation + dispose on unmount, empty contest, end-to-end
statement passthrough).

## Decision log

- **typst.ts `0.7.0` stable** (not `0.8.0-rc*`, not upstream's rc2).
- **Vendored mitex** via `VendoredPackageRegistry` — LAN/offline deployments
  cannot reach packages.typst.org.
- **Worker loading**: module worker via `new URL(…, import.meta.url)`;
  WASM/fonts/packages ship as static files under `public/` (clangd
  precedent), fetched on the main thread with progress, transferred as
  `ArrayBuffer`.
- **Default fonts disabled** (`disableDefaultFontAssets`) — the runtime must
  not reach a CDN for fonts.
- **Latest-wins over cancellation** — WASM compiles cannot be preempted;
  superseded requests resolve `stale`.
- **`submitFilenames` per language** keeps upstream's per-language submit-name
  table semantics; YCOJ derives defaults from `name` + language extension.
- **statement `language`** defaults to `zh`, picked via `parseProblemContent`
  (falls back per language availability → `language-fallback` diagnostic).
