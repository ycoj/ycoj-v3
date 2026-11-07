import withNextIntl from './next-intl.config';
import { normalizeAssetPrefix } from './shared/lib/asset-prefix';
import { buildLegacyRedirects } from './shared/lib/legacy-routes';
import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';
import { execFileSync } from 'node:child_process';

// keep in sync with CLANGD_ISOLATION_PARAM in
// features/problem/scratchpad/clangd/clangd-support.ts (feature TS is not
// imported here to keep the build-time config dependency-free)
const CLANGD_ISOLATION_PARAM = 'clangd';

const standalone = process.env.YCOJ_STANDALONE === '1';
const backendBaseUrl = process.env.BACKEND_BASEURL?.replace(/\/+$/, '');
const uploadBaseUrl =
  process.env.NEXT_PUBLIC_UPLOAD_BASEURL?.replace(/\/+$/, '') ?? '';

// Commit of the checkout being built. It is inlined into the client bundle so
// users on a stale cached bundle report the code they actually run.
// BUILD_COMMIT/BUILD_DATE override it for builds without a Git checkout.
const readBuildCommit = () => {
  try {
    const [commit = '', date = ''] = execFileSync(
      'git',
      ['log', '-1', '--format=%h %cs'],
      { cwd: __dirname, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    )
      .trim()
      .split(' ');
    return { commit, date };
  } catch {
    return { commit: '', date: '' };
  }
};
const buildCommit = readBuildCommit();

function assetPrefixForPhase(phase: string): string {
  // Dev chunks and the HMR socket are not on the CDN. Leave ASSET_PREFIX set
  // in a shared env without redirecting `next dev` at it.
  if (phase === PHASE_DEVELOPMENT_SERVER) return '';
  return normalizeAssetPrefix(process.env.ASSET_PREFIX) ?? '';
}

function createNextConfig(phase: string): NextConfig {
  // `/_next/static` only. Page, RSC, `/api`, and the `/_next/image` optimizer
  // stay on the site origin; `images.path` is left at its default. A
  // standalone build freezes this string into `server.js`, so the production
  // process does not read ASSET_PREFIX again.
  const assetPrefix = assetPrefixForPhase(phase);

  const nextConfig: NextConfig = {
    assetPrefix,
    output: standalone ? 'standalone' : undefined,
    outputFileTracingRoot: standalone ? __dirname : undefined,
    serverExternalPackages: ['@resvg/resvg-js'],
    // LAN dev access: requests to dev-only resources (HMR socket, _next assets)
    // from other devices carry the machine's private address as their origin.
    allowedDevOrigins: [
      '10.*.*.*',
      '192.168.*.*',
      ...Array.from({ length: 16 }, (_, i) => `172.${16 + i}.*.*`),
      '*.local',
    ],
    experimental: {
      // Worker entrypoints and their imported chunks must share the page origin.
      turbopackWorkerAssetPrefix: '',
      // proxy.ts makes Next buffer request bodies before the backend rewrites;
      // keep /api file uploads (imports, bulk submits) above the 10MB default.
      // Bodies past this size are silently truncated, not rejected. Uploads use
      // the visiting origin by default so branded domains retain their session.
      // NEXT_PUBLIC_UPLOAD_BASEURL can opt into direct cross-origin uploads.
      proxyClientMaxBodySize: '256mb',
    },
    outputFileTracingIncludes: {
      '/*': [
        './node_modules/vscode-oniguruma/release/onig.wasm',
        './node_modules/.pnpm/vscode-oniguruma@*/node_modules/vscode-oniguruma/release/onig.wasm',
      ],
      '/scoreboard-export/*/*': [
        './assets/fonts/NotoSansCJKsc-Regular.otf',
        './assets/fonts/noto-sans-cjk-OFL.txt',
      ],
    },
    env: {
      NEXT_PUBLIC_UPLOAD_BASEURL: uploadBaseUrl,
      SITE_NAME: process.env.SITE_NAME ?? '',
      BUILD_COMMIT: process.env.BUILD_COMMIT ?? buildCommit.commit,
      BUILD_DATE: process.env.BUILD_DATE ?? buildCommit.date,
    },
    async redirects() {
      // Legacy page deep links → new UI routes. The table lives in
      // shared/lib/legacy-routes.ts so it is unit-tested; it deliberately
      // excludes protocol paths (downloads, raw bodies, OAuth), which are
      // rewrites below, not page redirects. Order matters: the first match wins.
      return buildLegacyRedirects();
    },
    async headers() {
      const isolationHeaders = [
        { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        { key: 'Cross-Origin-Embedder-Policy', value: 'credentialless' },
      ];
      return [
        {
          source: '/vendor/:path*',
          headers: [
            { key: 'Access-Control-Allow-Origin', value: '*' },
            { key: 'Cross-Origin-Resource-Policy', value: 'cross-origin' },
            {
              key: 'Cache-Control',
              value: 'public, max-age=31536000, immutable',
            },
          ],
        },
        // Cross-origin isolation is only required by the optional clangd Wasm
        // mode, so it is gated on the opt-in query parameter. `has` query
        // matching applies to full document loads only; client-side soft
        // navigations keep the headers of the originally loaded document. That
        // is graceful: the client-side getClangdSupport() fallback reports
        // 'unsupported' whenever the loaded document is not cross-origin
        // isolated. A cookie-based `has` match would have the same limitation.
        {
          source: '/problem/:path*',
          has: [{ type: 'query', key: CLANGD_ISOLATION_PARAM, value: '1' }],
          headers: isolationHeaders,
        },
        {
          source: '/clangd/:path*',
          headers: [
            ...isolationHeaders,
            { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
          ],
        },
        {
          source: '/clangd/v2/:path*',
          headers: [
            {
              key: 'Cache-Control',
              value: 'public, max-age=31536000, immutable',
            },
          ],
        },
        // Generated print assets are large (compiler wasm, CJK fonts) and
        // content-pinned by scripts/prepare-typst.mjs — cache them hard.
        {
          source: '/typst/:path*',
          headers: [
            {
              key: 'Cache-Control',
              value: 'public, max-age=31536000, immutable',
            },
          ],
        },
        {
          source: '/fonts/typst/:path*',
          headers: [
            {
              key: 'Cache-Control',
              value: 'public, max-age=31536000, immutable',
            },
          ],
        },
      ];
    },
    async rewrites() {
      return [
        {
          source: '/paste/:id/raw',
          destination: `${backendBaseUrl}/paste/:id/raw`,
        },
        {
          // OAuth start and callback must reach the backend: the start handler
          // answers with a 302 to the provider, and the callback needs the
          // backend session cookie. A page redirect here would break the flow.
          source: '/oauth/:path*',
          destination: `${backendBaseUrl}/oauth/:path*`,
        },
        {
          source: '/api/:path*',
          destination: `${backendBaseUrl}/:path*`,
        },
        {
          source: '/fs/:path*',
          destination: `${backendBaseUrl}/fs/:path*`,
        },
        {
          // Signed local-storage downloads. The backend answers with
          // `Location: /storage?...`; that link is followed by the browser on
          // this origin, so it has to be forwarded byte-for-byte.
          source: '/storage/:path*',
          destination: `${backendBaseUrl}/storage/:path*`,
        },
        {
          // Legacy personal-file downloads (`/file/:uid/:filename`) and avatars.
          // `/file` itself is a new UI page and is not matched (`:path+`).
          source: '/file/:path+',
          destination: `${backendBaseUrl}/file/:path+`,
        },
      ];
    },
  };

  return withNextIntl(nextConfig);
}

export default createNextConfig;
