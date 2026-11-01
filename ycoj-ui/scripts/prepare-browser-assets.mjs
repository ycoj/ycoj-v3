import { cp, mkdir, readFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const assets = JSON.parse(
  await readFile(join(root, 'shared/lib/browser-assets.json'), 'utf8')
);

for (const [name, { version, files }] of Object.entries(assets)) {
  const source = join(root, 'node_modules', name);
  const installed = JSON.parse(
    await readFile(join(source, 'package.json'), 'utf8')
  );
  if (installed.version !== version) {
    throw new Error(
      `${name}: expected ${version}, got ${installed.version}. Update browser-assets.json after verifying the browser distribution.`
    );
  }

  const destination = join(root, 'public/vendor', `${name}@${version}`);
  for (const file of files) {
    const target = join(destination, file);
    await mkdir(dirname(target), { recursive: true });
    await cp(join(source, file), target, { recursive: true });
  }
  for (const license of [
    'LICENSE',
    'LICENSE.txt',
    'LICENSE.md',
    'License.txt',
    'ThirdPartyNotices.txt',
  ]) {
    if (await stat(join(source, license)).catch(() => null)) {
      await cp(join(source, license), join(destination, license));
    }
  }
  console.log(`prepare-browser-assets: ${name}@${version}`);
}
