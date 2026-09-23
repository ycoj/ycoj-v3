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
];

// Exact fonts used by the CNOI paper template. These are kept as local,
// checksum-pinned inputs so browser compilation remains fully offline.
const CNOI_FONT_HASHES = {
  'FiraMono-Bold.ttf':
    '2a28efd740e8da1da75d40ac79f0db4f60a0f1aead0b15ca16b4694a11b45fc6',
  'FiraMono-Medium.ttf':
    '5f9173ce3d05fadef74c7eed06570d54e4f75bd0cd9860726fb2987a7f848292',
  'FiraMono-Regular.ttf':
    '8c86f2963208a353c3435e28ecb38a99ab68f14d7433ba00c1822cef9a9c1b44',
  'NewCMMath-Bold.otf':
    'c6c0e060da57d4f44274705afb956013047231dc62be5a4b02a351ab0dc43f2f',
  'NewCMMath-Book.otf':
    '2ea09ebc9167b1e1a66f31390dc917f2d4004ecfca72d51b28010e4ad6becd95',
  'NewCMMath-Regular.otf':
    'd66ac1cc91c55c24d3636ae2df1238076debdff51841f9893fc5419cc2df3df7',
  'NewCMSansMath-Regular.otf':
    '2976236474e4e92ea68d9140c5b05fa1b98818a0a4a30cf8881c4c45ca951fd3',
  'SimSun.ttf':
    'ca4da082cd970f0c8abaa79f213ddcbc475f7b5afabcb81b385998f9ebfbb53f',
  'lmroman10-bold.otf':
    '102fe06c430a8b681b2bf6876b7cd967ae4d47b4b6b41d915eb7913b726d9fb1',
  'lmroman10-bolditalic.otf':
    'c37a28eed7a6e03f792b98b5e5f637b2fcda378bb4855f99284f1a88fe35f124',
  'lmroman10-italic.otf':
    'c1fce25075567bb8dbf2151658c3b442690041db17a2d49fc9e55905ea5b7169',
  'lmroman10-regular.otf':
    '1aa18cfefa58132c52ce5de70db1fd1154201c19cd2b2cdaffba4906a33e6852',
  'lmroman12-bold.otf':
    '28c8782ac2b6486958b5dc7610ada7800c53546ff7f36bc65909a876e1cd338e',
  'lmroman12-italic.otf':
    'ada6b3f451238784e5a5ea75d43efa1eb4329cd75ce65bf047ed2f31b7b5e2f3',
  'lmroman12-regular.otf':
    'e6be218ae83e61aa8a29990d3cdc401c678c1962188cb9a4a8b6359e4f5e5870',
  'lmroman17-regular.otf':
    'ed048c80fb4b67663b80899b89fe5fba17d7442e1286d61fd08fe5689c6b7c3c',
  'simhei.ttf':
    'aa4560dd8fe5645745fed3ffa301c3ca4d6c03cbd738145b613303961ba733b8',
  'simkai.ttf':
    '9dd76f7ab430edd091db24c3f18e71410325c1414141aad5fe67947873ffba06',
};

for (const [filename, sha256] of Object.entries(CNOI_FONT_HASHES)) {
  ASSETS.push({
    dest: `public/fonts/typst/${filename}`,
    sha256,
    copyFrom: `assets/fonts/${filename}`,
  });
}

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
const fontLicenses = `YCOJ CNOI print fonts — provenance
======================================
Generated by scripts/prepare-typst.mjs; every file is SHA-256 pinned there.

Latin Modern, Fira Mono, New Computer Modern, SimSun, SimHei and SimKai
  Source: the user-provided cnoi-statement-generator reference snapshot;
  copied from assets/fonts/ by this script.

These fonts are served to the browser compile worker verbatim; no font is
downloaded from a CDN at runtime.
`;
await atomicWrite(`${root}/public/fonts/typst/FONTLICENSES.txt`, fontLicenses);

console.log(
  `prepare-typst: ${prepared} asset(s) prepared, ${skipped} already up to date.`
);
