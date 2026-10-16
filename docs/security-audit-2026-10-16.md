# Dependency security audit — 2026-10-16

## Scope and method

Reviewed `master` at `57742508`, including the local Next.js security update.
Scanned the complete frontend pnpm dependency graph and all backend Yarn
workspaces, including development dependencies. The backend scan used
`corepack yarn@4.9.2 npm audit --all --recursive --json`; the globally installed
Yarn 1 cannot correctly audit this Yarn 4 lockfile. The frontend scans used
`pnpm audit --json` and `pnpm audit --prod --json`.

The baseline contains 46 frontend vulnerability findings and 58 backend
vulnerability findings. Yarn additionally reports 13 package deprecations;
these are listed separately below. Counts include multiple affected release
lines for the same advisory. These scans are a review of known package
advisories and their repository call sites, not an exhaustive penetration test
of a deployed service. No production instance was attacked or modified.

For each finding, checked the vulnerable API and input requirements against
the application and the relevant transitive dependency source. Also inspected
the editor's CDN dependencies, which package-manager audit does not cover.
“No matching site path found” describes the checked source, not a guarantee
about independently installed plugins or future code.

## Fixed site paths

1. **Script execution through editor chart blocks.** `MarkdownEditor` accepts
   stored problem content through `ProblemEditForm` and `ProblemContentEditor`.
   md-editor-rt's default `echarts.parseOption` evaluates that content with
   `new Function`. An immediately invoked function in a fenced `echarts` block
   can therefore execute in the viewer's authenticated origin when they edit
   the content. `editor-config.ts` replaces this parser with
   `parseChartOptions`, which accepts only JSON objects. JSON chart options
   continue to work; JavaScript expressions and callback functions in chart
   definitions are intentionally rejected. The parser also forces non-HTML
   (`richText`) tooltips at every scope, rejects chart navigation links, and
   rejects the toolbox's trusted-HTML features. This closes the HTML formatter
   and data-view injection paths that would remain with plain `JSON.parse`.
2. **Executable raw HTML in editor previews.** The editor enables raw HTML and
   its default `sanitize` callback returns its input unchanged. Its exported
   `XSSPlugin` is optional and was not installed by the application. The shared
   editor configuration now installs it, removing HTML event handlers and
   unsafe URLs before the preview inserts the HTML. Normal formatting remains.
3. **Editor linkification CPU exhaustion**, [GHSA-253c-mchw-3w2r](https://github.com/advisories/GHSA-253c-mchw-3w2r).
   md-editor-rt explicitly enables `linkify: true`; it renders stored content on
   initial load and subsequent edits. Soft-broken email lists and repeated
   unrecognized URL schemes reach the reported quadratic paths. A scoped pnpm
   override upgrades only `md-editor-rt>markdown-it` from 14.3.0 to 14.3.1.
4. **Editor ECharts tooltip XSS**, [GHSA-fgmj-fm8m-jvvx](https://github.com/advisories/GHSA-fgmj-fm8m-jvvx).
   The editor loads ECharts 6.0.0 from unpkg independently of the lockfile and
   passes chart-block options to `setOption`. This allows the vulnerable
   `lines` series with attacker-controlled tooltip names. The editor CDN URL
   is pinned to the fixed 6.1.0 release. The separate PPTX renderer's installed
   ECharts 5.6.0 is assessed separately below.

The earlier Next.js upgrade to 16.4.1 also installs sharp 0.35.5 and matching
eslint-config-next 16.4.1, addressing the October 14 Next.js advisories.

## Frontend reachability decisions

| Package / path                                                                              | Finding disposition and evidence                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `md-editor-rt > markdown-it`                                                                | Fixed: preview enables linkification on content, including stored content.                                                                                                                                                                                                                             |
| `md-editor-rt` raw HTML and chart parsing                                                   | Fixed application configuration: HTML filter installed and executable chart parser removed.                                                                                                                                                                                                            |
| `md-editor-rt` CDN ECharts                                                                  | Fixed: 6.0.0 → 6.1.0. JSON options allow the advisory's `lines` series.                                                                                                                                                                                                                                |
| `@excalidraw/excalidraw > nanoid`                                                           | No matching site path found: Excalidraw's `randomId` and element creation call `nanoid()` without attacker-controlled size. The Mermaid converter also uses parameterless `nanoid()`; it does not expose `customRandom` or the non-secure generator to diagram data.                                   |
| `@excalidraw/mermaid-to-excalidraw > @mermaid-js/parser > langium > chevrotain > lodash-es` | No matching site path found: Chevrotain imports collection, lexer, and parser helpers, not `template`, `unset`, or `omit`. Diagram text cannot supply template import names or deletion paths to those vulnerable APIs.                                                                                |
| `mermaid > dompurify`                                                                       | No matching site path found for these five advisories: inspected Mermaid's sanitizer calls and hooks. They use normal string sanitization and before/after-attribute hooks, not `setConfig` plus allowlist mutation, caller-provided Trusted Types policies, `IN_PLACE`, or `CUSTOM_ELEMENT_HANDLING`. |
| `mermaid > katex`                                                                           | Conditional gadget; no preceding prototype-pollution path found. Mermaid sanitizes generated SVG in its normal strict mode. The application's direct KaTeX dependency is already 0.19.0.                                                                                                               |
| `pptx-preview > echarts`                                                                    | No matching site path found for the reported Lines-series XSS: the PPTX converter constructs `line`, `bar`, and `pie` series. `line` and `lines` are different ECharts series. It does not pass arbitrary ECharts options from a PPTX through to `setOption`.                                          |
| `pptx-preview > uuid`                                                                       | No matching site path found: imports only `v4`, invoked without an external output buffer. The advisory concerns `v3`/`v5`/`v6` with a supplied buffer.                                                                                                                                                |
| `ajv > fast-uri`                                                                            | No matching site path found: Ajv compiles the application's static problem-config schema. No user-defined schema loading or host allow/deny decision uses `fast-uri.parse`, `normalize`, or `equal`.                                                                                                   |
| `shadcn > @modelcontextprotocol/sdk`                                                        | No site OAuth path found. Application imports only `shadcn/tailwind.css`; there is no MCP OAuth client or server-selected authorization issuer in the site's code.                                                                                                                                     |
| `brace-expansion`, `braces`, `source-map-js`, `postcss-selector-parser`                     | Build/tool paths: ESLint, Prettier, Tailwind, shadcn, Sass, and sourcemap processing. No request handler or browser feature passes uploaded patterns, source maps, or CSS selectors to these packages. Do not run these tools on attacker-supplied projects as though the audit found them safe.       |
| `@codspeed/vitest-plugin > axios`                                                           | Development benchmark/reporting path; no application import. All 12 Axios findings require network operations, options, redirects, or polluted objects reaching that client. No site request routes reach it.                                                                                          |

## Backend reachability decisions

| Package / path                                                          | Finding disposition and evidence                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hydrooj > adm-zip`                                                     | No matching site path found: `src/libs.ts` only exports a deprecated compatibility alias. No checked-in caller constructs `AdmZip`. Problem imports, bulk submissions, and importer plugins use `@zip.js/zip.js`, not this package. External plugins using the alias must be assessed separately.                                                                                                                                                          |
| `hydrooj > tar`                                                         | Operator-only path: `src/commands/install.ts` extracts an administrator-selected addon archive from the CLI. No web upload handler uses node-tar. The 12 advisories remain relevant to malicious addon archives, so this is not a claim that CLI installation of untrusted addons is safe.                                                                                                                                                                 |
| `simple-git`, `@simple-git/argv-parser`                                 | No matching remote-input path found. `src/loader.ts` and `packages/ui-next/index.ts` call `log()`/`status()` on local checkouts. Site users do not supply Git options, environment variables, Git configuration, or repositories to these calls. The remaining critical advisories concern those operator-controlled inputs.                                                                                                                               |
| `hydrooj > nodemailer`                                                  | No matching site input found for the five advisories: register/reset/change-email routes validate recipients with `Types.Email` before `sendMail`. The regex excludes comments, whitespace, quoted local parts, malformed free text, and nested recipient arrays. `lib/mail.ts` uses one administrator-configured SMTP host/identity, not separate tenants with attacker-selected transports.                                                              |
| `hydrooj > @simplewebauthn/server`                                      | No site attestation-trust policy bypass identified: registration requires sudo, challenge verification, and the current user's session. The site accepts ordinary software/passkey authenticators and does not grant permissions based on certificate chain or authenticator vendor. This advisory does not bypass possession of another user's credential or a signed assertion. Reassess if hardware/vendor attestation becomes an authorization policy. |
| `@ai-sdk/openai > @ai-sdk/provider-utils > undici`                      | No matching site path found: the old provider is used by `lib/ai/html2md/converter.ts` with a string system prompt and string user prompt. It receives no image/file URL to its Undici download helper. Model API calls use the SDK's ordinary fetch path. The site's current `ai` package resolves a separate provider-utils release. No Undici WebSocket, cookie, retry-interceptor, or multipart-response consumer is exposed by the converter.         |
| `undici > @fastify/busboy`                                              | Same isolated download/multipart path; Hydro's multipart web request parser is not this transitive Busboy instance. No call to its affected response FormData parser was found in the converter.                                                                                                                                                                                                                                                           |
| `superagent-proxy > proxy-agent > http-proxy-agent > @tootallnate/once` | No matching AbortSignal path found: the old HTTP proxy agent does not supply the advisory's AbortSignal option to `once`. Proxy settings are operator-controlled.                                                                                                                                                                                                                                                                                          |
| `pac-resolver > ip`                                                     | No SSRF authorization boundary uses `ip.isPublic` or `ip.isPrivate`. PAC helpers use `ip.address()` for the machine's address and `netmask` for network membership; `ip` is not a user-URL safety gate.                                                                                                                                                                                                                                                    |
| `packages/migrate > mariadb`                                            | Administrative migration scripts only; no site request handler imports them. Their external database, SQL session modes, client charset, and connection/authentication settings are operator-controlled. The seven findings remain relevant to migrations involving untrusted servers or input; not declared fixed.                                                                                                                                        |
| `micromark-extension-math > katex`                                      | Conditional prototype-pollution gadget; no preceding pollution or attacker-controlled renderer-options prototype found. Separate from the already updated direct KaTeX dependency in the frontend.                                                                                                                                                                                                                                                         |
| `micromatch > braces`                                                   | Build/file-discovery path. No caller passes a site user's string as an unbounded brace pattern.                                                                                                                                                                                                                                                                                                                                                            |
| `argparse > sprintf-js`                                                 | CLI error/help formatting. No site user supplies a precision/format string to `sprintf`.                                                                                                                                                                                                                                                                                                                                                                   |
| `koa-proxies > uuid`                                                    | Proxy IDs use UUID v4, not the buffer-writing v3/v5/v6 APIs identified by the advisory.                                                                                                                                                                                                                                                                                                                                                                    |

## Verification

- Browser regression tests use the actual md-editor-rt renderer. They check
  that HTML event attributes are removed, chart JavaScript does not execute,
  and valid JSON charts still reach the chart renderer. The chart drawing
  instance is stubbed so these tests do not download CDN scripts.
- The two linkification payload families run with the exact markdown-it
  resolved from md-editor-rt in disposable Node subprocesses with a 5-second
  timeout. They retain automatic email links and normal text output.
- Chart-option tests cover HTML tooltips at global, series, and data-point
  scopes, malicious links and data-view HTML, invalid/prototype-bearing JSON,
  ordinary chart data with disabled tooltips, and defaults inside timeline
  `baseOption` containers.
- Final test run: 1,370 unit tests and 864 Chromium browser tests passed
  (2,234 total). ESLint, Prettier, and TypeScript checks passed. The ECharts
  6.1.0 CDN asset was checked and returned HTTP 200 with a JavaScript content
  type.
- Frontend lint, formatting, TypeScript, the complete test suite, frozen-lockfile
  installation, and a production build are checked after the changes. Build
  verification uses `BACKEND_BASEURL=http://127.0.0.1:8888` for valid rewrites.
- No backend runtime code or API contract changed, so backend contract
  documentation does not require synchronization for this fix.

## Complete finding inventory

The following inventory records every baseline vulnerability finding, including
unchanged findings. Dispositions reference the package/path assessments above.

### Frontend baseline

| Package                   | Version | Severity | Advisory                                                                 | Disposition                                                                  |
| ------------------------- | ------- | -------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| nanoid                    | 3.3.3   | moderate | [GHSA-mwcw-c2x4-8c55](https://github.com/advisories/GHSA-mwcw-c2x4-8c55) | No matching size-controlled generator call                                   |
| nanoid                    | 4.0.2   | moderate | [GHSA-mwcw-c2x4-8c55](https://github.com/advisories/GHSA-mwcw-c2x4-8c55) | No matching size-controlled generator call                                   |
| lodash-es                 | 4.17.21 | high     | [GHSA-r5fr-rjxr-66jc](https://github.com/advisories/GHSA-r5fr-rjxr-66jc) | Vulnerable template/deletion APIs not used by parser                         |
| lodash-es                 | 4.17.21 | moderate | [GHSA-f23m-r3pf-42rh](https://github.com/advisories/GHSA-f23m-r3pf-42rh) | Vulnerable template/deletion APIs not used by parser                         |
| uuid                      | 10.0.0  | moderate | [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq) | Only parameterless UUID v4 used                                              |
| lodash-es                 | 4.17.21 | moderate | [GHSA-xxjr-mmjv-4gpg](https://github.com/advisories/GHSA-xxjr-mmjv-4gpg) | Vulnerable template/deletion APIs not used by parser                         |
| echarts                   | 5.6.0   | moderate | [GHSA-fgmj-fm8m-jvvx](https://github.com/advisories/GHSA-fgmj-fm8m-jvvx) | PPTX path has no lines series; editor CDN path fixed separately              |
| dompurify                 | 3.4.8   | moderate | [GHSA-cmwh-pvxp-8882](https://github.com/advisories/GHSA-cmwh-pvxp-8882) | Required persistent-config / hook / IN_PLACE / custom-element options absent |
| dompurify                 | 3.4.8   | low      | [GHSA-vxr8-fq34-vvx9](https://github.com/advisories/GHSA-vxr8-fq34-vvx9) | Required persistent-config / hook / IN_PLACE / custom-element options absent |
| dompurify                 | 3.4.8   | moderate | [GHSA-55q2-fjhq-7xh7](https://github.com/advisories/GHSA-55q2-fjhq-7xh7) | Required persistent-config / hook / IN_PLACE / custom-element options absent |
| nanoid                    | 4.0.2   | high     | [GHSA-28wg-ghj8-5hjv](https://github.com/advisories/GHSA-28wg-ghj8-5hjv) | No matching size-controlled generator call                                   |
| nanoid                    | 3.3.3   | high     | [GHSA-28wg-ghj8-5hjv](https://github.com/advisories/GHSA-28wg-ghj8-5hjv) | No matching size-controlled generator call                                   |
| nanoid                    | 3.3.3   | high     | [GHSA-2v37-7h3g-55p8](https://github.com/advisories/GHSA-2v37-7h3g-55p8) | No matching size-controlled generator call                                   |
| nanoid                    | 4.0.2   | high     | [GHSA-2v37-7h3g-55p8](https://github.com/advisories/GHSA-2v37-7h3g-55p8) | No matching size-controlled generator call                                   |
| nanoid                    | 4.0.2   | high     | [GHSA-xwg4-73v4-xw9w](https://github.com/advisories/GHSA-xwg4-73v4-xw9w) | No matching size-controlled generator call                                   |
| nanoid                    | 3.3.3   | high     | [GHSA-xwg4-73v4-xw9w](https://github.com/advisories/GHSA-xwg4-73v4-xw9w) | No matching size-controlled generator call                                   |
| markdown-it               | 14.3.0  | moderate | [GHSA-253c-mchw-3w2r](https://github.com/advisories/GHSA-253c-mchw-3w2r) | Fixed: scoped override to 14.3.1                                             |
| fast-uri                  | 3.1.7   | moderate | [GHSA-hrr3-gc8f-f4qj](https://github.com/advisories/GHSA-hrr3-gc8f-f4qj) | Static schema; no host security decision                                     |
| brace-expansion           | 1.1.18  | moderate | [GHSA-q2hr-2g5m-vwhr](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr) | Build and tooling inputs only                                                |
| brace-expansion           | 2.1.4   | moderate | [GHSA-q2hr-2g5m-vwhr](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr) | Build and tooling inputs only                                                |
| brace-expansion           | 5.0.9   | moderate | [GHSA-q2hr-2g5m-vwhr](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr) | Build and tooling inputs only                                                |
| brace-expansion           | 1.1.18  | high     | [GHSA-qhr7-859c-m2p7](https://github.com/advisories/GHSA-qhr7-859c-m2p7) | Build and tooling inputs only                                                |
| brace-expansion           | 2.1.4   | high     | [GHSA-qhr7-859c-m2p7](https://github.com/advisories/GHSA-qhr7-859c-m2p7) | Build and tooling inputs only                                                |
| brace-expansion           | 5.0.9   | high     | [GHSA-qhr7-859c-m2p7](https://github.com/advisories/GHSA-qhr7-859c-m2p7) | Build and tooling inputs only                                                |
| brace-expansion           | 1.1.18  | high     | [GHSA-6j4f-fj2g-mc7p](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p) | Build and tooling inputs only                                                |
| brace-expansion           | 2.1.4   | high     | [GHSA-6j4f-fj2g-mc7p](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p) | Build and tooling inputs only                                                |
| brace-expansion           | 5.0.9   | high     | [GHSA-6j4f-fj2g-mc7p](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p) | Build and tooling inputs only                                                |
| axios                     | 1.19.0  | moderate | [GHSA-vh66-26gq-q6x8](https://github.com/advisories/GHSA-vh66-26gq-q6x8) | CodSpeed development tooling only                                            |
| axios                     | 1.19.0  | moderate | [GHSA-9fr6-4gfg-395g](https://github.com/advisories/GHSA-9fr6-4gfg-395g) | CodSpeed development tooling only                                            |
| axios                     | 1.19.0  | high     | [GHSA-c29m-xwm3-cm6r](https://github.com/advisories/GHSA-c29m-xwm3-cm6r) | CodSpeed development tooling only                                            |
| axios                     | 1.19.0  | high     | [GHSA-mghh-pgcx-3jjj](https://github.com/advisories/GHSA-mghh-pgcx-3jjj) | CodSpeed development tooling only                                            |
| axios                     | 1.19.0  | high     | [GHSA-x97p-jq2g-jp4f](https://github.com/advisories/GHSA-x97p-jq2g-jp4f) | CodSpeed development tooling only                                            |
| axios                     | 1.19.0  | high     | [GHSA-3pq3-5fj3-cg6v](https://github.com/advisories/GHSA-3pq3-5fj3-cg6v) | CodSpeed development tooling only                                            |
| axios                     | 1.19.0  | high     | [GHSA-542g-h47m-68v8](https://github.com/advisories/GHSA-542g-h47m-68v8) | CodSpeed development tooling only                                            |
| axios                     | 1.19.0  | moderate | [GHSA-j8rh-479h-cp32](https://github.com/advisories/GHSA-j8rh-479h-cp32) | CodSpeed development tooling only                                            |
| axios                     | 1.19.0  | moderate | [GHSA-4hqw-qxg8-jxx2](https://github.com/advisories/GHSA-4hqw-qxg8-jxx2) | CodSpeed development tooling only                                            |
| axios                     | 1.19.0  | high     | [GHSA-m8m8-qj5v-23w3](https://github.com/advisories/GHSA-m8m8-qj5v-23w3) | CodSpeed development tooling only                                            |
| axios                     | 1.19.0  | moderate | [GHSA-44g4-m2mj-wpvx](https://github.com/advisories/GHSA-44g4-m2mj-wpvx) | CodSpeed development tooling only                                            |
| axios                     | 1.19.0  | high     | [GHSA-r4gj-5m52-g5wh](https://github.com/advisories/GHSA-r4gj-5m52-g5wh) | CodSpeed development tooling only                                            |
| dompurify                 | 3.4.8   | low      | [GHSA-c2j3-45gr-mqc4](https://github.com/advisories/GHSA-c2j3-45gr-mqc4) | Required persistent-config / hook / IN_PLACE / custom-element options absent |
| braces                    | 3.0.3   | high     | [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) | Build and tooling inputs only                                                |
| dompurify                 | 3.4.8   | low      | [GHSA-6688-9rhm-gjv2](https://github.com/advisories/GHSA-6688-9rhm-gjv2) | Required persistent-config / hook / IN_PLACE / custom-element options absent |
| katex                     | 0.16.47 | low      | [GHSA-238p-pmpm-9mq7](https://github.com/advisories/GHSA-238p-pmpm-9mq7) | No preceding prototype-pollution path found                                  |
| source-map-js             | 1.2.1   | high     | [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) | Build-time source maps only                                                  |
| postcss-selector-parser   | 6.0.10  | moderate | [GHSA-rj75-hqrm-r3gf](https://github.com/advisories/GHSA-rj75-hqrm-r3gf) | Tailwind build-time selectors only                                           |
| @modelcontextprotocol/sdk | 1.30.0  | high     | [GHSA-6qxp-vccf-f47h](https://github.com/advisories/GHSA-6qxp-vccf-f47h) | No application MCP OAuth client                                              |

### Backend baseline

| Package                 | Version | Severity | Advisory                                                                 | Disposition                                                                       |
| ----------------------- | ------- | -------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| @fastify/busboy         | 2.1.1   | high     | [GHSA-x8mw-p69m-v3mx](https://github.com/advisories/GHSA-x8mw-p69m-v3mx) | No converter response-FormData path; not Hydro upload parser                      |
| @fastify/busboy         | 2.1.1   | moderate | [GHSA-gxm5-99cw-xjw9](https://github.com/advisories/GHSA-gxm5-99cw-xjw9) | No converter response-FormData path; not Hydro upload parser                      |
| @simple-git/argv-parser | 1.1.1   | critical | [GHSA-v5rq-49vh-5v5c](https://github.com/advisories/GHSA-v5rq-49vh-5v5c) | Local checkout metadata only; no site-controlled options/env                      |
| @simplewebauthn/server  | 13.2.2  | low      | [GHSA-6hxq-p678-4hr2](https://github.com/advisories/GHSA-6hxq-p678-4hr2) | No authenticator certificate-chain authorization policy                           |
| @tootallnate/once       | 1.1.2   | low      | [GHSA-vpq2-c234-7xj6](https://github.com/advisories/GHSA-vpq2-c234-7xj6) | Caller does not pass AbortSignal                                                  |
| adm-zip                 | 0.5.16  | high     | [GHSA-xcpc-8h2w-3j85](https://github.com/advisories/GHSA-xcpc-8h2w-3j85) | Compatibility export only; site imports use zip.js                                |
| adm-zip                 | 0.5.16  | moderate | [GHSA-vwc7-r8mq-g2x9](https://github.com/advisories/GHSA-vwc7-r8mq-g2x9) | Compatibility export only; site imports use zip.js                                |
| adm-zip                 | 0.5.16  | high     | [GHSA-7q85-xj36-vmfc](https://github.com/advisories/GHSA-7q85-xj36-vmfc) | Compatibility export only; site imports use zip.js                                |
| adm-zip                 | 0.5.16  | high     | [GHSA-rcw4-f5rp-g42v](https://github.com/advisories/GHSA-rcw4-f5rp-g42v) | Compatibility export only; site imports use zip.js                                |
| adm-zip                 | 0.5.16  | high     | [GHSA-j5f4-cc29-5x44](https://github.com/advisories/GHSA-j5f4-cc29-5x44) | Compatibility export only; site imports use zip.js                                |
| adm-zip                 | 0.5.16  | moderate | [GHSA-p634-w6r4-rjp2](https://github.com/advisories/GHSA-p634-w6r4-rjp2) | Compatibility export only; site imports use zip.js                                |
| adm-zip                 | 0.5.16  | moderate | [GHSA-c6fg-446q-cg94](https://github.com/advisories/GHSA-c6fg-446q-cg94) | Compatibility export only; site imports use zip.js                                |
| adm-zip                 | 0.5.16  | high     | [GHSA-8238-w5pm-2374](https://github.com/advisories/GHSA-8238-w5pm-2374) | Compatibility export only; site imports use zip.js                                |
| braces                  | 3.0.3   | high     | [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) | Build/file-discovery input only                                                   |
| ip                      | 1.1.9   | high     | [GHSA-2p57-rm9w-gvfp](https://github.com/advisories/GHSA-2p57-rm9w-gvfp) | No isPublic/isPrivate SSRF authorization gate                                     |
| katex                   | 0.16.47 | low      | [GHSA-238p-pmpm-9mq7](https://github.com/advisories/GHSA-238p-pmpm-9mq7) | No preceding prototype-pollution path found                                       |
| mariadb                 | 3.4.5   | high     | [GHSA-cqhc-2h57-wpxf](https://github.com/advisories/GHSA-cqhc-2h57-wpxf) | Operator-only database migrations; risks remain for those operations              |
| mariadb                 | 3.4.5   | moderate | [GHSA-42r5-vhpq-m858](https://github.com/advisories/GHSA-42r5-vhpq-m858) | Operator-only database migrations; risks remain for those operations              |
| mariadb                 | 3.4.5   | moderate | [GHSA-g5xc-5w98-jfvm](https://github.com/advisories/GHSA-g5xc-5w98-jfvm) | Operator-only database migrations; risks remain for those operations              |
| mariadb                 | 3.4.5   | high     | [GHSA-r3rv-jm3r-62q2](https://github.com/advisories/GHSA-r3rv-jm3r-62q2) | Operator-only database migrations; risks remain for those operations              |
| mariadb                 | 3.4.5   | high     | [GHSA-v6pj-gxxw-phfw](https://github.com/advisories/GHSA-v6pj-gxxw-phfw) | Operator-only database migrations; risks remain for those operations              |
| mariadb                 | 3.4.5   | high     | [GHSA-48qf-xh34-q73r](https://github.com/advisories/GHSA-48qf-xh34-q73r) | Operator-only database migrations; risks remain for those operations              |
| mariadb                 | 3.4.5   | moderate | [GHSA-cx2f-j9fh-8g68](https://github.com/advisories/GHSA-cx2f-j9fh-8g68) | Operator-only database migrations; risks remain for those operations              |
| nodemailer              | 9.1.1   | moderate | [GHSA-6vj9-mwq6-2f5v](https://github.com/advisories/GHSA-6vj9-mwq6-2f5v) | Strict recipient validation; no untrusted SMTP transport or nested address arrays |
| nodemailer              | 9.1.1   | moderate | [GHSA-8vvx-rff5-p5rq](https://github.com/advisories/GHSA-8vvx-rff5-p5rq) | Strict recipient validation; no untrusted SMTP transport or nested address arrays |
| nodemailer              | 9.1.1   | moderate | [GHSA-g57g-f23g-4646](https://github.com/advisories/GHSA-g57g-f23g-4646) | Strict recipient validation; no untrusted SMTP transport or nested address arrays |
| nodemailer              | 9.1.1   | high     | [GHSA-v53p-9fqp-m79j](https://github.com/advisories/GHSA-v53p-9fqp-m79j) | Strict recipient validation; no untrusted SMTP transport or nested address arrays |
| nodemailer              | 9.1.1   | high     | [GHSA-prgh-xp8r-p3m5](https://github.com/advisories/GHSA-prgh-xp8r-p3m5) | Strict recipient validation; no untrusted SMTP transport or nested address arrays |
| simple-git              | 3.36.0  | critical | [GHSA-x6jw-m9v5-85vh](https://github.com/advisories/GHSA-x6jw-m9v5-85vh) | Local checkout metadata only; no site-controlled options/env                      |
| simple-git              | 3.36.0  | high     | [GHSA-g4wm-2vf7-vfgr](https://github.com/advisories/GHSA-g4wm-2vf7-vfgr) | Local checkout metadata only; no site-controlled options/env                      |
| simple-git              | 3.36.0  | high     | [GHSA-858h-whjf-mvg5](https://github.com/advisories/GHSA-858h-whjf-mvg5) | Local checkout metadata only; no site-controlled options/env                      |
| sprintf-js              | 1.0.3   | moderate | [GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c) | CLI formatting; no user-supplied precision strings                                |
| tar                     | 6.2.1   | high     | [GHSA-34x7-hfp2-rc4v](https://github.com/advisories/GHSA-34x7-hfp2-rc4v) | Operator-only addon installation; archive risks remain for that operation         |
| tar                     | 6.2.1   | high     | [GHSA-8qq5-rm4j-mr97](https://github.com/advisories/GHSA-8qq5-rm4j-mr97) | Operator-only addon installation; archive risks remain for that operation         |
| tar                     | 6.2.1   | high     | [GHSA-83g3-92jg-28cx](https://github.com/advisories/GHSA-83g3-92jg-28cx) | Operator-only addon installation; archive risks remain for that operation         |
| tar                     | 6.2.1   | high     | [GHSA-qffp-2rhf-9h96](https://github.com/advisories/GHSA-qffp-2rhf-9h96) | Operator-only addon installation; archive risks remain for that operation         |
| tar                     | 6.2.1   | high     | [GHSA-9ppj-qmqm-q256](https://github.com/advisories/GHSA-9ppj-qmqm-q256) | Operator-only addon installation; archive risks remain for that operation         |
| tar                     | 6.2.1   | high     | [GHSA-r6q2-hw4h-h46w](https://github.com/advisories/GHSA-r6q2-hw4h-h46w) | Operator-only addon installation; archive risks remain for that operation         |
| tar                     | 6.2.1   | moderate | [GHSA-vmf3-w455-68vh](https://github.com/advisories/GHSA-vmf3-w455-68vh) | Operator-only addon installation; archive risks remain for that operation         |
| tar                     | 6.2.1   | moderate | [GHSA-w8wr-v893-vjvp](https://github.com/advisories/GHSA-w8wr-v893-vjvp) | Operator-only addon installation; archive risks remain for that operation         |
| tar                     | 6.2.1   | critical | [GHSA-23hp-3jrh-7fpw](https://github.com/advisories/GHSA-23hp-3jrh-7fpw) | Operator-only addon installation; archive risks remain for that operation         |
| tar                     | 6.2.1   | high     | [GHSA-8x88-c5mf-7j5w](https://github.com/advisories/GHSA-8x88-c5mf-7j5w) | Operator-only addon installation; archive risks remain for that operation         |
| tar                     | 6.2.1   | moderate | [GHSA-gvwx-54wh-qm9j](https://github.com/advisories/GHSA-gvwx-54wh-qm9j) | Operator-only addon installation; archive risks remain for that operation         |
| tar                     | 6.2.1   | high     | [GHSA-r292-9mhp-454m](https://github.com/advisories/GHSA-r292-9mhp-454m) | Operator-only addon installation; archive risks remain for that operation         |
| undici                  | 5.29.0  | moderate | [GHSA-g9mf-h72j-4rw9](https://github.com/advisories/GHSA-g9mf-h72j-4rw9) | Old provider gets string prompts; no download/WebSocket/cookie/retry path         |
| undici                  | 5.29.0  | moderate | [GHSA-2mjp-6q6p-2qxm](https://github.com/advisories/GHSA-2mjp-6q6p-2qxm) | Old provider gets string prompts; no download/WebSocket/cookie/retry path         |
| undici                  | 5.29.0  | high     | [GHSA-vrm6-8vpv-qv8q](https://github.com/advisories/GHSA-vrm6-8vpv-qv8q) | Old provider gets string prompts; no download/WebSocket/cookie/retry path         |
| undici                  | 5.29.0  | high     | [GHSA-v9p9-hfj2-hcw8](https://github.com/advisories/GHSA-v9p9-hfj2-hcw8) | Old provider gets string prompts; no download/WebSocket/cookie/retry path         |
| undici                  | 5.29.0  | moderate | [GHSA-4992-7rv2-5pvq](https://github.com/advisories/GHSA-4992-7rv2-5pvq) | Old provider gets string prompts; no download/WebSocket/cookie/retry path         |
| undici                  | 5.29.0  | moderate | [GHSA-p88m-4jfj-68fv](https://github.com/advisories/GHSA-p88m-4jfj-68fv) | Old provider gets string prompts; no download/WebSocket/cookie/retry path         |
| undici                  | 5.29.0  | high     | [GHSA-vxpw-j846-p89q](https://github.com/advisories/GHSA-vxpw-j846-p89q) | Old provider gets string prompts; no download/WebSocket/cookie/retry path         |
| undici                  | 5.29.0  | low      | [GHSA-g8m3-5g58-fq7m](https://github.com/advisories/GHSA-g8m3-5g58-fq7m) | Old provider gets string prompts; no download/WebSocket/cookie/retry path         |
| undici                  | 5.29.0  | moderate | [GHSA-8xcm-r25x-g524](https://github.com/advisories/GHSA-8xcm-r25x-g524) | Old provider gets string prompts; no download/WebSocket/cookie/retry path         |
| undici                  | 5.29.0  | moderate | [GHSA-m8rv-5g2x-5cg5](https://github.com/advisories/GHSA-m8rv-5g2x-5cg5) | Old provider gets string prompts; no download/WebSocket/cookie/retry path         |
| undici                  | 5.29.0  | moderate | [GHSA-v3r7-h72x-cjcm](https://github.com/advisories/GHSA-v3r7-h72x-cjcm) | Old provider gets string prompts; no download/WebSocket/cookie/retry path         |
| undici                  | 5.29.0  | low      | [GHSA-35p6-xmwp-9g52](https://github.com/advisories/GHSA-35p6-xmwp-9g52) | Old provider gets string prompts; no download/WebSocket/cookie/retry path         |
| undici                  | 5.29.0  | low      | [GHSA-r53p-7pc4-xj5r](https://github.com/advisories/GHSA-r53p-7pc4-xj5r) | Old provider gets string prompts; no download/WebSocket/cookie/retry path         |
| uuid                    | 8.3.2   | moderate | [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq) | Proxy uses UUID v4, not v3/v5/v6 external-buffer APIs                             |

### Backend deprecation notices

These are maintenance notices, not additional verified security advisories.

| Package                 | Version | Notice                                                                                                                                                                                                                                              |
| ----------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| @cordisjs/plugin-logger | 1.0.2   | use @cordisjs/plugin-logger-console instead                                                                                                                                                                                                         |
| @types/diff             | 8.0.0   | This is a stub types definition. diff provides its own type definitions, so you do not need this installed.                                                                                                                                         |
| @types/uuid             | 11.0.0  | This is a stub types definition. uuid provides its own type definitions, so you do not need this installed.                                                                                                                                         |
| crypto-js               | 4.2.0   | Active development of CryptoJS has been discontinued. This library is no longer maintained.                                                                                                                                                         |
| deep-diff               | 0.3.8   | Package no longer supported. Contact Support at https://www.npmjs.com/support for more info.                                                                                                                                                        |
| eslint                  | 9.39.5  | This version is no longer supported. Please see https://eslint.org/version-support for other options.                                                                                                                                               |
| glob                    | 7.2.3   | Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me |
| inflight                | 1.0.6   | This module is not supported, and leaks memory. Do not use it. Check out lru-cache if you want a good and tested way to coalesce async requests by a key value, which is much more comprehensive and powerful.                                      |
| node-domexception       | 1.0.0   | Use your platform's native DOMException instead                                                                                                                                                                                                     |
| path-match              | 1.2.4   | This package is archived and no longer maintained. For support, visit https://github.com/expressjs/express/discussions                                                                                                                              |
| prom-client             | 15.1.3  | prom-client has been replaced by @prometheus-io/client                                                                                                                                                                                              |
| rimraf                  | 2.7.1   | Rimraf versions prior to v4 are no longer supported                                                                                                                                                                                                 |
| whatwg-encoding         | 3.1.1   | Use @exodus/bytes instead for a more spec-conformant and faster implementation                                                                                                                                                                      |

### Residual scan results

After the scoped markdown-it upgrade, the complete frontend scan reports 45 findings: 23 high, 18 moderate, and 4 low. The production-only frontend scan reports 26 findings: 12 high, 10 moderate, and 4 low. The backend dependency graph is unchanged and retains the 58 findings assessed above. Package-manager scans do not reflect the two application-configuration XSS fixes or the CDN ECharts upgrade. Retained findings are not suppressed or reclassified in audit tooling.
