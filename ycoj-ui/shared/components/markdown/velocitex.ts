import { version } from 'velocitex/package.json';

const assetBaseUrl = `/velocitex/${version}/`;
let initialization: Promise<typeof import('velocitex')> | undefined;

export function loadVelocitex() {
  initialization ??= (async () => {
    // Keep the runtime's dynamic imports and WASM outside the Next/Vite bundle.
    const moduleUrl = new URL(`${assetBaseUrl}index.mjs`, location.href).href;
    const renderer: typeof import('velocitex') = await import(
      /* webpackIgnore: true */ /* @vite-ignore */ moduleUrl
    );
    await renderer.init({ assetBaseUrl: `${assetBaseUrl}runtime/` });
    return renderer;
  })().catch((error: unknown) => {
    initialization = undefined;
    throw error;
  });
  return initialization;
}
