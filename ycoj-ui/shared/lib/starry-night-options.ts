import { browserAssetUrl } from './browser-assets';
import type { Options } from '@wooorm/starry-night';

export const starryNightOptions: Options = {
  getOnigurumaUrlFetch: () =>
    new URL(
      browserAssetUrl('vscode-oniguruma', 'release/onig.wasm'),
      window.location.href
    ),
};
