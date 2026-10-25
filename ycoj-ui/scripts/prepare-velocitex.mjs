import { cp, mkdir, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { version } = require('velocitex/package.json');
const source = new URL('.', import.meta.resolve('velocitex'));
const destination = new URL(`../public/velocitex/${version}/`, import.meta.url);

// Keep the ES modules, runtime, stylesheet, fonts and notices from one release.
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
await cp(source, destination, { recursive: true });
await cp(new URL('../licenses/', source), new URL('licenses/', destination), {
  recursive: true,
});
for (const notice of ['LICENSE', 'THIRD-PARTY-NOTICES.md']) {
  await cp(new URL(`../${notice}`, source), new URL(notice, destination));
}
console.log(
  `prepare-velocitex: copied VelociTex ${version} to public/velocitex.`
);
