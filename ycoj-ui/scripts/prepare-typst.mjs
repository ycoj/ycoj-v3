import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Prepares the browser-served Typst/WASM print assets:
 *
 *   public/typst/typst_ts_web_compiler_bg.wasm  (copied from node_modules)
 *   public/typst/packages/mitex-0.2.7.tarball   (vendored @preview/mitex)
 *   public/fonts/typst/*                        (reduced offline font set)
 *
 * Everything is SHA-256 pinned, skipped when the destination already
 * verifies, downloaded with retry, and written atomically. The generated
 * directories are gitignored (they are reproducible build outputs).
 */

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

const TYPST_ASSETS =
  'https://cdn.jsdelivr.net/gh/typst/typst-assets@v0.13.1/files/fonts/';
const TYPST_ASSETS_FALLBACK =
  'https://raw.githubusercontent.com/typst/typst-assets/v0.13.1/files/fonts/';
// Noto Sans CJK Bold is fetched from the tagged Sans2.004 release tree.
// Integrity is enforced by the pinned SHA-256 below.
const NOTO_CJK = 'https://cdn.jsdelivr.net/gh/notofonts/noto-cjk@Sans2.004/';
const NOTO_CJK_FALLBACK =
  'https://raw.githubusercontent.com/notofonts/noto-cjk/Sans2.004/';
const MITEX_VERSION = '0.2.7';
const MITEX_URL = `https://packages.typst.org/preview/mitex-${MITEX_VERSION}.tar.gz`;

/** @type {Array<{dest: string, sha256: string, copyFrom?: string, urls?: string[]}>} */
const ASSETS = [
  // ---- compiler wasm --------------------------------------------------------
  {
    dest: 'public/typst/typst_ts_web_compiler_bg.wasm',
    sha256: '1fc968438a672366dfec39c96c842c26ed29caff4eb1bcaab19a6c60867de5fd',
    copyFrom:
      'node_modules/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm',
  },
  // ---- vendored packages ----------------------------------------------------
  {
    // The .tarball suffix is intentional: a .gz name makes some servers/CDNs
    // reply with `Content-Encoding: gzip`, and the browser then decompresses
    // transparently so the worker receives raw tar instead of gzip bytes.
    dest: `public/typst/packages/mitex-${MITEX_VERSION}.tarball`,
    sha256: '0159e214845e49cbdc332d9d572da112dae5ad248072e0a7680d38c8307c2e15',
    urls: [MITEX_URL],
  },
  // ---- fonts (Libertinus Serif: Latin text) ---------------------------------
  {
    dest: 'public/fonts/typst/LibertinusSerif-Regular.otf',
    sha256: 'fcf06307a77367394fcb0ccb241e59eea70dba3d732be309647611224679c733',
    urls: [
      `${TYPST_ASSETS}LibertinusSerif-Regular.otf`,
      `${TYPST_ASSETS_FALLBACK}LibertinusSerif-Regular.otf`,
    ],
  },
  {
    dest: 'public/fonts/typst/LibertinusSerif-Bold.otf',
    sha256: '0264914210ed51b3231ebc92ce529e9f2e166ba9eebf0cd4a579558690a27b64',
    urls: [
      `${TYPST_ASSETS}LibertinusSerif-Bold.otf`,
      `${TYPST_ASSETS_FALLBACK}LibertinusSerif-Bold.otf`,
    ],
  },
  {
    dest: 'public/fonts/typst/LibertinusSerif-Italic.otf',
    sha256: '9a393d63d6e05f620d3dc0190dfd35a8ede58c0808cf0fc9de7fcb9c723e4c24',
    urls: [
      `${TYPST_ASSETS}LibertinusSerif-Italic.otf`,
      `${TYPST_ASSETS_FALLBACK}LibertinusSerif-Italic.otf`,
    ],
  },
  {
    dest: 'public/fonts/typst/LibertinusSerif-BoldItalic.otf',
    sha256: '47a665259f09f554f5d133d7718cdad43ff462c6a6b2328f38023465e62d57ce',
    urls: [
      `${TYPST_ASSETS}LibertinusSerif-BoldItalic.otf`,
      `${TYPST_ASSETS_FALLBACK}LibertinusSerif-BoldItalic.otf`,
    ],
  },
  // ---- fonts (New Computer Modern Math: math) --------------------------------
  {
    dest: 'public/fonts/typst/NewCMMath-Book.otf',
    sha256: 'b2e655d5cae5ab9569fa6f5d94e929156fe70bd3548d916b4b23d1a1c1a55693',
    urls: [
      `${TYPST_ASSETS}NewCMMath-Book.otf`,
      `${TYPST_ASSETS_FALLBACK}NewCMMath-Book.otf`,
    ],
  },
  {
    dest: 'public/fonts/typst/NewCMMath-Regular.otf',
    sha256: 'bfd2f9b22caacd41b8b29cfe3f6d72f976f221a65362e07eda35cbae863721b7',
    urls: [
      `${TYPST_ASSETS}NewCMMath-Regular.otf`,
      `${TYPST_ASSETS_FALLBACK}NewCMMath-Regular.otf`,
    ],
  },
  {
    dest: 'public/fonts/typst/NewCMMath-Bold.otf',
    sha256: '8956f7ef6c212ea647fe689abb66a3f3359126abcbb673fb58f3ecf033c7d1a7',
    urls: [
      `${TYPST_ASSETS}NewCMMath-Bold.otf`,
      `${TYPST_ASSETS_FALLBACK}NewCMMath-Bold.otf`,
    ],
  },
  // ---- fonts (DejaVu Sans Mono: code) ----------------------------------------
  {
    dest: 'public/fonts/typst/DejaVuSansMono.ttf',
    sha256: 'b4a6c3e4faab8773f4ff761d56451646409f29abedd68f05d38c2df667d3c582',
    urls: [
      `${TYPST_ASSETS}DejaVuSansMono.ttf`,
      `${TYPST_ASSETS_FALLBACK}DejaVuSansMono.ttf`,
    ],
  },
  {
    dest: 'public/fonts/typst/DejaVuSansMono-Bold.ttf',
    sha256: 'bce60f1b4421acd9ea51ba6623d7024ecbe6817a953e3654df62a5e6bdf8f769',
    urls: [
      `${TYPST_ASSETS}DejaVuSansMono-Bold.ttf`,
      `${TYPST_ASSETS_FALLBACK}DejaVuSansMono-Bold.ttf`,
    ],
  },
  {
    dest: 'public/fonts/typst/DejaVuSansMono-Oblique.ttf',
    sha256: '742097840c541870e8d6dc5c9b37bb1ceeea6c0dedd1d475faf903ef9df734b0',
    urls: [
      `${TYPST_ASSETS}DejaVuSansMono-Oblique.ttf`,
      `${TYPST_ASSETS_FALLBACK}DejaVuSansMono-Oblique.ttf`,
    ],
  },
  {
    dest: 'public/fonts/typst/DejaVuSansMono-BoldOblique.ttf',
    sha256: '91713a71d550bba22c2a6b2bb2a9ad8f9a159e12e4e9f0a5b2677998ba21213e',
    urls: [
      `${TYPST_ASSETS}DejaVuSansMono-BoldOblique.ttf`,
      `${TYPST_ASSETS_FALLBACK}DejaVuSansMono-BoldOblique.ttf`,
    ],
  },
  // ---- fonts (Noto CJK: CJK text) ---------------------------------------------
  {
    // Vendored under assets/fonts/ (extracted from the Serif2.003 release
    // zip — the upstream repo has no small stable URL for this file).
    dest: 'public/fonts/typst/NotoSerifCJKsc-Regular.otf',
    sha256: '2a2eae2628df83556c54018c41e20fa532c1b862c5256ae8b3f23feb918d12ca',
    copyFrom: 'assets/fonts/NotoSerifCJKsc-Regular.otf',
  },
  {
    // Already vendored under assets/fonts/; copied rather than re-downloaded.
    dest: 'public/fonts/typst/NotoSansCJKsc-Regular.otf',
    sha256: '2c76254f6fc379fddfce0a7e84fb5385bb135d3e399294f6eeb6680d0365b74b',
    copyFrom: 'assets/fonts/NotoSansCJKsc-Regular.otf',
  },
  {
    dest: 'public/fonts/typst/NotoSansCJKsc-Bold.otf',
    sha256: 'b5f0d1a190a7f9b43c310a8850630af12553df32c4c050543f9059732d9b4c0a',
    urls: [
      `${NOTO_CJK}Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Bold.otf`,
      `${NOTO_CJK_FALLBACK}Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Bold.otf`,
    ],
  },
  // ---- font license -----------------------------------------------------------
  {
    // OFL-1.1 text covering Libertinus Serif, New Computer Modern and the
    // Noto CJK faces (DejaVu ships its own permissive Bitstream license —
    // see the generated FONTLICENSES.txt).
    dest: 'public/fonts/typst/OFL.txt',
    sha256: '6a73f9541c2de74158c0e7cf6b0a58ef774f5a780bf191f2d7ec9cc53efe2bf2',
    copyFrom: 'assets/fonts/noto-sans-cjk-OFL.txt',
  },
];

// Keep the pinned wasm byte-identical to the installed package: if the
// dependency is bumped without re-pinning, this script fails loudly instead
// of silently shipping a mismatched wasm/JS pair.
const pkg = require('../package.json');
const compilerSpec = pkg.dependencies?.['@myriaddreamin/typst-ts-web-compiler'];
const expectedSpec = '0.7.0';
if (compilerSpec !== expectedSpec) {
  throw new Error(
    `@myriaddreamin/typst-ts-web-compiler is ${compilerSpec ?? 'missing'}; ` +
      `expected ${expectedSpec}. Re-pin the wasm checksum in this script when upgrading.`
  );
}

const fetchAttempts = 3;
const retryDelayMs = 800;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithRetry(url) {
  let lastError;
  for (let attempt = 1; attempt <= fetchAttempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      lastError = error;
      if (attempt < fetchAttempts) await sleep(retryDelayMs * attempt);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function existingBytesVerify(destination, sha256) {
  try {
    const bytes = await readFile(destination);
    return hash(bytes) === sha256;
  } catch {
    return false;
  }
}

async function atomicWrite(destination, bytes) {
  const temporary = `${destination}.tmp`;
  await writeFile(temporary, bytes);
  await rename(temporary, destination);
}

let prepared = 0;
let skipped = 0;
for (const asset of ASSETS) {
  const destination = `${root}/${asset.dest}`;
  await mkdir(dirname(destination), { recursive: true });
  if (await existingBytesVerify(destination, asset.sha256)) {
    skipped += 1;
    continue;
  }
  if (asset.copyFrom !== undefined) {
    const source = `${root}/${asset.copyFrom}`;
    let bytes;
    try {
      bytes = await readFile(source);
    } catch (error) {
      throw new Error(
        `Missing local asset ${asset.copyFrom} needed for ${asset.dest}: ${error.message}`
      );
    }
    if (hash(bytes) !== asset.sha256) {
      throw new Error(
        `Checksum mismatch for local asset ${asset.copyFrom}; refusing to copy it into ${asset.dest}.`
      );
    }
    await atomicWrite(destination, bytes);
    console.log(`Copied ${asset.dest}`);
  } else {
    let bytes;
    let lastError;
    for (const url of asset.urls ?? []) {
      try {
        bytes = await fetchWithRetry(url);
        lastError = undefined;
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (bytes === undefined) {
      throw new Error(
        `Failed to download ${asset.dest}: ${lastError?.message ?? 'no URLs configured'}`
      );
    }
    if (hash(bytes) !== asset.sha256) {
      throw new Error(
        `Checksum mismatch for downloaded ${asset.dest}; refusing an unpinned asset.`
      );
    }
    await atomicWrite(destination, bytes);
    console.log(`Downloaded ${asset.dest} (${bytes.length} bytes)`);
  }
  prepared += 1;
}

// Provenance note shipped next to the fonts.
const fontLicenses = `YCOJ print fonts — provenance and licenses
=====================================================
Generated by scripts/prepare-typst.mjs; every file is SHA-256 pinned there.

Libertinus Serif (Regular/Bold/Italic/BoldItalic)
  Source: typst/typst-assets v0.13.1 (fonts/)
  License: SIL Open Font License 1.1 (OFL.txt)

New Computer Modern Math (Book/Regular/Bold)
  Source: typst/typst-assets v0.13.1 (fonts/)
  License: SIL Open Font License 1.1 (OFL.txt) / GUST Font License

DejaVu Sans Mono (Regular/Bold/Oblique/BoldOblique)
  Source: typst/typst-assets v0.13.1 (fonts/)
  License: Bitstream Vera Fonts Copyright / public-domain-like permissive terms

Noto Serif CJK SC Regular, Noto Sans CJK SC Regular & Bold
  Source: notofonts/noto-cjk (Sans|Serif/OTF/SimplifiedChinese)
  License: SIL Open Font License 1.1 (OFL.txt)

These fonts are served to the browser compile worker verbatim; no font is
downloaded from a CDN at runtime.
`;
await atomicWrite(`${root}/public/fonts/typst/FONTLICENSES.txt`, fontLicenses);

console.log(
  `prepare-typst: ${prepared} asset(s) prepared, ${skipped} already up to date.`
);
