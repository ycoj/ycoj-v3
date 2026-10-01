import { cp, mkdir, readdir, rm, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Prepares the browser-served Excalidraw font assets:
 *
 *   public/excalidraw/fonts/<Family>/*.woff2  (copied from node_modules)
 *
 * The Excalidraw runtime resolves font files against
 * `window.EXCALIDRAW_ASSET_PATH`; when it is unset the loader silently falls
 * back to the esm.sh CDN, so the fonts must be self-hosted to keep the app
 * free of runtime CDN requests. The generated directory is gitignored (it is
 * a reproducible build output).
 */

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');

const PACKAGE = '@excalidraw/excalidraw';
const EXPECTED_VERSION = '0.18.1';
const FONT_SOURCE = `node_modules/${PACKAGE}/dist/prod/fonts`;
const FONT_DEST = 'public/excalidraw/fonts';

// A version bump that renames or restructures the prebuilt font directory
// must fail loudly here instead of shipping a canvas with no self-hosted
// fonts (and a silent CDN fallback at runtime).
const pkg = require('../package.json');
const spec = pkg.dependencies?.[PACKAGE];
if (!spec || !spec.startsWith(EXPECTED_VERSION)) {
  throw new Error(
    `${PACKAGE} is ${spec ?? 'missing'}; expected ${EXPECTED_VERSION}. ` +
      `Re-check the prebuilt font layout and update EXPECTED_VERSION in this script.`
  );
}

async function countFiles(directory) {
  let total = 0;
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      total += await countFiles(`${directory}/${entry.name}`);
    } else {
      total += 1;
    }
  }
  return total;
}

async function prepareFonts() {
  const source = `${root}/${FONT_SOURCE}`;
  const destination = `${root}/${FONT_DEST}`;

  const sourceInfo = await stat(source).catch(() => null);
  if (!sourceInfo?.isDirectory()) {
    throw new Error(
      `Missing ${FONT_SOURCE}; ${PACKAGE} ${EXPECTED_VERSION} should ship it.`
    );
  }

  const expectedCount = await countFiles(source);
  const existingCount = await countFiles(destination).catch(() => 0);
  if (existingCount === expectedCount) {
    console.log(
      `prepare-excalidraw: ${FONT_DEST} already has ${existingCount} font file(s).`
    );
    return;
  }

  await mkdir(dirname(destination), { recursive: true });
  await rm(destination, { recursive: true, force: true });
  await cp(source, destination, { recursive: true });

  const copiedCount = await countFiles(destination);
  console.log(
    `prepare-excalidraw: copied ${copiedCount} font file(s) to ${FONT_DEST}.`
  );
  if (copiedCount !== expectedCount) {
    throw new Error(
      `Copied ${copiedCount} font file(s) but ${FONT_SOURCE} has ${expectedCount}.`
    );
  }
}

await prepareFonts();
