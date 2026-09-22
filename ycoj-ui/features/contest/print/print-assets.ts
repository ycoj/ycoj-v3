import type { PrintSupport } from './compiler';

/**
 * Public-asset manifest produced by `scripts/prepare-typst.mjs`. Paths are
 * appended to `getPrintAssetBase()` which honors
 * `NEXT_PUBLIC_PRINT_ASSET_PREFIX` (defaults to the deployment `assetPrefix`,
 * i.e. CDN in production and same-origin in development).
 */

/** Typst web-compiler wasm binary (from `@myriaddreamin/typst-ts-web-compiler`). */
export const PRINT_COMPILER_WASM_PATH = '/typst/typst_ts_web_compiler_bg.wasm';

/** Vendored Typst packages served as tarballs for `VendoredPackageRegistry`. */
export type PrintPackageAsset = {
  spec: { namespace: string; name: string; version: string };
  /** File name under `/typst/packages/`. */
  file: string;
};

export const PRINT_PACKAGE_ASSETS: readonly PrintPackageAsset[] = [
  {
    spec: { namespace: 'preview', name: 'mitex', version: '0.2.7' },
    // Deliberately NOT a *.tar.gz name: servers/CDN attach
    // `Content-Encoding: gzip` to .gz files and the browser would
    // transparently decompress, handing the worker raw tar bytes.
    file: 'mitex-0.2.7.tarball',
  },
];

/**
 * Bundled font set — a deliberately reduced offline set: two CJK families
 * (serif for body text, sans for bold/emphasis) plus Libertinus Serif for
 * Latin, New Computer Modern Math for math and DejaVu Sans Mono for code.
 * Mirrors the font entries in `scripts/prepare-typst.mjs`; keep in sync.
 */
export const PRINT_FONT_FILES: readonly string[] = [
  'LibertinusSerif-Regular.otf',
  'LibertinusSerif-Bold.otf',
  'LibertinusSerif-Italic.otf',
  'LibertinusSerif-BoldItalic.otf',
  'NewCMMath-Book.otf',
  'NewCMMath-Regular.otf',
  'NewCMMath-Bold.otf',
  'DejaVuSansMono.ttf',
  'DejaVuSansMono-Bold.ttf',
  'DejaVuSansMono-Oblique.ttf',
  'DejaVuSansMono-BoldOblique.ttf',
  'NotoSerifCJKsc-Regular.otf',
  'NotoSansCJKsc-Regular.otf',
  'NotoSansCJKsc-Bold.otf',
];

/**
 * Static prefix for print assets: `/typst/*` and `/fonts/typst/*`. Reads
 * `NEXT_PUBLIC_PRINT_ASSET_PREFIX`, normalizing trailing slashes.
 */
export function getPrintAssetBase(): string {
  return (process.env.NEXT_PUBLIC_PRINT_ASSET_PREFIX ?? '').replace(/\/+$/, '');
}

/**
 * Browser support gate. The Typst worker only needs a module worker and
 * WebAssembly — unlike the clangd worker it does not need
 * `SharedArrayBuffer` or cross-origin isolation (COOP/COEP), so a secure
 * context is not required either: plain-HTTP LAN deployments are a real
 * scenario and module workers/WASM work there.
 */
export function getPrintSupport(): PrintSupport {
  if (
    typeof window === 'undefined' ||
    typeof Worker === 'undefined' ||
    typeof WebAssembly === 'undefined'
  ) {
    return 'unsupported';
  }
  return 'supported';
}
